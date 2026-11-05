import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DataTable } from '@/components/ui/data-table'
import {
  useIncomingReceiving,
  type ReceiptOutcome,
} from '@/features/logistics/use-incoming-receiving'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import { useIncomingDeliveryById } from '@/features/logistics/incoming-deliveries.hooks'
import { deliveryFormStyles } from './shared/delivery-form.styles'

const outcomes = [
  ['all', 'All remaining goods received in good condition'],
  ['partial', 'Some goods received or damaged'],
  ['none', 'No goods received'],
] as const

export function ReceiveProductsModal(props: {
  onClose: () => void
  onSaved?: (saved: IncomingDeliveryRecord) => void
} & ({ delivery: IncomingDeliveryRecord; deliveryId?: never } | { deliveryId: number; delivery?: never })) {
  const current = useIncomingDeliveryById(props.deliveryId)
  const delivery = props.delivery ?? current.data
  if (delivery) return <ReceiveProductsForm key={delivery.id} delivery={delivery} onClose={props.onClose} onSaved={props.onSaved} />
  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive Goods</DialogTitle>
          <DialogDescription>{current.isError ? 'Unable to load delivery. Close and retry.' : 'Loading delivery…'}</DialogDescription>
        </DialogHeader>
        {current.isError && <Alert variant="destructive"><AlertDescription>Delivery details could not be loaded.</AlertDescription></Alert>}
        {current.isError && <Button type="button" disabled={current.isFetching} onClick={() => void current.refetch()}>Refresh receipt data</Button>}
      </DialogContent>
    </Dialog>
  )
}

function ReceiveProductsForm({
  delivery,
  onClose,
  onSaved,
}: {
  delivery: IncomingDeliveryRecord
  onClose: () => void
  onSaved?: (saved: IncomingDeliveryRecord) => void
}) {
  const form = useIncomingReceiving(delivery, onClose, onSaved)
  const [reviewSignature, setReviewSignature] = useState<string | null>(null)
  const signature = JSON.stringify([form.signature, form.outcome, form.counts, form.reason])
  const reviewing = reviewSignature === signature && !form.error && !form.fullNeedsReview
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus()
  }, [reviewing])
  const reviewRows = form.rows.map((row) => {
    const entry = form.receiptItems.find((item) => item.purchaseOrderItemId === row.item.id)
    const received = parseStockCents(entry?.receivedQuantity ?? '0')!
    const damaged = parseStockCents(entry?.damagedQuantity ?? '0')!
    return { ...row, received, damaged, accepted: received - damaged,
      notReceived: row.outstanding === null ? null : row.outstanding > received ? row.outstanding - received : 0n }
  })
  const busy = form.checking || form.pending
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent
        closeDisabled={busy}
        className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="shrink-0 px-6 pr-14 pt-6 text-left">
          <DialogTitle>Receive Goods</DialogTitle>
          <DialogDescription>
            {delivery.deliveryNumber} / {form.purchase?.orderNumber ?? 'Purchase order unavailable'}
            {' · '}Saving a receipt updates warehouse stock.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col overflow-hidden"
          onSubmit={async (event) => {
            event.preventDefault()
            if (!form.canSubmit || busy) return
            if (!reviewing) setReviewSignature(signature)
            else {
              await form.submit()
              setReviewSignature(null)
            }
          }}
        >
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 pb-6">
            <dl className="grid min-w-0 gap-3 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Supplier</dt>
                <dd className="break-words font-medium">
                  {form.supplier?.name ??
                    (form.purchase?.supplierId ? 'Supplier unavailable' : 'No supplier assigned')}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs text-muted-foreground">Receiving warehouse</dt>
                <dd className="break-words font-medium">
                  {form.warehouse?.name ?? 'Warehouse unavailable'}
                </dd>
              </div>
            </dl>
            {(form.error || form.loadFailed) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {form.error ||
                    'Current delivery or purchase order could not be loaded. Close and retry.'}
                </AlertDescription>
              </Alert>
            )}
            {!form.canReceive && <Alert><AlertDescription>You do not have permission to confirm incoming receipts.</AlertDescription></Alert>}
            <Button type="button" variant="link" disabled={busy} onClick={() => void form.refresh()}>
              Refresh receipt data
            </Button>
            {form.latest && form.latest.status !== 'SCHEDULED' && (
              <Alert>
                <AlertDescription>
                  Only a scheduled delivery can be received. Close and review its current status.
                </AlertDescription>
              </Alert>
            )}
            {form.regularUnavailable && !form.loading && (
              <p role="alert" className="text-sm text-muted-foreground">
                Outstanding product information is unavailable. Reload before recording received
                quantities.
              </p>
            )}
            {form.outcome !== 'partial' && !reviewing && (
              <div className="flex min-w-0 flex-col gap-2" aria-label="Outstanding products">
                {form.outcome === 'all' && (
                  <p className="text-sm font-medium">To receive in good condition</p>
                )}
                {form.rows.map(({ item, product, outstanding }, index) => (
                  <div
                    key={`${item.id}-${index}`}
                    className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b py-2 text-sm"
                  >
                    <span className="min-w-0 break-words font-medium">
                      {product?.name ?? 'Product unavailable'}
                      {product?.variety && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          {product.variety}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      {outstanding === null
                        ? 'Quantity unavailable'
                        : `${formatStockCents(outstanding)} ${product?.unit ?? ''} outstanding`}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <fieldset hidden={reviewing} disabled={form.disabled || reviewing} className="flex min-w-0 flex-col gap-3">
              <legend className="mb-3 text-sm font-medium">
                What was received?
              </legend>
              {outcomes.map(([value, label]) => (
                <Label key={value} className={deliveryFormStyles.outcomeChoice}>
                  <input
                    type="radio"
                    name="receipt-outcome"
                    value={value}
                    checked={form.outcome === value}
                    disabled={value !== 'none' && form.regularUnavailable}
                    onChange={() => form.chooseOutcome(value)}
                    className={deliveryFormStyles.outcomeRadio}
                  />
                  <span className="min-w-0 leading-5">{label}</span>
                </Label>
              ))}
            </fieldset>
            {!reviewing && <p className="text-xs text-muted-foreground">
              If the delivery is only delayed and the result is unknown, close this form and keep it scheduled.
            </p>}
            {form.outcome === 'all' && !reviewing && (
              <Button type="button" variant="outline" disabled={form.disabled || form.fullNeedsReview} onClick={() => form.chooseOutcome('partial')}>
                Edit Quantities
              </Button>
            )}
            {form.pendingOutcome && (
              <Alert>
                <AlertDescription className="flex flex-col gap-3">
                  <p>
                    Use the selected outcome instead? Your entered quantities will be kept if you
                    return to partial receiving.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => form.setPendingOutcome(null)}
                    >
                      Keep current outcome
                    </Button>
                    <Button
                      type="button"
                      onClick={() => void form.applyOutcome(form.pendingOutcome as ReceiptOutcome)}
                    >
                      Use selected outcome
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {form.fullNeedsReview && (
              <Button
                type="button"
                variant="outline"
                disabled={form.disabled}
                onClick={() => void form.applyOutcome('all')}
              >
                Recheck full receipt
              </Button>
            )}
            {form.outcome === 'partial' && (
              <fieldset hidden={reviewing} disabled={form.disabled || form.regularUnavailable || reviewing} className="min-w-0">
                <p className="mb-3 text-xs text-muted-foreground">
                  Received includes damaged goods. Leave products not received blank or enter zero.
                </p>
                <DataTable
                  data={form.rows}
                  pagination={false}
                  getRowKey={(row, index) => `${row.item.id}-${index}`}
                  tableClassName="table-fixed"
                  className="[&_td]:whitespace-normal [&_th]:whitespace-normal max-sm:[&_thead]:sr-only max-sm:[&_tbody]:block max-sm:[&_tr]:grid max-sm:[&_tr]:grid-cols-2 max-sm:[&_td:first-child]:col-span-2 max-sm:[&_td]:block max-sm:[&_td]:min-w-0"
                  columns={[
                    {
                      id: 'product',
                      header: 'Product',
                      cell: ({ row }) => (
                        <div className="min-w-0">
                          <p className="break-words font-medium">
                            {row.product?.name ?? 'Product unavailable'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.product?.variety} {row.product?.unit}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {row.outstanding === null
                              ? 'Quantity unavailable'
                              : `${formatStockCents(row.outstanding)} ${row.product?.unit ?? ''} outstanding`}
                          </p>
                        </div>
                      ),
                    },
                    ...(['received', 'damaged'] as const).map((field) => ({
                      id: field,
                      header: field === 'received' ? 'Received' : 'Damaged',
                      className: 'w-full sm:w-[28%]',
                      headerClassName: 'sm:w-[28%]',
                      cell: ({
                        row,
                        index,
                      }: {
                        row: (typeof form.rows)[number]
                        index: number
                      }) => {
                        const label = field === 'received' ? 'Received now' : 'Damaged now'
                        const error = form.errors[row.item.id]?.[field]
                        const errorId = `receipt-${field}-${index}-error`
                        return (
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="text-xs text-muted-foreground sm:hidden">{label}</span>
                            <Input
                              inputMode="decimal"
                              aria-label={`${label} for ${row.product?.name ?? 'product'} (${index + 1})`}
                              aria-invalid={!!error}
                              aria-describedby={error ? errorId : undefined}
                              value={
                                form.counts[row.item.id]?.[field] ??
                                (field === 'damaged' ? '0' : '')
                              }
                              onChange={(event) =>
                                form.change(row.item.id, field, event.target.value)
                              }
                              className="min-w-0 text-right tabular-nums"
                            />
                            {error && (
                              <p id={errorId} role="alert" className="text-xs text-destructive">
                                {error}
                              </p>
                            )}
                          </div>
                        )
                      },
                    })),
                  ]}
                />
              </fieldset>
            )}
            {form.outcome === 'none' && (
              <div hidden={reviewing} className="flex flex-col gap-2">
                <Label htmlFor="no-receipt-reason">Reason no goods arrived</Label>
                <Input
                  id="no-receipt-reason"
                  required
                  disabled={form.disabled || reviewing}
                  value={form.reason}
                  onChange={(event) => form.setReason(event.target.value)}
                  placeholder="Supplier did not deliver"
                />
              </div>
            )}
            {reviewing && (
              <section aria-label="Review receipt" className="flex flex-col gap-3">
                <h3 ref={reviewHeading} tabIndex={-1} className="text-sm font-medium">Review Receipt</h3>
                <DataTable data={reviewRows} pagination={false} getRowKey={(row) => row.item.id}
                  columns={[
                    { id: 'product', header: 'Product', cell: ({ row }) => `${row.product?.name ?? 'Product unavailable'} (${row.product?.unit ?? 'Unit unavailable'})` },
                    ...([['outstanding', 'Expected'], ['received', 'Received'], ['accepted', 'Good condition'], ['damaged', 'Damaged'], ['notReceived', 'Not received']] as const).map(([field, header]) => ({
                      id: field, header, align: 'right' as const, cell: ({ row }: { row: (typeof reviewRows)[number] }) => formatStockCents(row[field]),
                    })),
                  ]}
                />
                {form.outcome === 'none' && <p className="text-sm">No goods received. Reason: {form.reason.trim()}</p>}
                <p className="text-xs text-muted-foreground">
                  {form.outcome === 'none'
                    ? 'This records that no goods were received and completes this delivery without adding stock. If the arrival is only delayed, close this form and leave the delivery scheduled.'
                    : 'Saving records the actual arrival and updates inventory. Good-condition goods are accepted; damaged goods are recorded separately. Completing this delivery does not necessarily complete the purchase order.'}
                </p>
              </section>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            {reviewing && <Button type="button" variant="outline" disabled={busy} onClick={() => setReviewSignature(null)}>Back</Button>}
            <Button type="submit" disabled={!form.canSubmit}>
              {busy
                ? 'Checking receipt...'
                : !reviewing ? 'Review Receipt'
                : form.outcome === 'none'
                  ? 'Record No Receipt'
                  : 'Save Receipt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
