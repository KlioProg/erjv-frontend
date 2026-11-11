import { formatProductUnit } from '@/lib/product-unit'
import { Button } from '@/components/ui/button'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { incomingOrderSchedulingIssue } from '@/features/logistics/incoming-scheduling'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import type { DeliveryAction, DeliveryRow } from '@/features/logistics/delivery-workflow'
import { DELIVERY_STATUS_LABELS, getDeliveryActions } from '@/features/logistics/delivery-workflow'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import { MovementDetailFields, MovementDetailHeader } from './MovementDetailLayout'

export function IncomingDeliveryStatusBadge({
  status,
}: {
  status: IncomingDeliveryRecord['status']
}) {
  return (
    <StatusBadge
      label={DELIVERY_STATUS_LABELS[status]}
      tone={
        status === 'COMPLETED'
          ? 'success'
          : status === 'CANCELLED'
            ? 'destructive'
            : status === 'SCHEDULED'
              ? 'info'
              : 'neutral'
      }
    />
  )
}

export function IncomingDeliveryDetailModal({
  row,
  purchaseOrders,
  products,
  onClose,
  canManage = false,
  onAction,
  onViewOrder,
  refreshing,
  refreshError,
  onRefresh,
}: {
  row?: Extract<DeliveryRow, { type: 'Incoming' }>
  purchaseOrders: PurchaseOrderRecord[]
  products: InventoryItemResponse[]
  onClose: () => void
  canManage?: boolean
  onAction?: (row: Extract<DeliveryRow, { type: 'Incoming' }>, action: DeliveryAction) => void
  onViewOrder?: (row: Extract<DeliveryRow, { type: 'Incoming' }>) => void
  refreshing?: boolean
  refreshError?: string
  onRefresh?: () => void
}) {
  const delivery = row?.record
  const purchaseOrder = purchaseOrders.find((order) => order.id === delivery?.purchaseOrderId)
  const schedulingIssue =
    delivery?.status === 'DRAFT'
      ? (row?.schedulingIssue ?? incomingOrderSchedulingIssue(row?.purchaseOrderStatus))
      : null
  const nextAction =
    row && canManage && onAction
      ? getDeliveryActions(row).find((action) => action === 'schedule' || action === 'receive')
      : undefined
  const nextActionLabel =
    nextAction === 'schedule'
      ? 'Continue Scheduling'
      : nextAction === 'receive'
        ? 'Receive Goods'
        : undefined
  const showsReceipt = delivery?.status === 'COMPLETED' && delivery.outcome !== 'NO_RECEIPT'
  const detailItems = delivery
    ? purchaseOrder?.items.length
      ? purchaseOrder.items.map((item) => ({
          id: item.id,
          purchaseOrderItemId: item.id,
          inventoryItemId: item.inventoryItemId,
          expectedQuantity: item.quantity,
          receipt: delivery.items.find((receipt) => receipt.purchaseOrderItemId === item.id),
        }))
      : delivery.items.map((item) => ({
          id: item.id,
          purchaseOrderItemId: item.purchaseOrderItemId,
          inventoryItemId: item.purchaseOrderItem?.inventoryItemId,
          expectedQuantity: item.purchaseOrderItem?.quantity,
          receipt: item,
        }))
    : []
  const columns: ColumnDef<(typeof detailItems)[number]>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: ({ row: item }) => {
        const product = products.find((candidate) => candidate.id === item.inventoryItemId)
        return (
          <div className="flex min-w-0 flex-col gap-0.5 [overflow-wrap:anywhere]">
            <p className="text-sm font-medium">
              {product?.name || `Order Item #${item.purchaseOrderItemId}`}
              {product?.variety ? ` · ${product.variety}` : ''}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatProductUnit(product?.unit, 'Unit unavailable')}
            </p>
          </div>
        )
      },
    },
    {
      id: 'expected',
      header: 'Expected',
      align: 'right',
      cell: ({ row: item }) => <span className="tabular-nums">{item.expectedQuantity ?? '—'}</span>,
    },
    ...(showsReceipt
      ? (
          [
            [
              'received',
              'Received',
              (item: (typeof detailItems)[number]) => item.receipt?.receivedQuantity,
            ],
            [
              'accepted',
              'Accepted',
              (item: (typeof detailItems)[number]) => item.receipt?.acceptedQuantity,
            ],
            [
              'damaged',
              'Damaged',
              (item: (typeof detailItems)[number]) => item.receipt?.damagedQuantity,
            ],
          ] as const
        ).map(([id, header, getQuantity]): ColumnDef<(typeof detailItems)[number]> => ({
          id,
          header,
          align: 'right',
          cell: ({ row: item }) => <span className="tabular-nums">{getQuantity(item) ?? '—'}</span>,
        }))
      : []),
  ]
  const detailFields =
    delivery && row
      ? [
          { label: 'Supplier', value: row.party },
          { label: 'Receiving warehouse', value: row.warehouse },
          {
            label: 'Purchase order',
            value: onViewOrder ? (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 font-medium"
                aria-label={`View purchase order ${row.relatedOrder}`}
                onClick={() => onViewOrder(row)}
              >
                {row.relatedOrder}
              </Button>
            ) : (
              row.relatedOrder
            ),
          },
          { label: 'Scheduled / expected', value: DeliveryUtils.formatDateTime(row.date) },
          ...(delivery.completedAt
            ? [{ label: delivery.outcome === 'NO_RECEIPT' ? 'Outcome recorded at' : 'Received at', value: DeliveryUtils.formatDateTime(delivery.completedAt) }]
            : []),
          ...(delivery.supplierReference
            ? [{ label: 'Supplier reference', value: delivery.supplierReference }]
            : []),
        ]
      : []
  return (
    <Dialog open={row !== undefined} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[min(880px,90dvh)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl [&>button:last-child]:grid [&>button:last-child]:size-8 [&>button:last-child]:place-items-center pointer-coarse:[&>button:last-child]:size-11">
        <MovementDetailHeader
          title={delivery?.deliveryNumber || 'Incoming Delivery'}
          description="Incoming delivery record"
          status={delivery && <IncomingDeliveryStatusBadge status={delivery.status} />}
          className="px-5 py-5 pr-14 sm:pl-6"
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
          {delivery && (
            <div className="flex flex-col gap-5">
              {refreshing && <p role="status" className="text-sm text-muted-foreground">Refreshing incoming delivery…</p>}
              {refreshError && <Alert variant="destructive"><AlertDescription>{refreshError} <Button variant="link" onClick={onRefresh}>Refresh delivery</Button></AlertDescription></Alert>}
              {delivery.status === 'SCHEDULED' && <p className="text-sm text-muted-foreground">Arrival scheduled. Return here to Receive Goods when the supplier arrives.</p>}
              {schedulingIssue && (
                <Alert>
                  <AlertTitle>{schedulingIssue.title}</AlertTitle>
                  <AlertDescription>
                    {schedulingIssue.message} This draft remains saved for record purposes.
                  </AlertDescription>
                </Alert>
              )}
              <section aria-label="Movement details">
                <MovementDetailFields fields={detailFields} />
              </section>
              <section
                aria-labelledby="incoming-items-heading"
                className="border-t border-border pt-4"
              >
                <h2 id="incoming-items-heading" className="mb-3 text-base font-semibold">
                  {showsReceipt ? 'Receipt quantities' : 'Expected items'} ({detailItems.length})
                </h2>
                <DataTable
                  data={detailItems}
                  getRowKey={(item) => item.id}
                  pagination={false}
                  columns={columns}
                  appearance="subtle"
                  tableClassName="w-full"
                  emptyContent="No order item details are available."
                />
              </section>
              {delivery.status === 'COMPLETED' && (
                <section
                  aria-labelledby="incoming-receipt-result-heading"
                  className="border-t border-border pt-4"
                >
                  <h2 id="incoming-receipt-result-heading" className="mb-1 text-base font-semibold">
                    Receipt result
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {delivery.outcome === 'NO_RECEIPT'
                      ? 'No goods were received; inventory was not updated.'
                      : delivery.outcome === 'RECEIVED_WITH_DAMAGE'
                        ? 'Received with damage. Damaged quantities are shown above.'
                        : 'Goods were received and recorded above.'}
                  </p>
                  {delivery.outcome === 'NO_RECEIPT' && delivery.noReceiptReason && (
                    <p className="mt-1 text-sm [overflow-wrap:anywhere]">
                      Reason: {delivery.noReceiptReason}
                    </p>
                  )}
                </section>
              )}
              {delivery.notes && (
                <section
                  aria-labelledby="incoming-notes-heading"
                  className="border-t border-border pt-4"
                >
                  <h2
                    id="incoming-notes-heading"
                    className="mb-1 text-base font-semibold text-muted-foreground"
                  >
                    Additional details
                  </h2>
                  <p className="whitespace-pre-wrap text-sm [overflow-wrap:anywhere]">
                    {delivery.notes}
                  </p>
                </section>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 flex-row justify-end border-t border-border px-5 py-3 sm:px-6">
          {nextAction && nextActionLabel && row && (
            <Button
              size="sm"
              className="pointer-coarse:min-h-11"
              aria-label={`${nextActionLabel} ${row.reference}`}
              onClick={() => onAction?.(row, nextAction)}
            >
              {nextActionLabel}
            </Button>
          )}
          <Button variant="outline" size="sm" className="pointer-coarse:min-h-11" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
