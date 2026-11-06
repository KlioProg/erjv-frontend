import { receivingQuantityWidth } from '@/components/deliveries/shared/receiving-quantity'
import { Trash2 } from 'lucide-react'
import { useQueries } from '@tanstack/react-query'
import { decimalLimitError } from '@/lib/decimal-limits'
import { TransferProductCatalog, TransferAvailability } from './TransferProductCatalog'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { DateTimeField } from '@/components/common/DateTimeField'
import { toManilaSchedule } from '@/lib/manila-schedule'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DialogFooter } from '@/components/ui/dialog'
import { DataTable } from '@/components/ui/data-table'
import { deliveryFormStyles } from '@/components/deliveries/shared/delivery-form.styles'
import { getApiError, getApiFieldErrors, getErrorMessage } from '@/lib/api-client'
import { useRecordsById } from '@/lib/use-records-by-id'
import { decimalString, parseOrderDecimal } from '@/lib/order-amounts'
import { fetchStockItemByPairApi } from '@/features/logistics/stock-items.api'
import { STOCK_ITEMS_QUERY_KEY } from '@/features/logistics/stock-items.hooks'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import { formatProductUnit } from '@/lib/product-unit'
import { useTransferWrite } from '@/features/warehouse-transfers/warehouse-transfers.hooks'
import { fetchTransfer } from '@/features/warehouse-transfers/warehouse-transfers.api'
import {
  outcomeFields,
  type CreateTransfer,
  type TransferCommand,
  type TransferOutcome,
  type WarehouseTransfer,
} from '@/features/warehouse-transfers/warehouse-transfers.types'
import {
  transferDraftErrors,
  transferReconciliationErrors,
} from '@/features/warehouse-transfers/warehouse-transfers.validation'

type Reference = { id: number; name: string; isActive: boolean; unit?: string | null }
type FormProps = {
  record?: WarehouseTransfer
  onSaved: (saved: WarehouseTransfer) => void
  onCancel: () => void
  onBusy: (busy: boolean) => void
}

function useSubmission({ onSaved, onBusy }: FormProps) {
  const mutation = useTransferWrite()
  const lock = useRef(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [review, setReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const submit = async (command: TransferCommand, validation: Record<string, string>) => {
    if (lock.current || review) return
    setErrors(validation)
    setMessage('')
    if (Object.keys(validation).length) return
    lock.current = true
    setSaving(true)
    onBusy(true)
    try {
      if (command.action === 'dispatch' || command.action === 'reconcile') {
        const latest = await fetchTransfer(command.id)
        if (latest.revision !== command.payload.expectedRevision ||
          latest.status !== (command.action === 'dispatch' ? 'DRAFT' : 'DISPATCHED'))
          throw Error('This transfer changed. Your entries have been kept. Reload the saved transfer before continuing.')
        if (command.action === 'reconcile') {
          const currentErrors = transferReconciliationErrors(latest.items, command.payload.items)
          if (Object.keys(currentErrors).length) {
            setErrors(currentErrors)
            throw Error('Sent quantities changed. Reload and review the transfer before saving a receipt.')
          }
        }
      }
      const saved = await mutation.mutateAsync(command)
      onSaved(saved)
    } catch (error) {
      setErrors(getApiFieldErrors(error))
      setMessage(getErrorMessage(error))
      const status = getApiError(error)?.status
      setReview(status === undefined || status === 409 || status >= 500)
    } finally {
      lock.current = false
      setSaving(false)
      onBusy(false)
    }
  }
  return { submit, errors, setErrors, message, setMessage, review, busy: saving || mutation.isPending }
}

function WriteMessage({
  message,
  review,
  onReview,
}: {
  message: string
  review: boolean
  onReview: () => void
}) {
  return message ? (
    <Alert variant="destructive">
      <AlertDescription>
        {message}
        {review && (
          <Button type="button" variant="link" onClick={onReview}>
            Review saved transfers
          </Button>
        )}
      </AlertDescription>
    </Alert>
  ) : null
}

function FieldError({ field, errors }: { field: string; errors: Record<string, string> }) {
  return errors[field] ? (
    <p id={`transfer-error-${field}`} role="alert" className="text-xs text-destructive">
      {errors[field]}
    </p>
  ) : null
}

export function TransferDraftForm(props: FormProps) {
  const { record, onCancel } = props
  const state = useSubmission(props)
  const [source, setSource] = useState(String(record?.sourceWarehouseId ?? ''))
  const [destination, setDestination] = useState(String(record?.destinationWarehouseId ?? ''))
  const [items, setItems] = useState(
    record?.items.map(({ inventoryItemId, quantity }) => ({ inventoryItemId, quantity })) ?? [],
  )
  const products = useRecordsById<Reference>(
    '/inventory-items',
    items.map((item) => item.inventoryItemId || undefined),
  )
  const sourceId = Number(source)
  const availabilityQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: [...STOCK_ITEMS_QUERY_KEY, 'pair', item.inventoryItemId, sourceId],
      queryFn: () => fetchStockItemByPairApi(item.inventoryItemId, sourceId),
      enabled: Number.isSafeInteger(sourceId) && sourceId > 0,
    })),
  })
  const availabilities = items.map((item, index) => {
    const query = availabilityQueries[index]
    const stock = query?.data
    const matchesSource =
      stock === null ||
      (stock?.warehouseId === sourceId && stock?.inventoryItemId === item.inventoryItemId)
    const balance = stock === null ? 0n : parseStockCents(stock?.availableQuantity)
    const verified =
      Boolean(source) &&
      !query?.isPending &&
      !query?.isFetching &&
      !query?.isError &&
      matchesSource &&
      balance !== null
    return {
      available: verified ? balance : null,
      verified,
      isError: Boolean(query?.isError),
      retry: () => query?.refetch(),
    }
  })
  const requiresAvailability = items.map((item) => {
    if (!record) return true
    const saved = record.items.find((line) => line.inventoryItemId === item.inventoryItemId)
    return (
      !saved ||
      sourceId !== record.sourceWarehouseId ||
      item.quantity !== saved.quantity
    )
  })
  const quantityErrors: Record<string, string> = {}
  items.forEach((item, index) => {
    const field = `items.${index}.quantity`
    const formatError = decimalLimitError(item.quantity, true)
    if (formatError) {
      quantityErrors[field] = formatError
      return
    }
    const availability = availabilities[index]
    const quantity = parseOrderDecimal(item.quantity)
    if (
      requiresAvailability[index] &&
      availability?.verified &&
      availability.available !== null &&
      quantity !== null &&
      quantity > availability.available
    ) {
      const unit = products.data.find((product) => product.id === item.inventoryItemId)?.unit
      quantityErrors[field] =
        `Cannot exceed ${formatStockCents(availability.available)} ${formatProductUnit(unit)}.`
    }
  })
  const availabilityPending = requiresAvailability.some(
    (required, index) => required && !availabilities[index]?.verified,
  )
  const displayedErrors = { ...state.errors, ...quantityErrors }
  const hasQuantityErrors = items.some(
    (_item, index) =>
      Boolean(quantityErrors[`items.${index}.quantity`] || state.errors[`items.${index}.quantity`]),
  )
  const initialSchedule = toManilaSchedule(record?.scheduledDepartureAt)
  const [schedule, setSchedule] = useState(initialSchedule)
  const [notes, setNotes] = useState(record?.notes ?? '')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!(event.currentTarget as HTMLFormElement).reportValidity()) return
    if (availabilityPending) return
    const draft: CreateTransfer = {
      sourceWarehouseId: Number(source),
      destinationWarehouseId: Number(destination),
      items,
      scheduledDepartureAt: schedule ? `${schedule}:00+08:00` : null,
      notes: notes.trim() || null,
    }
    const validation = transferDraftErrors(draft)
    Object.assign(validation, quantityErrors)
    items.forEach((item, index) => {
      if (products.data.find((product) => product.id === item.inventoryItemId)?.isActive === false)
        validation[`items.${index}.inventoryItemId`] =
          'This product is archived. Remove it from this transfer.'
    })
    if (record) {
      const payload = {
        expectedRevision: record.revision,
        ...(Number(source) !== record.sourceWarehouseId
          ? { sourceWarehouseId: Number(source) }
          : {}),
        ...(Number(destination) !== record.destinationWarehouseId
          ? { destinationWarehouseId: Number(destination) }
          : {}),
        ...(JSON.stringify(items) !==
        JSON.stringify(
          record.items.map(({ inventoryItemId, quantity }) => ({ inventoryItemId, quantity })),
        )
          ? { items }
          : {}),
        ...(schedule !== initialSchedule
          ? { scheduledDepartureAt: draft.scheduledDepartureAt }
          : {}),
        ...(notes !== (record.notes ?? '') ? { notes: draft.notes } : {}),
      }
      void state.submit({ action: 'draft', id: record.id, payload }, validation)
    } else void state.submit({ action: 'create', payload: draft }, validation)
  }
  return (
    <form onSubmit={submit} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:overflow-hidden">
        <div className="flex min-w-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
          <WriteMessage {...state} onReview={onCancel} />
          <fieldset className="flex min-w-0 flex-col gap-3">
            <legend className="mb-3 font-semibold">Warehouses</legend>
            <p className="text-xs text-muted-foreground">
              Choose where the stock will come from and where it will go. Items stay selected if you
              change the source. Their availability is checked again at the new warehouse.
            </p>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    field: 'sourceWarehouseId',
                    label: 'From Warehouse',
                    value: source,
                    set: (value: string) => {
                      setSource(value)
                      state.setErrors((errors) => {
                        const next = { ...errors }
                        for (const key of Object.keys(next))
                          if (key.startsWith('items.') && key.endsWith('.quantity')) delete next[key]
                        return next
                      })
                    },
                  },
                  {
                    field: 'destinationWarehouseId',
                    label: 'To Warehouse',
                    value: destination,
                    set: setDestination,
                  },
                ] as const
              ).map((field) => (
                <div key={field.field} className="min-w-0 space-y-1">
                  <Label htmlFor={`transfer-${field.field}`}>{field.label}</Label>
                  <CursorLookup<Reference>
                    id={`transfer-${field.field}`}
                    path="/warehouses"
                    label={field.label}
                    value={field.value}
                    filter={{ includeInactive: 'false' }}
                    accept={(item) =>
                      item.isActive &&
                      (field.field === 'sourceWarehouseId' || item.id !== Number(source))
                    }
                    getLabel={(item) => item.name}
                    onChange={field.set}
                    disabled={state.busy || state.review}
                    error={state.errors[field.field]}
                  />
                </div>
              ))}
            </div>
            {source && source === destination && (
              <p role="alert" className="text-xs text-destructive">
                Choose different source and destination warehouses.
              </p>
            )}
          </fieldset>
          <section
            aria-label="Selected Items"
            className="flex min-w-0 flex-col gap-3 border-t pt-4"
          >
            <h2 className="text-base font-semibold">Selected Items ({items.length})</h2>
            <p className="text-xs text-muted-foreground">
              Add products from the catalog, then enter quantities. Drafts do not move or reserve
              stock.
            </p>
            {products.isError && (
              <p role="alert" className="text-xs text-destructive">
                Some product details could not be loaded. Saved product references are kept.
              </p>
            )}
            <FieldError field="items" errors={state.errors} />
            <DataTable
              data={items}
              getRowKey={(item) => item.inventoryItemId}
              pagination={false}
              appearance="management"
              emptyContent={
                <p className="p-4 text-sm text-muted-foreground">
                  No products selected. Add products from Available Products.
                </p>
              }
              columns={[
                {
                  id: 'product',
                  header: 'Product',
                  cell: ({ row: item, index }) => {
                    const product = products.data.find(
                      (product) => product.id === item.inventoryItemId,
                    )
                    return (
                      <div className="flex min-w-0 items-center gap-2">
                        <OverflowValue
                          value={product?.name ?? `Product #${item.inventoryItemId}`}
                          className="max-w-48 font-medium"
                        />
                        {product?.isActive === false && (
                          <span className="shrink-0 text-xs text-destructive">Archived</span>
                        )}
                        <FieldError
                          field={`items.${index}.inventoryItemId`}
                          errors={state.errors}
                        />
                      </div>
                    )
                  },
                },
                {
                  id: 'available',
                  header: 'Available',
                  align: 'right',
                  cell: ({ row: item, index }) => (
                    <TransferAvailability
                      available={availabilities[index]?.available ?? null}
                      isError={availabilities[index]?.isError ?? false}
                      onRetry={() => void availabilities[index]?.retry()}
                      unit={
                        products.data.find((product) => product.id === item.inventoryItemId)?.unit
                      }
                    />
                  ),
                },
                {
                  id: 'quantity',
                  header: 'Quantity',
                  align: 'right',
                  cell: ({ row: item, index }) => (
                    <div className="space-y-1">
                      <div className="flex items-center justify-end gap-2">
                        <Input
                          id={`transfer-quantity-${item.inventoryItemId}`}
                          aria-label={`Quantity for item ${index + 1}`}
                          inputMode="decimal"
                          value={item.quantity}
                          aria-invalid={Boolean(displayedErrors[`items.${index}.quantity`])}
                          aria-describedby={
                            displayedErrors[`items.${index}.quantity`]
                              ? `transfer-error-items.${index}.quantity`
                              : undefined
                          }
                          onChange={(event) => {
                            setItems(
                              items.map((line) =>
                                line.inventoryItemId === item.inventoryItemId
                                  ? { ...line, quantity: event.target.value }
                                  : line,
                              ),
                            )
                            state.setErrors((errors) => {
                              const next = { ...errors }
                              delete next[`items.${index}.quantity`]
                              return next
                            })
                          }}
                          disabled={state.busy || state.review}
                          className="ml-auto text-right tabular-nums"
                          style={{
                            width: `${Math.min(14, Math.max(8, item.quantity.length + 2))}ch`,
                          }}
                        />
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatProductUnit(
                            products.data.find((product) => product.id === item.inventoryItemId)
                              ?.unit,
                          )}
                        </span>
                      </div>
                      <FieldError
                        field={`items.${index}.quantity`}
                        errors={displayedErrors}
                      />
                    </div>
                  ),
                },
                {
                  id: 'remove',
                  header: 'Remove',
                  align: 'right',
                  width: 52,
                  cell: ({ row: item }) => {
                    const name =
                      products.data.find((product) => product.id === item.inventoryItemId)?.name ??
                      `Product #${item.inventoryItemId}`
                    return (
                      <OverflowValue
                        asChild
                        value="Remove"
                        fullValue={`Remove ${name}`}
                        showFullValueOnHover
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-destructive pointer-coarse:size-11"
                          aria-label={`Remove ${name}`}
                          disabled={state.busy || state.review}
                          onClick={() => {
                            setItems(
                              items.filter(
                                (line) => line.inventoryItemId !== item.inventoryItemId,
                              ),
                            )
                            state.setErrors((errors) =>
                              Object.fromEntries(
                                Object.entries(errors).filter(
                                  ([field]) => !field.startsWith('items.'),
                                ),
                              ),
                            )
                          }}
                        >
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </OverflowValue>
                    )
                  },
                },
              ]}
            />
          </section>
          <fieldset className="flex min-w-0 flex-col gap-3 border-t pt-4">
            <legend className="font-semibold">Additional Details</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <DateTimeField
                  id="transfer-schedule"
                  label="Scheduled Departure"
                  value={schedule}
                  onChange={setSchedule}
                  disabled={state.busy || state.review}
                  helperText="Optional · Manila time · 24-hour HH:mm"
                />
                <FieldError field="scheduledDepartureAt" errors={state.errors} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="transfer-notes">Notes (optional)</Label>
                <Textarea
                  id="transfer-notes"
                  rows={2}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={state.busy || state.review}
                />
              </div>
            </div>
          </fieldset>
        </div>
        <TransferProductCatalog
          key={source}
          source={source}
          selected={Object.fromEntries(
            items.map((item) => [item.inventoryItemId, item.quantity]),
          )}
          busy={state.busy || state.review}
          onAdd={(product, quantity, available) => {
            const index = items.findIndex((item) => item.inventoryItemId === product.id)
            if (index < 0 && items.length >= 100) return
            const amount = parseOrderDecimal(quantity)
            if (amount === null || amount > available || decimalLimitError(quantity, true)) return
            state.setErrors((errors) => {
              const next = { ...errors }
              if (index >= 0) delete next[`items.${index}.quantity`]
              return next
            })
            setItems((current) =>
              index >= 0
                ? current.map((item) =>
                    item.inventoryItemId === product.id ? { ...item, quantity } : item,
                  )
                : [...current, { inventoryItemId: product.id, quantity }],
            )
          }}
        />
      </div>
      <DialogFooter className="shrink-0 border-t bg-background pt-3">
        <Button type="button" variant="outline" disabled={state.busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          disabled={
            state.busy ||
            state.review ||
            hasQuantityErrors ||
            availabilityPending
          }
        >
          {state.busy ? 'Saving…' : 'Save Transfer'}
        </Button>
      </DialogFooter>
    </form>
  )
}

const outcomeLabels = {
  receivedQuantity: 'Received',
  damagedQuantity: 'Damaged',
  returnedSellableQuantity: 'Returned in good condition',
  returnedDamagedQuantity: 'Returned damaged',
  missingQuantity: 'Missing',
}

export function TransferActionForm(
  props: FormProps & { record: WarehouseTransfer; action: 'dispatch' | 'reconcile' | 'cancel' },
) {
  const { record, action, onCancel } = props
  const state = useSubmission(props)
  const { data: products } = useRecordsById<Reference & { unit: string }>(
    '/inventory-items',
    record.items.map((line) => line.inventoryItemId),
  )
  const { data: warehouses } = useRecordsById<Reference>('/warehouses', [
    record.sourceWarehouseId,
    record.destinationWarehouseId,
  ])
  const warehouseName = (id: number) =>
    warehouses.find((item) => item.id === id)?.name ?? `Warehouse #${id}`
  const [reason, setReason] = useState('')
  const [outcome, setOutcome] = useState<'all' | 'exceptions' | null>(null)
  const [openReasons, setOpenReasons] = useState<Record<number, boolean>>({})
  const [receiptReview, setReceiptReview] = useState<string | null>(null)
  const [items, setItems] = useState<TransferOutcome[]>(
    record.items.map((line) => ({
      warehouseTransferItemId: line.id,
      receivedQuantity: '',
      damagedQuantity: '',
      returnedSellableQuantity: '',
      returnedDamagedQuantity: '',
      missingQuantity: '',
      discrepancyReason: '',
    })),
  )
  const quantityWidth = receivingQuantityWidth(items.flatMap((item) => outcomeFields.map((field) => item[field])))
  const fullItems = record.items.map((line) => ({
    warehouseTransferItemId: line.id, receivedQuantity: line.quantity, damagedQuantity: '0.00',
    returnedSellableQuantity: '0.00', returnedDamagedQuantity: '0.00', missingQuantity: '0.00', discrepancyReason: '',
  }))
  const activeItems = outcome === 'all' ? fullItems : items
  const signature = JSON.stringify([record.revision, outcome, activeItems])
  const reviewing = receiptReview === signature && !state.message
  const reviewHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (reviewing) reviewHeading.current?.focus()
  }, [reviewing])
  const chooseOutcome = (next: 'all' | 'exceptions') => {
    if (next === 'exceptions' && outcome === 'all')
      setItems(items.map((item, index) => outcomeFields.some((field) => item[field].trim()) ? item : fullItems[index]))
    setOutcome(next)
    setReceiptReview(null)
  }
  const receiptRows = record.items.map((line, index) => {
    const entry = activeItems[index]
    const received = parseOrderDecimal(entry.receivedQuantity)
    const damaged = parseOrderDecimal(entry.damagedQuantity)
    const product = products.find((item) => item.id === line.inventoryItemId)
    return { ...entry, id: line.id, product: product?.name ?? `Item #${line.inventoryItemId}`, unit: product?.unit,
      sent: line.quantity, good: received === null || damaged === null ? null : received - damaged,
      reasonRequired: outcomeFields.filter((field) => field !== 'receivedQuantity')
        .some((field) => (parseOrderDecimal(entry[field]) ?? 0n) > 0n),
    }
  })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (state.busy || state.review || (action === 'reconcile' && !outcome)) return
    const validation =
      action === 'reconcile'
        ? transferReconciliationErrors(record.items, activeItems)
        : action === 'cancel' && !reason.trim()
          ? { reason: 'Enter a cancellation reason.' }
          : {}
    if (action === 'reconcile' && !reviewing) {
      state.setErrors(validation)
      state.setMessage('')
      if (!Object.keys(validation).length) setReceiptReview(signature)
      return
    }
    const revision = { expectedRevision: record.revision }
    const command: TransferCommand =
      action === 'reconcile'
        ? { action, id: record.id, payload: { ...revision, items: activeItems } }
        : action === 'cancel'
          ? { action, id: record.id, payload: { ...revision, reason: reason.trim() } }
          : { action, id: record.id, payload: revision }
    void state.submit(command, validation)
  }
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
      <WriteMessage {...state} onReview={onCancel} />
      {action !== 'cancel' && (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-medium">{record.transferNumber}</p>
          <p>From {warehouseName(record.sourceWarehouseId)} to {warehouseName(record.destinationWarehouseId)}</p>
          <p>{action === 'dispatch' ? 'Planned departure' : 'Actual departure'}:{' '}
            {(action === 'dispatch' ? record.scheduledDepartureAt : record.dispatchedAt)
              ? new Date((action === 'dispatch' ? record.scheduledDepartureAt : record.dispatchedAt)!).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })
              : action === 'dispatch' ? 'Not scheduled' : 'Not recorded'}
          </p>
        </div>
      )}
      {action === 'dispatch' && (
        <>
          <p className="text-sm">
            Send goods from {warehouseName(record.sourceWarehouseId)} to{' '}
            {warehouseName(record.destinationWarehouseId)}? This records their departure and moves
            source stock into transit.
          </p>
          <ul className="space-y-1 text-sm">
            {record.items.map((line) => {
              const product = products.find((item) => item.id === line.inventoryItemId)
              return (
                <li key={line.id}>
                  {product?.name ?? `Item #${line.inventoryItemId}`}: {line.quantity}{' '}
                  {product?.unit}
                </li>
              )
            })}
          </ul>
        </>
      )}
      {action === 'cancel' && (
        <div className="space-y-1">
          <Label htmlFor="transfer-cancel-reason">Cancellation reason</Label>
          <Textarea
            id="transfer-cancel-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={state.busy || state.review}
            aria-invalid={Boolean(state.errors.reason)}
          />
          <FieldError field="reason" errors={state.errors} />
        </div>
      )}
      {action === 'reconcile' && (
        <>
          <fieldset hidden={reviewing} disabled={state.busy || state.review} className="flex flex-wrap gap-2">
            <legend className="mb-2 text-sm font-medium">Were all items received in good condition?</legend>
            <Label className={deliveryFormStyles.compactOutcomeChoice}>
              <input type="radio" name="transfer-outcome" checked={outcome === 'all'}
                onChange={() => chooseOutcome('all')} aria-describedby="transfer-all-help" className={deliveryFormStyles.outcomeRadio} />
              All items received in good condition
            </Label>
            <p id="transfer-all-help" className="sr-only">All listed items arrived without damage, returns, or missing items.</p>
            <Label className={deliveryFormStyles.compactOutcomeChoice}>
              <input type="radio" name="transfer-outcome" checked={outcome === 'exceptions'}
                onChange={() => chooseOutcome('exceptions')} aria-describedby="transfer-exceptions-help" className={deliveryFormStyles.outcomeRadio} />
              Some items were damaged, missing, or returned
            </Label>
            <p id="transfer-exceptions-help" className="sr-only">Enter the actual quantities received, damaged, returned, or missing.</p>
          </fieldset>
          {!reviewing && <p className="text-xs text-muted-foreground">If the goods have not arrived and the result is unknown, close this form and leave the transfer In Transit.</p>}
          {(outcome !== 'exceptions' || reviewing) && (
            <section aria-label={reviewing ? 'Review transfer receipt' : 'Transfer quantities'} className="flex flex-col gap-3">
              {reviewing && <h3 ref={reviewHeading} tabIndex={-1} className="text-sm font-medium">Review Receipt</h3>}
              <DataTable data={receiptRows} pagination={false} getRowKey={(row) => row.id}
                columns={[
                  { id: 'product', header: 'Product', cell: ({ row }) => `${row.product}${row.unit ? ` (${row.unit})` : ''}` },
                  { id: 'sent', header: 'Sent', accessorKey: 'sent', align: 'right' },
                  ...(outcome ? [
                    { id: 'good', header: 'Received — Good', align: 'right' as const, cell: ({ row }: { row: (typeof receiptRows)[number] }) => row.good === null ? 'Unavailable' : decimalString(row.good) },
                    ...outcomeFields.filter((field) => field !== 'receivedQuantity').map((field) => ({
                      id: field, header: field === 'damagedQuantity' ? 'Received — Damaged' : outcomeLabels[field], accessorKey: field, align: 'right' as const,
                    })),
                  ] : []),
                ]}
              />
              {reviewing && receiptRows.filter((row) => row.discrepancyReason?.trim()).map((row) => <p key={row.id} className="text-sm">{row.product}: {row.discrepancyReason}</p>)}
              {reviewing && <p className="text-xs text-muted-foreground">Saving records the final receipt and updates warehouse inventory, including returns, damaged goods, and missing quantities.</p>}
            </section>
          )}
          {outcome === 'all' && !reviewing && <Button type="button" variant="outline" disabled={state.busy || state.review} onClick={() => chooseOutcome('exceptions')}>Edit Quantities</Button>}
          {outcome === 'exceptions' && !reviewing && <p className="text-xs text-muted-foreground">Damaged items are included in the received quantity. Returned items were sent back instead of being received at this warehouse.</p>}
          <FieldError field="items" errors={state.errors} />
          {outcome === 'exceptions' && !reviewing && (
            <DataTable
              data={receiptRows}
              pagination={false}
              getRowKey={(row) => row.id}
              tableClassName="min-w-[1000px] table-fixed"
              className="[&_td]:align-top [&_th]:whitespace-nowrap"
              columns={[
                {
                  id: 'product',
                  header: 'Product',
                  width: 180,
                  cell: ({ row }) => (
                    <div className="whitespace-normal break-words">
                      <p className="font-medium">{row.product}</p>
                      <p className="text-xs text-muted-foreground">
                        Sent: {row.sent} {row.unit}
                      </p>
                    </div>
                  ),
                },
                ...outcomeFields.map((field) => ({
                  id: field,
                  header:
                    field === 'returnedSellableQuantity'
                      ? 'Return Good'
                      : field === 'returnedDamagedQuantity'
                        ? 'Return Damaged'
                        : outcomeLabels[field],
                  width: quantityWidth + 32,
                  cell: ({ row, index }: { row: (typeof receiptRows)[number]; index: number }) => (
                    <div className="space-y-1 whitespace-normal">
                      <Input
                        id={`outcome-${index}-${field}`}
                        inputMode="decimal"
                        aria-label={`${outcomeLabels[field]} for item ${record.items[index].inventoryItemId} (${row.product})`}
                        value={items[index][field]}
                        disabled={state.busy || state.review}
                        className="text-right tabular-nums"
                        style={{ width: quantityWidth }}
                        aria-invalid={Boolean(state.errors[`items.${index}.${field}`])}
                        aria-describedby={
                          state.errors[`items.${index}.${field}`]
                            ? `transfer-error-items.${index}.${field}`
                            : undefined
                        }
                        onChange={(event) =>
                          setItems(
                            items.map((entry, position) =>
                              position === index ? { ...entry, [field]: event.target.value } : entry,
                            ),
                          )
                        }
                      />
                      <FieldError field={`items.${index}.${field}`} errors={state.errors} />
                    </div>
                  ),
                })),
                {
                  id: 'accounted',
                  header: 'Accounted',
                  width: 190,
                  cell: ({ row, index }) => {
                    const accounted = [
                      'receivedQuantity',
                      'returnedSellableQuantity',
                      'returnedDamagedQuantity',
                      'missingQuantity',
                    ].reduce<bigint | null>((total, field) => {
                      const value = parseOrderDecimal(items[index][field as keyof typeof outcomeLabels])
                      return total === null || value === null ? null : total + value
                    }, 0n)
                    const reasonError = state.errors[`items.${index}.discrepancyReason`]
                    return (
                      <div className="space-y-1 whitespace-normal">
                        <p role="status" className="tabular-nums">
                          Accounted: {accounted === null ? 'Check quantities' : decimalString(accounted)} /{' '}
                          {row.sent}
                        </p>
                        <FieldError field={`items.${index}.balance`} errors={state.errors} />
                        {(row.reasonRequired || items[index].discrepancyReason || reasonError) && (
                          <Button
                            type="button"
                            variant="link"
                            className="h-auto px-0"
                            disabled={state.busy || state.review}
                            aria-label={`Reason for ${row.product}`}
                            aria-describedby={
                              row.reasonRequired ? `transfer-reason-required-${row.id}` : undefined
                            }
                            aria-expanded={Boolean(openReasons[row.id] || reasonError)}
                            aria-controls={`transfer-reason-${row.id}`}
                            onClick={() => setOpenReasons({ ...openReasons, [row.id]: !openReasons[row.id] })}
                          >
                            Reason
                            {row.reasonRequired && (
                              <span id={`transfer-reason-required-${row.id}`}> (required)</span>
                            )}
                          </Button>
                        )}
                      </div>
                    )
                  },
                },
              ]}
              renderExpandedRow={(row, index) =>
                openReasons[row.id] || state.errors[`items.${index}.discrepancyReason`] ? (
                  <div id={`transfer-reason-${row.id}`} className="space-y-2 border-t bg-muted/30 p-4">
                    <Label htmlFor={`outcome-reason-${index}`}>
                      Reason for difference for item {record.items[index].inventoryItemId} ({row.product})
                    </Label>
                    <Input
                      id={`outcome-reason-${index}`}
                      value={items[index].discrepancyReason ?? ''}
                      disabled={state.busy || state.review}
                      aria-required={row.reasonRequired}
                      aria-invalid={Boolean(state.errors[`items.${index}.discrepancyReason`])}
                      aria-describedby={
                        state.errors[`items.${index}.discrepancyReason`]
                          ? `transfer-error-items.${index}.discrepancyReason`
                          : undefined
                      }
                      onChange={(event) =>
                        setItems(
                          items.map((entry, position) =>
                            position === index ? { ...entry, discrepancyReason: event.target.value } : entry,
                          ),
                        )
                      }
                    />
                    <FieldError field={`items.${index}.discrepancyReason`} errors={state.errors} />
                  </div>
                ) : null
              }
            />
          )}
        </>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={state.busy} onClick={() => reviewing ? setReceiptReview(null) : onCancel()}>
          Back
        </Button>
        <Button disabled={state.busy || state.review || (action === 'reconcile' && !outcome)}>
          {state.busy
            ? 'Saving…'
            : action === 'dispatch'
              ? 'Send Goods'
              : action === 'reconcile'
                ? reviewing ? 'Save Receipt' : 'Review Receipt'
                : 'Cancel Transfer'}
        </Button>
      </DialogFooter>
    </form>
  )
}
