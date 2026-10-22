import { formatProductUnit } from '@/lib/product-unit'
import { DataTable } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { DeliveryRow } from '@/features/logistics/delivery-workflow'
import { DELIVERY_STATUS_LABELS } from '@/features/logistics/delivery-workflow'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

export function IncomingDeliveryStatusBadge({
  status,
}: {
  status: IncomingDeliveryRecord['status']
}) {
  return (
    <Badge
      variant="outline"
      className={
        status === 'COMPLETED'
          ? 'bg-status-success text-status-success-foreground border-status-success-foreground/30'
          : status === 'CANCELLED'
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted/50'
      }
    >
      {DELIVERY_STATUS_LABELS[status]}
    </Badge>
  )
}

export function IncomingDeliveryDetailModal({
  row,
  purchaseOrders,
  products,
  onClose,
}: {
  row?: Extract<DeliveryRow, { type: 'Incoming' }>
  purchaseOrders: PurchaseOrderRecord[]
  products: InventoryItemResponse[]
  onClose: () => void
}) {
  const delivery = row?.record
  return (
    <Dialog open={row !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{delivery?.deliveryNumber || 'Incoming Delivery'}</DialogTitle>
          <DialogDescription>
            {row?.relatedOrder} · {row?.party}
          </DialogDescription>
        </DialogHeader>
        {delivery && (
          <>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Destination Warehouse</p>
                <p className="mt-1 font-medium">{row?.warehouse}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <div className="mt-1">
                  <IncomingDeliveryStatusBadge status={delivery.status} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Scheduled / Expected</p>
                <p className="mt-1">{DeliveryUtils.formatDateTime(row?.date)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Supplier Reference</p>
                <p className="mt-1">{delivery.supplierReference || '—'}</p>
              </div>
            </div>
            <DataTable
              data={delivery.items}
              getRowKey={(item) => item.id}
              pagination={false}
              columns={[
                {
                  id: 'product',
                  header: 'Product',
                  cell: ({ row }) => {
                    const poItem = purchaseOrders
                      .find((order) => order.id === delivery.purchaseOrderId)
                      ?.items.find((item) => item.id === row.purchaseOrderItemId)
                    const product = products.find(
                      (product) => product.id === poItem?.inventoryItemId,
                    )
                    return product
                      ? `${product.name}${product.variety ? ` · ${product.variety}` : ''}`
                      : `Order Item #${row.purchaseOrderItemId}`
                  },
                },
                {
                  id: 'quantity',
                  header: 'Quantity',
                  accessorKey: 'receivedQuantity',
                  align: 'right',
                  cell: ({ row }) => {
                    const poItem = purchaseOrders
                      .find((order) => order.id === delivery.purchaseOrderId)
                      ?.items.find((item) => item.id === row.purchaseOrderItemId)
                    const product = products.find(
                      (product) => product.id === poItem?.inventoryItemId,
                    )
                    return (
                      <span>
                        {row.receivedQuantity} {formatProductUnit(product?.unit)}
                      </span>
                    )
                  },
                },
              ]}
            />
            {delivery.notes && <p className="text-sm whitespace-pre-wrap">{delivery.notes}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
