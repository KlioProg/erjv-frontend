import { formatProductUnit } from '@/lib/product-unit'
import { useRef, useState, type ReactNode } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getErrorMessage } from '@/lib/api-client'
import { formatPurchaseMoney, purchaseDecimal, storedPurchaseTotal } from '@/features/logistics/purchase-pricing'
import { PurchaseReceivingProgress } from './PurchaseReceivingProgress'
import { OverflowValue } from '@/components/ui/OverflowValue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import type {
  PurchaseOrderRecord,
  PurchaseOrderItemRecord,
} from '@/features/logistics/purchase-orders.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { InventoryItemResponse } from '@/features/products/products.types'

type Props = {
  order: PurchaseOrderRecord
  supplier?: Supplier
  products: InventoryItemResponse[]
  warehouses: Warehouse[]
  incomingDeliveries: IncomingDeliveryRecord[]
  receivingLoading?: boolean
  receivingUnavailable?: boolean
  onRetryReceiving?: () => void
  statusBadge: ReactNode
  onClose: () => void
  onConfirm?: () => Promise<unknown> | void
  onExportReceipt?: () => void
  confirming?: boolean
  onNavigateToDeliveries?: (purchaseOrderId?: number) => void
}

const currency = (value: string | number) =>
  formatPurchaseMoney(purchaseDecimal(String(value)))

export function PurchaseOrderDetailModal({
  order,
  supplier,
  products,
  warehouses,
  incomingDeliveries,
  receivingLoading = false,
  receivingUnavailable = false,
  onRetryReceiving = () => {},
  statusBadge,
  onClose,
  onConfirm,
  onExportReceipt,
  confirming,
  onNavigateToDeliveries,
}: Props) {
  const [confirmationError, setConfirmationError] = useState('')
  const [pending, setPending] = useState(false)
  const confirmationLock = useRef(false)
  const busy = confirming || pending
  async function confirm() {
    if (confirmationLock.current || busy || !onConfirm) return
    confirmationLock.current = true
    setPending(true)
    setConfirmationError('')
    try {
      await onConfirm()
    } catch (error) {
      setConfirmationError(getErrorMessage(error))
    } finally {
      confirmationLock.current = false
      setPending(false)
    }
  }
  const linkedDeliveries = incomingDeliveries.filter(
    (delivery) => delivery.purchaseOrderId === order.id && delivery.status !== 'CANCELLED',
  )
  const warehouseNames = [
    ...new Set(
      linkedDeliveries.map(
        (delivery) =>
          warehouses.find((warehouse) => warehouse.id === delivery.warehouseId)?.name ||
          `Warehouse #${delivery.warehouseId}`,
      ),
    ),
  ]
  const columns: ColumnDef<PurchaseOrderItemRecord>[] = [
    {
      accessorKey: 'inventoryItemId',
      header: 'Product / Material',
      cell: ({ row }) => (
        <OverflowValue value={products.find((product) => product.id === row.inventoryItemId)?.name || `Item #${row.inventoryItemId}`} />
      ),
    },
    {
      accessorKey: 'quantity',
      header: 'Quantity',
      align: 'right',
      cell: ({ row }) => (
        <span>
          {row.quantity}{' '}
          {formatProductUnit(products.find((product) => product.id === row.inventoryItemId)?.unit)}
        </span>
      ),
    },
    {
      accessorKey: 'unitPrice',
      header: 'Unit Price',
      align: 'right',
      cell: ({ row }) => currency(row.unitPrice),
    },
    {
      accessorKey: 'discountAmount',
      header: 'Discount',
      align: 'right',
      cell: ({ row }) => currency(row.discountAmount),
    },
    {
      accessorKey: 'taxAmount',
      header: 'Tax',
      align: 'right',
      cell: ({ row }) => currency(row.taxAmount),
    },
    {
      accessorKey: 'totalAmount',
      header: 'Amount',
      align: 'right',
      cell: ({ row }) => currency(row.totalAmount),
    },
  ]

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent closeDisabled={busy} className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order.orderNumber}</DialogTitle>
          <DialogDescription>
            Products, quantities, prices, and supplier details for this purchase order.
          </DialogDescription>
        </DialogHeader>
        <div>{statusBadge}</div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 [&>div]:min-w-0 [&_dt]:text-ui [&_dd]:text-sm [&_dd]:[overflow-wrap:anywhere]">
          <div>
            <dt className="text-muted-foreground">Supplier</dt>
            <dd className="font-medium">{supplier?.name || (order.supplierId == null ? 'No supplier assigned' : `Supplier #${order.supplierId}`)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Supplier Reference</dt>
            <dd>{order.externalReference || 'Not set'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Ordered Date</dt>
            <dd>{new Date(order.orderedAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Expected Date</dt>
            <dd>
              {order.expectedAt ? new Date(order.expectedAt).toLocaleDateString() : 'Not set'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Destination Warehouse</dt>
            <dd>{warehouseNames.join(', ') || 'To Be Confirmed'}</dd>
          </div>
          {order.notes && (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Notes</dt>
              <dd className="whitespace-pre-wrap break-words">{order.notes}</dd>
            </div>
          )}
        </dl>
        <DataTable
          data={order.items || []}
          columns={columns}
          pagination={false}
          tableClassName="min-w-[640px] table-fixed tabular-nums"
        />
        <p className="text-right text-sm font-semibold tabular-nums">
          Total:{' '}
          {formatPurchaseMoney(storedPurchaseTotal(order.items || []))}
        </p>
        <p className="text-xs text-muted-foreground">
          Choose the destination warehouse when scheduling an incoming delivery. Incoming deliveries
          use the items from this purchase order.
        </p>
        {linkedDeliveries.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Incoming Deliveries:{' '}
            {linkedDeliveries.map((delivery) => delivery.deliveryNumber).join(', ')}
          </p>
        )}
        {onConfirm && order.status === 'DRAFT' && (
          <Button size="sm" disabled={busy} onClick={() => void confirm()}>
            {busy ? 'Confirming...' : 'Confirm Purchase Order'}
          </Button>
        )}
        {confirmationError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{confirmationError}</AlertDescription>
          </Alert>
        )}
        <PurchaseReceivingProgress
          order={order}
          deliveries={incomingDeliveries}
          products={products}
          isLoading={receivingLoading}
          unavailable={receivingUnavailable}
          onRetry={onRetryReceiving}
        />
        {onExportReceipt && order.status !== 'DRAFT' && order.status !== 'CANCELLED' && (
          <Button size="sm" variant="outline" onClick={onExportReceipt}>
            Export Receipt
          </Button>
        )}
        {onNavigateToDeliveries && ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status) && (
          <Button size="sm" onClick={() => onNavigateToDeliveries(order.id)}>
            Incoming Deliveries
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
