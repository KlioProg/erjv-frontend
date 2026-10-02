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
          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
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
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Destination Warehouse</p>
                <p className="mt-1 font-semibold">{row?.warehouse}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <div className="mt-1">
                  <IncomingDeliveryStatusBadge status={delivery.status} />
                </div>
              </div>
              <div>
                <p className="text-muted-foreground">Scheduled / Expected</p>
                <p className="mt-1">{DeliveryUtils.formatDateTime(row?.date)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Supplier Reference</p>
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
                },
              ]}
            />
            {delivery.notes && <p className="text-xs whitespace-pre-wrap">{delivery.notes}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
