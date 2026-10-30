import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DataTable } from '@/components/ui/data-table'
import {
  useIncomingReceiving,
  type ReceiptOutcome,
} from '@/features/logistics/use-incoming-receiving'
import { formatStockCents } from '@/features/logistics/stock-display'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import { useIncomingDeliveryById } from '@/features/logistics/incoming-deliveries.hooks'
import { deliveryFormStyles } from './shared/delivery-form.styles'

const outcomes = [
  ['all', 'All remaining goods arrived in good condition'],
  ['partial', 'Some goods arrived or were damaged'],
  ['none', 'No goods arrived'],
] as const

export function ReceiveProductsModal(props: {
  onClose: () => void
} & ({ delivery: IncomingDeliveryRecord; deliveryId?: never } | { deliveryId: number; delivery?: never })) {
  const current = useIncomingDeliveryById(props.deliveryId)
  const delivery = props.delivery ?? current.data
  if (delivery) return <ReceiveProductsForm key={delivery.id} delivery={delivery} onClose={props.onClose} />
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
}: {
  delivery: IncomingDeliveryRecord
  onClose: () => void
}) {
  const form = useIncomingReceiving(delivery, onClose)
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
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col overflow-hidden"
          onSubmit={(event) => {
            event.preventDefault()
            void form.submit()
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
            {form.outcome !== 'partial' && (
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
            <fieldset disabled={form.disabled} className="flex min-w-0 flex-col gap-3">
              <legend className="mb-3 text-sm font-medium">
                What happened when the goods arrived?
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
              <fieldset disabled={form.disabled || form.regularUnavailable} className="min-w-0">
                <p className="mb-3 text-xs text-muted-foreground">
                  Received now includes damaged goods. Leave skipped products blank or enter zero.
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
                      header: field === 'received' ? 'Received now' : 'Damaged now',
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
              <div className="flex flex-col gap-2">
                <Label htmlFor="no-receipt-reason">Reason no goods arrived</Label>
                <Input
                  id="no-receipt-reason"
                  required
                  disabled={form.disabled}
                  value={form.reason}
                  onChange={(event) => form.setReason(event.target.value)}
                  placeholder="Supplier did not deliver"
                />
              </div>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.canSubmit}>
              {busy
                ? 'Checking receipt...'
                : form.outcome === 'none'
                  ? 'Confirm No Receipt'
                  : 'Confirm Receipt'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
