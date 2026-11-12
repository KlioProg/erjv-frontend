import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PurchaseOrderDetailModal } from '@/components/purchases/PurchaseOrderDetailModal'
import { PurchaseModal } from '@/components/purchases/PurchaseModal'
import { OrderDetailDrawer } from '@/components/orders/OrderDetailDrawer'
import { OrderModal } from '@/components/orders/OrderModal'
import { useAuth } from '@/features/auth/AuthContext'
import {
  usePurchaseOrderById,
  useConfirmPurchaseOrder,
  useUpdatePurchaseOrderDraft,
} from '@/features/logistics/purchase-orders.hooks'
import {
  useSalesOrderById,
  useUpdateSalesOrderDraft,
  useConfirmSalesOrder,
} from '@/features/crm/sales-orders.hooks'
import { fetchSalesOrderByIdApi } from '@/features/crm/sales-orders.api'
import { fetchIncomingDeliveriesApi } from '@/features/logistics/incoming-deliveries.api'
import { fetchOutgoingDeliveriesApi } from '@/features/logistics/outgoing-deliveries.api'
import { useRecordsById } from '@/lib/use-records-by-id'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { getErrorMessage } from '@/lib/api-client'

/** Reuses order editors and their revision/confirmation rules; closing restores the delivery. */
export function DeliveryOrderReview({
  type,
  orderId,
  reference,
  warehouses,
  onClose,
}: {
  type: 'Incoming' | 'Outgoing'
  orderId: number
  reference: string
  warehouses: Warehouse[]
  onClose: () => void
}) {
  const { isAdmin, isManager, user } = useAuth()
  const canEdit = isAdmin || isManager
  const client = useQueryClient()
  const [editing, setEditing] = useState(false)
  const purchase = usePurchaseOrderById(type === 'Incoming' ? orderId : undefined)
  const sale = useSalesOrderById(type === 'Outgoing' ? orderId : undefined)
  const query = type === 'Incoming' ? purchase : sale
  const updatePurchase = useUpdatePurchaseOrderDraft()
  const confirmPurchase = useConfirmPurchaseOrder()
  const updateSale = useUpdateSalesOrderDraft()
  const confirmSale = useConfirmSalesOrder()
  const suppliers = useRecordsById<Supplier>('/suppliers', [purchase.data?.supplierId])
  const clients = useRecordsById<Client>('/clients', [sale.data?.clientId])
  const products = useRecordsById<InventoryItemResponse>(
    '/inventory-items',
    (query.data?.items ?? []).map((item) => item.inventoryItemId),
  )
  const incoming = useQuery({
    queryKey: ['incoming-deliveries', 'order-review', orderId],
    queryFn: () => fetchIncomingDeliveriesApi({ purchaseOrderId: orderId }),
    enabled: type === 'Incoming',
  })
  const outgoing = useQuery({
    queryKey: ['outgoing-deliveries', 'order-review', orderId],
    queryFn: () => fetchOutgoingDeliveriesApi({ salesOrderId: orderId }),
    enabled: type === 'Outgoing',
  })
  async function returnToDelivery() {
    await Promise.all(
      [
        'purchase-orders',
        'sales-orders',
        'incoming-deliveries',
        'outgoing-deliveries',
        'warehouses',
      ].map((resource) => client.invalidateQueries({ queryKey: [resource] })),
    )
    onClose()
  }
  const close = () => void returnToDelivery()
  const unavailable = !query.data || (query.isError && !editing)
  const refetch = query.refetch
  useEffect(() => {
    void refetch()
  }, [refetch])
  const busy = query.isFetching || !query.isFetchedAfterMount
  if (unavailable)
    return (
      <Dialog open onOpenChange={(open) => !open && close()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Parent Order</DialogTitle>
            <DialogDescription>Return to {reference} after reviewing this order.</DialogDescription>
          </DialogHeader>
          <p role={query.isError ? 'alert' : 'status'}>
            {query.isError
              ? 'The order could not be verified. Retry loading it before making changes.'
              : 'Loading current order…'}
          </p>
          {query.isError && (
            <Button variant="outline" onClick={() => void query.refetch()}>
              Retry Order
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            Return to Delivery
          </Button>
        </DialogContent>
      </Dialog>
    )
  const notCreating = async (): Promise<never> => {
    throw Error('Return to the original delivery and reload the linked order.')
  }
  if (type === 'Incoming' && purchase.data) {
    const order = purchase.data
    if (editing && canEdit)
      return (
        <PurchaseModal
          remoteSelectors
          open
          draftOrder={order}
          suppliers={suppliers.data}
          products={products.data}
          processedBy={user?.fullName || user?.email || ''}
          onSubmit={notCreating}
          onUpdateDraft={(id, payload) => updatePurchase.mutateAsync({ id, payload })}
          onConfirm={
            isAdmin
              ? (id, expectedRevision) => confirmPurchase.mutateAsync({ id, expectedRevision })
              : undefined
          }
          onClose={close}
          onConfirmed={close}
        />
      )
    return (
      <PurchaseOrderDetailModal
        order={order}
        supplier={suppliers.data[0]}
        products={products.data}
        warehouses={warehouses}
        incomingDeliveries={incoming.data ?? []}
        receivingLoading={incoming.isPending}
        receivingUnavailable={incoming.isError}
        onRetryReceiving={() => void incoming.refetch()}
        recordBusy={busy}
        recordUnavailable={query.isError}
        onClose={close}
        onEdit={canEdit && order.status === 'DRAFT' ? () => setEditing(true) : undefined}
        onConfirm={
          isAdmin && order.status === 'DRAFT'
            ? async () => {
                await confirmPurchase.mutateAsync({
                  id: order.id,
                  expectedRevision: order.revision,
                })
                await returnToDelivery()
              }
            : undefined
        }
      />
    )
  }
  if (sale.data) {
    const order = sale.data
    if (editing && canEdit)
      return (
        <OrderModal
          remoteSelectors
          open
          draftOrder={order}
          clients={clients.data}
          products={products.data}
          cashier={user?.fullName || user?.email || ''}
          onSubmit={notCreating}
          onUpdateDraft={(id, payload) => updateSale.mutateAsync({ id, payload })}
          onLoadLatest={fetchSalesOrderByIdApi}
          onConfirm={(id, expectedRevision) => confirmSale.mutateAsync({ id, expectedRevision })}
          onClose={close}
          onConfirmed={close}
        />
      )
    return (
      <OrderDetailDrawer
        open
        readOnly={!canEdit || order.status !== 'DRAFT'}
        order={order}
        clients={clients.data}
        products={products.data}
        warehouses={warehouses}
        vehicles={[]}
        employees={[]}
        stockItems={[]}
        outgoingDeliveries={outgoing.data ?? []}
        deliveriesLoading={outgoing.isPending}
        deliveriesUnavailable={outgoing.isError}
        onRetryDeliveries={() => void outgoing.refetch()}
        recordBusy={busy}
        recordUnavailable={query.isError}
        onClose={close}
        onEdit={canEdit && order.status === 'DRAFT' ? () => setEditing(true) : undefined}
        onConfirmed={close}
      />
    )
  }
  return <p role="alert">{getErrorMessage(query.error)}</p>
}
