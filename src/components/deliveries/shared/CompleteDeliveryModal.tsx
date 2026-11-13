import { receivingQuantityWidth } from './receiving-quantity'
import { deliveryFormStyles } from './delivery-form.styles'
import { useEffect, useRef, useState } from 'react'
import { decimalLimitError, QUANTITY_MAX } from '@/lib/decimal-limits'
import { toast } from '@/lib/notifications'
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
import { DataTable } from '@/components/ui/data-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useOutgoingDeliveryById } from '@/features/logistics/outgoing-deliveries.hooks'
import { useSalesOrderById } from '@/features/crm/sales-orders.hooks'
import { useReconciliationContext } from '@/features/logistics/use-reconciliation-context'
import { useAuth } from '@/features/auth/AuthContext'
import { parseStockCents, formatStockCents } from '@/features/logistics/stock-display'
import { decimalString } from '@/features/logistics/purchase-pricing'
import { getApiFieldErrors, getErrorMessage } from '@/lib/api-client'
import { useDeliveryRunById, useReconcileRunMember } from '@/features/logistics/delivery-runs.hooks'
import type { RunMemberReconciliationResponse } from '@/features/logistics/delivery-runs.types'

const fields = [
  ['deliveredQuantity', 'Delivered'],
  ['returnedSellableQuantity', 'Returned in good condition'],
  ['returnedDamagedQuantity', 'Returned damaged'],
  ['missingQuantity', 'Missing'],
] as const
type Counts = Record<(typeof fields)[number][0] | 'discrepancyReason', string>
type Outcome = 'all' | 'exceptions'

export function CompleteDeliveryModal({
  runId,
  deliveryId,
  onClose,
  onSaved,
}: {
  runId: number
  deliveryId: number
  onClose: () => void
  onSaved?: (saved: RunMemberReconciliationResponse) => void
}) {
  const query = useOutgoingDeliveryById(deliveryId)
  const complete = useReconcileRunMember()
  const runQuery = useDeliveryRunById(runId)
  const { isAdmin, isManager, isStaff } = useAuth()
  const delivery = query.data
  const order = useSalesOrderById(delivery?.salesOrderId)
  const { products, warehouses, clients } = useReconciliationContext(delivery, order.data)
  const [openReasons, setOpenReasons] = useState<Record<number, boolean>>({})
  const [counts, setCounts] = useState<Record<number, Partial<Counts>>>({})
  const [selection, setSelection] = useState<{ outcome: Outcome; signature: string } | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [reviewSignature, setReviewSignature] = useState<string | null>(null)
  const inFlight = useRef(false)
  const signature = JSON.stringify([
    runId,
    runQuery.data?.revision,
    deliveryId,
    delivery?.revision,
    delivery?.status,
    delivery?.items.map((item) => [item.id, item.loadedQuantity ?? item.quantity]),
  ])
  const outcome = selection?.signature === signature ? selection.outcome : null
  const currentReview = JSON.stringify([signature, outcome, counts])
  const reviewing = reviewSignature === currentReview
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus()
  }, [reviewing])
  const rows = (delivery?.items ?? []).map((item) => {
    const line = order.data?.items.find((line) => line.id === item.salesOrderItemId)
    const product = products.data?.find((product) => product.id === line?.inventoryItemId)
    const warehouse = warehouses.data?.find(
      (warehouse) => warehouse.id === (delivery?.warehouseId ?? item.stockItem?.warehouseId),
    )
    const loaded = parseStockCents(item.loadedQuantity ?? item.quantity)
    const values = fields.map(([field]) => parseStockCents(counts[item.id]?.[field] ?? ''))
    const total = values.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n)
    const reasonRequired = (values[2] ?? 0n) > 0n || (values[3] ?? 0n) > 0n
    const invalid = values.some((value) => value === null || value > QUANTITY_MAX)
    const balanced = !invalid && loaded !== null && total === loaded
    return { item, product, warehouse, loaded, values, total, reasonRequired, invalid, balanced }
  })
  const quantityWidth = receivingQuantityWidth(rows.flatMap((row) => fields.map(([field]) => counts[row.item.id]?.[field])))
  const lookupsLoading = order.isFetching || products.isFetching || warehouses.isFetching
  const detailsUnavailable =
    order.isError ||
    products.isError ||
    warehouses.isError ||
    !order.data ||
    rows.some((row) => !row.product?.name || !row.product.unit || !row.warehouse)
  const invalidLines =
    !rows.length ||
    new Set(rows.map((row) => row.item.id)).size !== rows.length ||
    rows.some(
      (row) => !Number.isSafeInteger(row.item.id) || row.item.id <= 0 || row.loaded === null,
    )
  const disabled =
    needsRefresh ||
    refreshing ||
    complete.isPending ||
    query.isFetching ||
    query.isError ||
    runQuery.isFetching ||
    runQuery.isError ||
    runQuery.data?.status !== 'DISPATCHED' ||
    !runQuery.data.deliveries.some(
      (member) => member.id === deliveryId && member.revision === delivery?.revision,
    ) ||
    delivery?.runId !== runId ||
    delivery?.reconciledAt != null ||
    !delivery ||
    lookupsLoading ||
    detailsUnavailable ||
    invalidLines ||
    delivery.status !== 'DISPATCHED' ||
    !(isAdmin || isManager || isStaff)
  const validOutcome =
    outcome === 'all' ||
    (outcome === 'exceptions' &&
      rows.every(
        (row) =>
          row.balanced && (!row.reasonRequired || counts[row.item.id]?.discrepancyReason?.trim()),
      ))
  const chooseOutcome = (next: Outcome) => {
    if (next === 'exceptions' && outcome === 'all') {
      setCounts((current) => Object.fromEntries(rows.map((row) => [row.item.id,
        current[row.item.id] ?? {
          deliveredQuantity: decimalString(row.loaded!),
          returnedSellableQuantity: '0.00', returnedDamagedQuantity: '0.00', missingQuantity: '0.00',
        },
      ])))
    }
    if (
      next === 'all' &&
      outcome === 'exceptions' &&
      Object.values(counts).some((line) => Object.values(line).some((value) => value?.trim()))
    ) {
      setConfirmAll(true)
      return
    }
    setSelection({ outcome: next, signature })
    setConfirmAll(false)
    setError('')
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !complete.isPending && onClose()}>
      <DialogContent
        closeDisabled={complete.isPending}
        className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden p-0 sm:max-w-6xl"
      >
        <DialogHeader className="shrink-0 px-6 pr-14 pt-6">
          <DialogTitle>Record Delivery Results</DialogTitle>
          <DialogDescription>
            {runQuery.data?.runNumber || 'Loading trip...'} ·{' '}
            {delivery?.deliveryNumber || 'Loading delivery...'} ·{' '}
            {clients.data?.find((client) => client.id === order.data?.clientId)?.name ||
              'Customer unavailable'}.{' '}
            Review the actual quantities before saving. Delivered goods count toward the sales order.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col overflow-hidden"
          onSubmit={async (event) => {
            event.preventDefault()
            if (disabled || inFlight.current || confirmAll || !validOutcome) return
            if (!reviewing) {
              setReviewSignature(currentReview)
              return
            }
            setError('')
            setFieldErrors({})
            try {
              const items = rows.map((row) => {
                const values = outcome === 'all' ? [row.loaded!, 0n, 0n, 0n] : row.values
                if (
                  values.some((value) => value === null) ||
                  values.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n) !== row.loaded
                )
                  throw Error('Account for the exact loaded quantity for each product.')
                const reason =
                  outcome === 'exceptions' && row.reasonRequired
                    ? counts[row.item.id]?.discrepancyReason?.trim()
                    : undefined
                if ((values[2]! > 0n || values[3]! > 0n) && !reason)
                  throw Error('Damage or missing goods require a reason for the difference.')
                return {
                  outgoingDeliveryItemId: row.item.id,
                  deliveredQuantity: decimalString(values[0]!),
                  returnedSellableQuantity: decimalString(values[1]!),
                  returnedDamagedQuantity: decimalString(values[2]!),
                  missingQuantity: decimalString(values[3]!),
                  ...(reason ? { discrepancyReason: reason } : {}),
                }
              })
              inFlight.current = true
              const saved = await complete.mutateAsync({
                id: runId,
                deliveryId,
                payload: { expectedRevision: delivery!.revision, items },
              })
              if (
                saved?.delivery?.id !== deliveryId ||
                saved.delivery.runId !== runId ||
                saved.delivery.status !== 'RECONCILED' ||
                !Number.isSafeInteger(saved.delivery.revision) ||
                saved.delivery.revision <= delivery!.revision ||
                !saved.delivery.reconciledAt ||
                saved.run?.id !== runId ||
                !Number.isSafeInteger(saved.run.revision) ||
                saved.run.revision <= runQuery.data!.revision ||
                !['DISPATCHED', 'COMPLETED'].includes(saved.run.status) ||
                (saved.run.status === 'COMPLETED' && saved.run.deliveries?.some((member) => member.status === 'DISPATCHED')) ||
                !saved.run.deliveries?.some((member) => member.id === deliveryId &&
                  member.status === 'RECONCILED' && member.revision === saved.delivery.revision)
              )
                throw Error(
                  'Delivery results were not confirmed. Refresh and review before trying again.',
                )
              const remaining = saved.run.deliveries.filter((member) => member.status === 'DISPATCHED').length
              toast.success(`Results saved for ${saved.delivery.deliveryNumber}.`, {
                description: remaining
                  ? `${remaining} ${remaining === 1 ? 'delivery still needs' : 'deliveries still need'} results.`
                  : saved.run.status === 'COMPLETED' ? 'This trip is completed.' : 'No deliveries are awaiting results. Review the trip status.',
              })
              onSaved?.(saved)
              onClose()
            } catch (cause) {
              const issues = getApiFieldErrors(cause)
              setFieldErrors(Object.fromEntries(rows.flatMap((row, index) => [...fields.map(([field]) => field), 'discrepancyReason'].flatMap((field) => issues[`items.${index}.${field}`] ? [[`${row.item.id}.${field}`, issues[`items.${index}.${field}`]]] : []))))
              setNeedsRefresh(true)
              setReviewSignature(null)
              setError(getErrorMessage(cause))
            } finally {
              inFlight.current = false
            }
          }}
        >
          <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-6 pb-6">
            {!(isAdmin || isManager || isStaff) && (
              <Alert>
                <AlertDescription>
                  You do not have permission to complete deliveries.
                </AlertDescription>
              </Alert>
            )}
            <Button
              type="button"
              variant="link"
              disabled={complete.isPending || refreshing}
              onClick={async () => {
                setRefreshing(true)
                try {
                  const results = await Promise.all([
                    runQuery.refetch(),
                    query.refetch(),
                    order.refetch(),
                    products.refetch(),
                    warehouses.refetch(),
                  ])
                  if (results.some((result) => result.isError))
                    throw new Error('Delivery details could not be refreshed.')
                  setNeedsRefresh(false)
                  setError('')
                } catch (cause) {
                  setError(getErrorMessage(cause))
                } finally {
                  setRefreshing(false)
                }
              }}
            >
              Refresh delivery data
            </Button>
            {(error || query.isError || runQuery.isError) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error ||
                    (runQuery.isError
                      ? `The delivery trip could not be loaded. ${getErrorMessage(runQuery.error)}`
                      : 'The latest delivery could not be loaded. Refresh and retry.')}
                </AlertDescription>
              </Alert>
            )}
            {(lookupsLoading || detailsUnavailable) && (
              <Alert variant={lookupsLoading ? 'default' : 'destructive'}>
                <AlertDescription>
                  {lookupsLoading
                    ? 'Loading product and warehouse details...'
                    : 'Product or warehouse details are unavailable. Close and retry before confirming.'}
                </AlertDescription>
              </Alert>
            )}
            {runQuery.data &&
              (runQuery.data.status !== 'DISPATCHED' ||
                delivery?.runId !== runId ||
                !runQuery.data.deliveries.some(
                  (member) => member.id === deliveryId && member.revision === delivery?.revision,
                )) && (
                <Alert variant="destructive">
                  <AlertDescription>
                    Trip membership, revision, or status changed. Refresh and review before
                    recording these results.
                  </AlertDescription>
                </Alert>
              )}
            {delivery && invalidLines && (
              <Alert variant="destructive">
                <AlertDescription>
                  Loaded products are missing, repeated, or have an invalid quantity. Close and
                  reload.
                </AlertDescription>
              </Alert>
            )}
            {delivery && delivery.status !== 'DISPATCHED' && (
              <Alert variant="destructive">
                <AlertDescription>
                  This delivery is no longer marked as dispatched. Close and review its current status.
                </AlertDescription>
              </Alert>
            )}
            {selection && !outcome && (
              <Alert>
                <AlertDescription>
                  Loaded quantities changed. Review the current products and choose the delivery
                  outcome again. Your exception entries have been kept.
                </AlertDescription>
              </Alert>
            )}
            <section hidden={reviewing || outcome === 'exceptions'} aria-labelledby="completion-loaded-heading" className="flex flex-col gap-3">
              <h3 id="completion-loaded-heading" className="text-sm font-medium">
                Loaded products
              </h3>
              <ul className="flex flex-col gap-3">
                {rows.map((row) => (
                  <li
                    key={row.item.id}
                    className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-medium">
                        {row.product?.name ||
                          (lookupsLoading ? 'Loading product...' : 'Product unavailable')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[row.product?.variety, row.product?.unit, row.warehouse?.name]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <span className="tabular-nums">
                      {formatStockCents(row.loaded)} {row.product?.unit} loaded
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <fieldset hidden={reviewing} disabled={disabled || reviewing} className="flex min-w-0 flex-wrap gap-2">
              <legend className="mb-2 text-sm font-medium">
                Were all items delivered?
              </legend>
              <Label className={deliveryFormStyles.compactOutcomeChoice}>
                <input
                  type="radio"
                  name="delivery-outcome"
                  value="all"
                  aria-describedby="completion-all-help"
                  checked={outcome === 'all'}
                  onChange={() => chooseOutcome('all')}
                  className={deliveryFormStyles.outcomeRadio}
                />
                All items delivered
              </Label>
              <p id="completion-all-help" className="sr-only">All listed items were delivered to the customer.</p>
              <Label className={deliveryFormStyles.compactOutcomeChoice}>
                <input
                  type="radio"
                  name="delivery-outcome"
                  value="exceptions"
                  aria-describedby="completion-exceptions-help"
                  checked={outcome === 'exceptions'}
                  onChange={() => chooseOutcome('exceptions')}
                  className={deliveryFormStyles.outcomeRadio}
                />
                Some items were returned or missing
              </Label>
              <p id="completion-exceptions-help" className="sr-only">Enter the quantities delivered, returned, or missing.</p>
            </fieldset>
            {confirmAll && (
              <Alert>
                <AlertDescription>
                  <p>
                    Confirm everything was delivered? This replaces the exception outcome. Your
                    entries will be kept if you switch back.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => setConfirmAll(false)}
                    >
                      Keep exceptions
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={disabled}
                      onClick={() => {
                        setSelection({ outcome: 'all', signature })
                        setConfirmAll(false)
                        setError('')
                      }}
                    >
                      Confirm everything delivered
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}
            {outcome === 'all' && !reviewing && (
              <Alert>
                <AlertDescription>
                  All loaded goods will be recorded as delivered. No sellable returns, damaged
                  returns, or missing goods.
                  <Button type="button" variant="link" disabled={disabled} onClick={() => chooseOutcome('exceptions')}>
                    Edit Quantities
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {outcome === 'exceptions' && (
              <section hidden={reviewing} aria-label="Delivery results">
                <DataTable
                  data={rows}
                  pagination={false}
                  getRowKey={(row) => row.item.id}
                  tableClassName="min-w-[900px] table-fixed"
                  className="[&_td]:align-top [&_th]:whitespace-nowrap"
                  columns={[
                    {
                      id: 'product',
                      header: 'Product',
                      width: 180,
                      cell: ({ row }) => (
                        <div className="whitespace-normal break-words">
                          <p className="font-medium">
                            {row.product?.name || 'Product unavailable'}
                            {row.product?.variety ? ` · ${row.product.variety}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Loaded: {formatStockCents(row.loaded)} {row.product?.unit} · {row.warehouse?.name}
                          </p>
                        </div>
                      ),
                    },
                    ...fields.map(([field, label]) => ({
                      id: field,
                      header:
                        field === 'returnedSellableQuantity'
                          ? 'Return Good'
                          : field === 'returnedDamagedQuantity'
                            ? 'Return Damaged'
                            : label,
                      width: quantityWidth + 32,
                      cell: ({ row, index }: { row: (typeof rows)[number]; index: number }) => {
                        const value = counts[row.item.id]?.[field] ?? ''
                        const quantityError = value ? decimalLimitError(value) : undefined
                        const invalid = !!quantityError
                        return (
                          <div className="space-y-1 whitespace-normal">
                            <Input
                              disabled={disabled || confirmAll || reviewing}
                              className="text-right tabular-nums"
                              style={{ width: quantityWidth }}
                              id={`completion-${row.item.id}-${field}`}
                              inputMode="decimal"
                              value={value}
                              aria-label={`${label} for ${row.product?.name || 'unavailable product'} (${index + 1})`}
                              aria-invalid={invalid || !!fieldErrors[`${row.item.id}.${field}`]}
                              aria-describedby={`completion-balance-${row.item.id}${quantityError || fieldErrors[`${row.item.id}.${field}`] ? ` completion-${row.item.id}-${field}-error` : ''}`}
                              onChange={(event) =>
                                setCounts((current) => ({
                                  ...current,
                                  [row.item.id]: {
                                    ...current[row.item.id],
                                    [field]: event.target.value,
                                  },
                                }))
                              }
                            />
                            {(quantityError || fieldErrors[`${row.item.id}.${field}`]) && (
                              <p
                                id={`completion-${row.item.id}-${field}-error`}
                                role="alert"
                                className="text-xs text-destructive"
                              >
                                {quantityError || fieldErrors[`${row.item.id}.${field}`]}
                              </p>
                            )}
                          </div>
                        )
                      },
                    })),
                    {
                      id: 'accounted',
                      header: 'Accounted',
                      width: 220,
                      cell: ({ row }) => (
                        <div className="space-y-1 whitespace-normal">
                          <p id={`completion-balance-${row.item.id}`} aria-live="polite" className="text-xs">
                            Accounted for: {formatStockCents(row.total)} / {formatStockCents(row.loaded)}{' '}
                            {row.product?.unit}.
                            {row.invalid
                              ? ' Enter all four quantities with up to two decimals.'
                              : !row.balanced
                                ? ' Quantities must equal the loaded amount.'
                                : ' Balanced.'}
                          </p>
                          {(row.reasonRequired ||
                            counts[row.item.id]?.discrepancyReason ||
                            fieldErrors[`${row.item.id}.discrepancyReason`]) && (
                            <Button
                              type="button"
                              variant="link"
                              className="h-auto px-0"
                              disabled={disabled || confirmAll || reviewing}
                              aria-label={`Reason for ${row.product?.name || 'unavailable product'}`}
                              aria-describedby={
                                row.reasonRequired ? `completion-reason-required-${row.item.id}` : undefined
                              }
                              aria-expanded={Boolean(
                                openReasons[row.item.id] || fieldErrors[`${row.item.id}.discrepancyReason`],
                              )}
                              aria-controls={`completion-reason-row-${row.item.id}`}
                              onClick={() =>
                                setOpenReasons({ ...openReasons, [row.item.id]: !openReasons[row.item.id] })
                              }
                            >
                              Reason
                              {row.reasonRequired && (
                                <span id={`completion-reason-required-${row.item.id}`}> (required)</span>
                              )}
                            </Button>
                          )}
                        </div>
                      ),
                    },
                  ]}
                  renderExpandedRow={(row, index) =>
                    openReasons[row.item.id] || fieldErrors[`${row.item.id}.discrepancyReason`] ? (
                      <div
                        id={`completion-reason-row-${row.item.id}`}
                        className="flex flex-col gap-2 border-t bg-muted/30 p-4"
                      >
                        <Label htmlFor={`completion-reason-${row.item.id}`}>
                          Reason for Difference for {row.product?.name}
                          {row.reasonRequired ? ' (required)' : ''}
                        </Label>
                        <Input
                          id={`completion-reason-${row.item.id}`}
                          aria-label={`Reason for Difference for ${row.product?.name || 'unavailable product'} (${index + 1})`}
                          value={counts[row.item.id]?.discrepancyReason ?? ''}
                          aria-invalid={!!fieldErrors[`${row.item.id}.discrepancyReason`]}
                          aria-describedby={
                            fieldErrors[`${row.item.id}.discrepancyReason`]
                              ? `completion-reason-${row.item.id}-error`
                              : undefined
                          }
                          required={row.reasonRequired}
                          disabled={disabled || confirmAll || reviewing}
                          onChange={(event) =>
                            setCounts((current) => ({
                              ...current,
                              [row.item.id]: {
                                ...current[row.item.id],
                                discrepancyReason: event.target.value,
                              },
                            }))
                          }
                        />
                        {fieldErrors[`${row.item.id}.discrepancyReason`] && (
                          <p
                            id={`completion-reason-${row.item.id}-error`}
                            role="alert"
                            className="text-xs text-destructive"
                          >
                            {fieldErrors[`${row.item.id}.discrepancyReason`]}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">Explain the damaged or missing goods.</p>
                      </div>
                    ) : null
                  }
                />
              </section>
            )}
            {reviewing && (
              <section aria-label="Review delivery results" className="flex flex-col gap-3">
                <h3 ref={reviewHeading} tabIndex={-1} className="text-sm font-medium">Review Results</h3>
                <DataTable data={rows} pagination={false} getRowKey={(row) => row.item.id}
                  columns={[
                    { id: 'product', header: 'Product', cell: ({ row }) => <span>{row.product?.name} ({row.product?.unit})</span> },
                    { id: 'loaded', header: 'Loaded', cell: ({ row }) => formatStockCents(row.loaded) },
                    ...fields.map(([field, label], index) => ({
                      id: field, header: label, cell: ({ row }: { row: (typeof rows)[number] }) =>
                        formatStockCents(outcome === 'all' ? index === 0 ? row.loaded : 0n : row.values[index]),
                    })),
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  Saving records these quantities and updates inventory. Cancel if the results are not yet known.
                </p>
              </section>
            )}
            {outcome && (
              <p className="text-xs text-muted-foreground">
                Delivered goods count toward order fulfillment. These results record returns,
                damaged goods, and missing quantities. The vehicle remains occupied until results
                are recorded for every delivery in this trip.
              </p>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
            <Button type="button" variant="outline" disabled={complete.isPending} onClick={onClose}>
              Cancel
            </Button>
            {reviewing && <Button type="button" variant="outline" disabled={complete.isPending} onClick={() => setReviewSignature(null)}>Back</Button>}
            <Button type="submit" disabled={disabled || !validOutcome || confirmAll}>
              {complete.isPending ? 'Saving...' : reviewing ? 'Save Results' : 'Review Results'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
