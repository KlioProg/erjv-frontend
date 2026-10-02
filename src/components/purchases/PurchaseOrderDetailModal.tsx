import type { ReactNode } from 'react'
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
  statusBadge: ReactNode
  onClose: () => void
  onNavigateToDeliveries?: () => void
}

const currency = (value: string | number) =>
  `₱${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2 })}`

export function PurchaseOrderDetailModal({
  order,
  supplier,
  products,
  warehouses,
  incomingDeliveries,
  statusBadge,
  onClose,
  onNavigateToDeliveries,
}: Props) {
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
        <span>
          {products.find((product) => product.id === row.inventoryItemId)?.name ||
            `Item #${row.inventoryItemId}`}
        </span>
      ),
    },
    { accessorKey: 'quantity', header: 'Quantity', align: 'right' },
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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{order.orderNumber}</DialogTitle>
          <DialogDescription>
            Products, quantities, prices, and supplier details for this purchase order.
          </DialogDescription>
        </DialogHeader>
        <div>{statusBadge}</div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="text-muted-foreground">Supplier</dt>
            <dd>{supplier?.name || `Supplier #${order.supplierId}`}</dd>
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
        <DataTable data={order.items || []} columns={columns} pagination={false} />
        <p className="text-right text-sm font-semibold">
          Total:{' '}
          {currency((order.items || []).reduce((sum, item) => sum + Number(item.totalAmount), 0))}
        </p>
        <p className="text-xs text-muted-foreground">
          Choose the destination warehouse in Inbound Receiving. Incoming deliveries use the items
          from this purchase order.
        </p>
        {linkedDeliveries.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Incoming Deliveries:{' '}
            {linkedDeliveries.map((delivery) => delivery.deliveryNumber).join(', ')}
          </p>
        )}
        {onNavigateToDeliveries && ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status) && (
          <Button variant="outline" size="sm" onClick={onNavigateToDeliveries}>
            Go to Inbound Receiving
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
