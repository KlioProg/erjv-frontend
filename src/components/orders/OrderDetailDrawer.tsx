import {
  OrderDetailFooter,
  type OrderDetailAction,
} from '@/components/orders/shared/OrderDetailFooter'
import { useRef, useState } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { useConfirmSalesOrder, useCancelSalesOrder } from '@/features/crm/sales-orders.hooks'
import { getSalesOrderDetailProgress } from '@/features/crm/sales-orders.presentation'
import { getErrorMessage } from '@/lib/api-client'
import { formatProductUnit } from '@/lib/product-unit'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { Employee } from '@/features/staffing/staffing.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import {
  MovementDetailHeader,
  MovementDetailFields,
} from '@/components/deliveries/shared/MovementDetailLayout'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { LifecycleProgress } from '@/components/ui/LifecycleProgress'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { SalesOrderCancelModal } from './SalesOrderCancelModal'
import { SalesOrderProgress } from './SalesOrderProgress'
import { QuickDispatchModal } from './QuickDispatchModal'
import { CompleteDeliveryModal } from '@/components/deliveries/shared/CompleteDeliveryModal'

interface OrderDetailDrawerProps {
  open: boolean
  readOnly?: boolean
  onClose: () => void
  order: SalesOrderRecord | null
  clients: Client[]
  products: InventoryItemResponse[]
  warehouses: Warehouse[]
  vehicles: DeliveryVehicle[]
  employees: Employee[]
  stockItems: StockItem[]
  outgoingDeliveries: OutgoingDeliveryRecord[]
  onViewDelivery?: (id: number) => void
  onViewDeliveries?: (orderId: number) => void
  onConfirmed?: (order: SalesOrderRecord) => void
  onCancelled?: () => void
  onEdit?: (order: SalesOrderRecord) => void
  onArrangeDelivery?: (orderId: number) => void
  deliveriesLoading?: boolean
  deliveriesUnavailable?: boolean
  onRetryDeliveries?: () => void
  recordBusy?: boolean
  recordUnavailable?: boolean
}

export function OrderDetailDrawer({
  open,
  readOnly = false,
  onClose,
  order,
  clients,
  products,
  warehouses,
  vehicles,
  employees,
  stockItems,
  outgoingDeliveries,
  onViewDelivery,
  onViewDeliveries,
  onConfirmed,
  onCancelled,
  onEdit,
  onArrangeDelivery,
  deliveriesLoading = false,
  deliveriesUnavailable = false,
  onRetryDeliveries,
  recordBusy = false,
  recordUnavailable = false,
}: OrderDetailDrawerProps) {
  const { isAdmin, isManager } = useAuth()
  const canManage = !readOnly && (isAdmin || isManager)
  const confirmMutation = useConfirmSalesOrder()
  const cancelMutation = useCancelSalesOrder()
  const confirming = useRef(false)
  const launcherRef = useRef<HTMLElement | null>(null)
  const [error, setError] = useState('')
  const [orderToCancel, setOrderToCancel] = useState<SalesOrderRecord | null>(null)
  const [dispatching, setDispatching] = useState(false)
  const [completingId, setCompletingId] = useState<number | null>(null)
  if (!order) return null
  const busy = confirmMutation.isPending || cancelMutation.isPending
  const blocked = busy || recordBusy || recordUnavailable
  const linked = outgoingDeliveries.filter((delivery) => delivery.salesOrderId === order.id)
  const active = linked.filter(
    (delivery) => delivery.status !== 'CANCELLED' && delivery.status !== 'RECONCILED',
  )
  const dispatched = active.find((delivery) => delivery.status === 'DISPATCHED')
  const progress = getSalesOrderDetailProgress(
    order,
    outgoingDeliveries,
    !deliveriesLoading && !deliveriesUnavailable,
  )
  const customer = clients.find((item) => item.id === order.clientId)
  const money = (value: string | number) =>
    '₱' +
    Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const columns: ColumnDef<SalesOrderRecord['items'][number]>[] = [
    {
      header: 'Product',
      cell: ({ row }) => {
        const product = products.find((product) => product.id === row.inventoryItemId)
        return (
          <OverflowValue
            value={
              product
                ? product.name + (product.variety ? ' (' + product.variety + ')' : '')
                : 'Product #' + row.inventoryItemId
            }
          />
        )
      },
    },
    {
      header: 'Quantity',
      align: 'right',
      cell: ({ row }) =>
        row.quantity +
        ' ' +
        formatProductUnit(products.find((product) => product.id === row.inventoryItemId)?.unit),
    },
    { header: 'Unit Price', align: 'right', cell: ({ row }) => money(row.unitPrice) },
    { header: 'Amount', align: 'right', cell: ({ row }) => money(row.totalAmount) },
  ]
  const canArrange =
    canManage &&
    (order.status === 'PARTIALLY_DELIVERED' ||
      (order.status === 'CONFIRMED' && active.length === 0))
  const canCancel = canManage && ['DRAFT', 'CONFIRMED'].includes(order.status)
  const secondaryActions: OrderDetailAction[] = []
  if (canManage && order.status === 'DRAFT' && onEdit)
    secondaryActions.push({ label: 'Edit Draft', disabled: blocked, onSelect: () => onEdit(order) })
  if (linked.length > 0 && onViewDeliveries)
    secondaryActions.push({ label: 'View Deliveries', onSelect: () => onViewDeliveries(order.id) })
  if (linked[0] && onViewDelivery)
    secondaryActions.push({
      label: 'View Delivery',
      onSelect: () => onViewDelivery((active[0] ?? linked[0]).id),
    })
  if (canArrange && dispatched)
    secondaryActions.push({
      label: 'Arrange Remaining Delivery',
      disabled: blocked || deliveriesLoading || deliveriesUnavailable,
      onSelect: () => (onArrangeDelivery ? onArrangeDelivery(order.id) : setDispatching(true)),
    })
  if (canCancel)
    secondaryActions.push({
      label: 'Cancel Order',
      disabled: blocked,
      destructive: true,
      onSelect: () => setOrderToCancel(order),
    })
  const primaryAction: OrderDetailAction | undefined =
    canManage && order.status === 'DRAFT'
      ? {
          label: busy ? 'Confirming...' : 'Confirm Order',
          disabled: blocked,
          onSelect: () => void confirm(),
        }
      : canManage && !['DELIVERED', 'CANCELLED'].includes(order.status) && dispatched
        ? {
            label: 'Record Results',
            disabled:
              blocked ||
              deliveriesLoading ||
              deliveriesUnavailable ||
              (!onViewDeliveries && !dispatched.runId),
            onSelect: () =>
              onViewDeliveries ? onViewDeliveries(order.id) : setCompletingId(dispatched.id),
          }
        : canArrange && !dispatched
          ? {
              label:
                order.status === 'PARTIALLY_DELIVERED'
                  ? 'Arrange Remaining Delivery'
                  : 'Arrange Delivery',
              disabled: blocked || deliveriesLoading || deliveriesUnavailable,
              onSelect: () =>
                onArrangeDelivery ? onArrangeDelivery(order.id) : setDispatching(true),
            }
          : undefined
  async function confirm() {
    if (blocked || confirming.current || !canManage || !order || order.status !== 'DRAFT') return
    if (!order.deliveryAddress?.trim() || !order.items.length) {
      setError('Confirmation requires a delivery address and at least one item. Use More Actions to edit the draft.')
      return
    }
    confirming.current = true
    setError('')
    try {
      const saved = await confirmMutation.mutateAsync({
        id: order.id,
        expectedRevision: order.revision,
      })
      onConfirmed?.(saved)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      confirming.current = false
    }
  }
  return (
    <>
      <Dialog
        open={open && !orderToCancel && !dispatching && completingId === null}
        onOpenChange={(next) => !next && !busy && onClose()}
      >
        <DialogContent
          closeDisabled={busy}
          onOpenAutoFocus={() => {
            const target = document.activeElement
            if (target instanceof HTMLElement && !target.closest('[role="dialog"], [role="menu"]'))
              launcherRef.current = target
          }}
          onCloseAutoFocus={(event) => {
            if (launcherRef.current?.isConnected) {
              event.preventDefault()
              launcherRef.current.focus({ preventScroll: true })
            }
          }}
          className="flex h-auto min-h-0 max-h-[calc(100dvh-2rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-4xl sm:p-5"
        >
          <div className="flex w-full min-w-0 shrink-0 flex-col gap-2">
            <MovementDetailHeader
              title={order.orderNumber}
              description={
                'Sales order · ' +
                new Date(order.orderedAt || order.createdAt).toLocaleDateString('en-PH', {
                  timeZone: 'Asia/Manila',
                })
              }
              status={<StatusBadge label={progress.label} tone={progress.tone} />}
            />
            <LifecycleProgress label="Sales order lifecycle" milestones={progress.milestones} />
            <p className="text-sm text-muted-foreground">{progress.explanation}</p>
          </div>
          <div
            role="region"
            aria-label="Sales order content"
            tabIndex={0}
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-2 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            {recordUnavailable && (
              <Alert variant="destructive">
                <AlertDescription>
                  The latest order could not be loaded. Reopen this record before making changes.
                </AlertDescription>
              </Alert>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {deliveriesUnavailable && (
              <Alert variant="destructive">
                <AlertDescription>
                  Related deliveries could not be loaded.{' '}
                  <Button variant="link" onClick={onRetryDeliveries}>
                    Retry deliveries
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <MovementDetailFields
              fields={[
                {
                  label: 'Customer',
                  value: customer?.name ?? 'Customer #' + order.clientId,
                  secondary: [customer?.phone, customer?.email].filter(Boolean).join(' · '),
                },
                {
                  label: 'Destination',
                  value: order.deliveryAddress || 'Store Counter / Direct Pick-up',
                },
                ...(order.externalReference
                  ? [{ label: 'Reference', value: order.externalReference }]
                  : []),
              ]}
            />
            <section aria-label="Ordered items" className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">Ordered items</h2>
              <DataTable
                data={order.items || []}
                columns={columns}
                pagination={false}
                getRowKey={(item) => item.id}
                tableClassName="min-w-[560px] tabular-nums"
              />
              <p className="text-right text-sm font-semibold">
                Total:{' '}
                {money(
                  (order.items || []).reduce((sum, item) => sum + Number(item.totalAmount), 0),
                )}
              </p>
            </section>
            {(linked.length > 0 ||
              deliveriesLoading ||
              deliveriesUnavailable ||
              ['PARTIALLY_DELIVERED', 'DELIVERED'].includes(order.status)) && (
              <details
                className="border-t pt-3"
                open={
                  deliveriesLoading ||
                  deliveriesUnavailable ||
                  ['PARTIALLY_DELIVERED', 'DELIVERED'].includes(order.status) ||
                  linked.some((delivery) => delivery.status === 'RECONCILED')
                }
              >
                <summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Fulfillment details
                </summary>
                <div className="mt-3">
                  <SalesOrderProgress
                    order={order}
                    products={products}
                    deliveries={outgoingDeliveries}
                    isLoading={deliveriesLoading}
                    unavailable={deliveriesUnavailable}
                    onViewDelivery={onViewDelivery}
                  />
                </div>
              </details>
            )}
            {order.notes && (
              <section>
                <h2 className="text-sm font-semibold">Notes</h2>
                <p className="whitespace-pre-wrap text-sm">{order.notes}</p>
              </section>
            )}
          </div>
          <OrderDetailFooter
            label="Sales order actions"
            secondaryActions={secondaryActions}
            primaryAction={primaryAction}
            onClose={onClose}
            busy={busy}
          />
        </DialogContent>
      </Dialog>
      {orderToCancel && (
        <SalesOrderCancelModal
          order={orderToCancel}
          onClose={() => setOrderToCancel(null)}
          onConfirm={async (id, expectedRevision) => {
            if (!canManage) throw Error('You do not have permission to cancel orders.')
            await cancelMutation.mutateAsync({ id, expectedRevision })
            onCancelled?.()
          }}
        />
      )}
      {completingId !== null && dispatched?.runId && (
        <CompleteDeliveryModal
          runId={dispatched.runId}
          deliveryId={completingId}
          onClose={() => setCompletingId(null)}
        />
      )}
      {dispatching && (
        <QuickDispatchModal
          open
          order={order}
          onClose={() => setDispatching(false)}
          vehicles={vehicles}
          employees={employees}
          warehouses={warehouses}
          stockItems={stockItems}
        />
      )}
    </>
  )
}
