import { useRef, useState } from 'react'
import { IncomingIssueCorrection } from '../IncomingIssueCorrection'
import { DeliveryDetailFooter } from './DeliveryDetailFooter'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { ProductTableLabel, ProductTableQuantity } from '@/components/common/ProductTableCells'
import { Button } from '@/components/ui/button'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { LifecycleProgress } from '@/components/ui/LifecycleProgress'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { incomingOrderSchedulingIssue } from '@/features/logistics/incoming-scheduling'
import { Dialog, DialogContent } from '@/components/ui/dialog'
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
  canConfirmPurchaseOrder = false,
  onAction,
  onViewOrder,
  refreshing,
  refreshError,
  workflowError,
  onRefresh,
  warehouses = [],
  operationalFallback = false,
}: {
  row?: Extract<DeliveryRow, { type: 'Incoming' }>
  purchaseOrders: PurchaseOrderRecord[]
  products: InventoryItemResponse[]
  onClose: () => void
  canConfirmPurchaseOrder?: boolean
  canManage?: boolean
  onAction?: (row: Extract<DeliveryRow, { type: 'Incoming' }>, action: DeliveryAction) => void
  onViewOrder?: (row: Extract<DeliveryRow, { type: 'Incoming' }>) => void
  refreshing?: boolean
  refreshError?: string
  workflowError?: string
  onRefresh?: () => Promise<unknown> | void
  warehouses?: Warehouse[]
  operationalFallback?: boolean
}) {
  const [editContext, setEditContext] = useState<{
    delivery: IncomingDeliveryRecord
    target: 'warehouse' | 'schedule'
  } | null>(null)
  const editing = !!editContext
  const [correctionPending, setCorrectionPending] = useState(false)
  const [reviewError, setReviewError] = useState('')
  async function recheck() {
    setReviewError('')
    try {
      await onRefresh?.()
    } catch {
      setReviewError('The current delivery could not be refreshed. Recheck it before continuing.')
    }
  }
  const issueRef = useRef<HTMLDivElement>(null)
  const delivery = row?.record
  const purchaseOrder = purchaseOrders.find((order) => order.id === delivery?.purchaseOrderId)
  const schedulingIssue =
    delivery?.status === 'DRAFT'
      ? (row?.schedulingIssue ?? incomingOrderSchedulingIssue(row?.purchaseOrderStatus))
      : null
  const correctionTarget = schedulingIssue?.target
  const editable = correctionTarget === 'warehouse' || correctionTarget === 'schedule'
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
        return <ProductTableLabel product={product} fallback={`Order Item #${item.purchaseOrderItemId}`} />
      },
    },
    {
      id: 'expected',
      header: 'Expected',
      align: 'right',
      cell: ({ row: item }) => <ProductTableQuantity value={item.expectedQuantity} unit={products.find((product) => product.id === item.inventoryItemId)?.unit} />,
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
          cell: ({ row: item }) => <ProductTableQuantity value={getQuantity(item)} unit={products.find((product) => product.id === item.inventoryItemId)?.unit} />,
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
            ? [
                {
                  label: delivery.outcome === 'NO_RECEIPT' ? 'Outcome recorded at' : 'Received at',
                  value: DeliveryUtils.formatDateTime(delivery.completedAt),
                },
              ]
            : []),
          ...(delivery.supplierReference
            ? [{ label: 'Supplier reference', value: delivery.supplierReference }]
            : []),
        ]
      : []
  return (
    <Dialog
      open={row !== undefined}
      onOpenChange={(open) => !open && !correctionPending && onClose()}
    >
      <DialogContent
        closeDisabled={correctionPending}
        onOpenAutoFocus={(event) => {
          if (schedulingIssue) {
            event.preventDefault()
            issueRef.current?.focus()
          }
        }}
        className="flex max-h-[min(880px,90dvh)] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl [&>button:last-child]:grid [&>button:last-child]:size-8 [&>button:last-child]:place-items-center pointer-coarse:[&>button:last-child]:size-11"
      >
        <MovementDetailHeader
          title={delivery?.deliveryNumber || 'Incoming Delivery'}
          description="Incoming delivery record"
          status={delivery && <IncomingDeliveryStatusBadge status={delivery.status} />}
          className="px-5 py-4 pr-14 sm:pl-6"
        />
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">
          {delivery && (
            <div className="flex flex-col gap-3">
              {delivery.status !== 'CANCELLED' && <LifecycleProgress label="Incoming delivery progress" milestones={[
                { id: 'draft', label: 'Draft', state: delivery.status === 'DRAFT' ? 'current' : 'complete' },
                { id: 'arrival', label: 'Awaiting receipt', state: delivery.status === 'DRAFT' ? 'upcoming' : delivery.status === 'SCHEDULED' ? 'current' : 'complete' },
                { id: 'receipt', label: 'Outcome recorded', state: delivery.status === 'COMPLETED' ? 'complete' : 'upcoming', detail: delivery.completedAt ? DeliveryUtils.formatDateTime(delivery.completedAt) : undefined },
              ]} />}
              {workflowError && <Alert variant="destructive"><AlertDescription>{workflowError}</AlertDescription></Alert>}
              {operationalFallback && canManage && row && onAction && !schedulingIssue && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>This record is outside the current table. Continue here.</span>
                  {getDeliveryActions(row).filter((action) => action === 'schedule' || action === 'receive').map((action) => (
                    <Button key={action} variant="outline" size="sm" disabled={refreshing || !!refreshError || editing} onClick={() => onAction(row, action)}>{action === 'schedule' ? 'Schedule Arrival' : 'Receive Goods'}</Button>
                  ))}
                </div>
              )}
              {refreshing && (
                <p role="status" className="text-sm text-muted-foreground">
                  Refreshing incoming delivery…
                </p>
              )}
              {reviewError && (
                <p role="alert" className="text-sm text-destructive">
                  {reviewError}
                </p>
              )}
              {refreshError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {refreshError}{' '}
                    <Button variant="link" onClick={() => void recheck()}>
                      Refresh delivery
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {delivery.status === 'SCHEDULED' && (
                <p className="text-sm text-muted-foreground">
                  Arrival scheduled. Use Receive Goods in the delivery table when the supplier arrives.
                </p>
              )}
              {schedulingIssue && (
                <Alert ref={issueRef} tabIndex={-1} aria-label="Delivery issue">
                  <AlertTitle>{schedulingIssue.title}</AlertTitle>
                  <AlertDescription>
                    {schedulingIssue.message}
                    {row?.purchaseOrderStatus === 'DRAFT' && canManage && !canConfirmPurchaseOrder && <p>An administrator must confirm this purchase order after its draft details are complete.</p>}
                    {!canManage && (
                      <p>
                        Ask an administrator or manager to make corrections. Locked orders cannot be
                        edited.
                      </p>
                    )}
                    {canManage && editable && !editing && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={refreshing || !!refreshError}
                        onClick={() =>
                          delivery &&
                          editable &&
                          setEditContext({ delivery, target: correctionTarget })
                        }
                      >
                        Correct {correctionTarget === 'warehouse' ? 'Warehouse' : 'Arrival Date'}
                      </Button>
                    )}
                    {(correctionTarget === 'order' || correctionTarget === 'refresh') &&
                      onViewOrder &&
                      row && (
                        <Button size="sm" variant="outline" onClick={() => onViewOrder(row)}>
                          Review Purchase Order
                        </Button>
                      )}
                    <Button
                      size="sm"
                      variant="link"
                      disabled={refreshing || editing}
                      onClick={() => {
                        void recheck()
                      }}
                    >
                      Recheck Issue
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {editContext && canManage && delivery && (
                <IncomingIssueCorrection
                  delivery={editContext.delivery}
                  currentRevision={delivery.revision}
                  target={editContext.target}
                  warehouses={warehouses}
                  onSaved={async () => {
                    await onRefresh?.()
                    setEditContext(null)
                  }}
                  onBusyChange={setCorrectionPending}
                  onCancel={() => setEditContext(null)}
                />
              )}
              <section aria-label="Movement details">
                <MovementDetailFields fields={detailFields} className="gap-y-2" />
              </section>
              <section
                aria-labelledby="incoming-items-heading"
                className="border-t border-border pt-3"
              >
                <h2 id="incoming-items-heading" className="mb-2 text-sm font-semibold">
                  {showsReceipt ? 'Receipt quantities' : 'Expected items'} ({detailItems.length})
                </h2>
                <DataTable
                  density="compact"
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
                  className="border-t border-border pt-3"
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
                  className="border-t border-border pt-3"
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
        <DeliveryDetailFooter onClose={onClose} busy={correctionPending || refreshing}
          onCancel={row && canManage && !editing && !refreshError && onAction && getDeliveryActions(row).includes('cancel')
            ? () => onAction(row, 'cancel') : undefined} />
      </DialogContent>
    </Dialog>
  )
}
