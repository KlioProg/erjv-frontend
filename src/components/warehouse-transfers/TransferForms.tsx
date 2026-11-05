import { LogisticsDateTimeInput } from '@/components/ui/LogisticsDateTimeInput'
import { toManilaSchedule } from '@/lib/manila-schedule'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatProductUnit } from '@/lib/product-unit'
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
    record?.items.map(({ inventoryItemId, quantity }) => ({ inventoryItemId, quantity })) ?? [
      { inventoryItemId: 0, quantity: '' },
    ],
  )
  const products = useRecordsById<Reference>('/inventory-items', items.map((item) => item.inventoryItemId || undefined))
  const initialSchedule = toManilaSchedule(record?.scheduledDepartureAt)
  const [schedule, setSchedule] = useState(initialSchedule)
  const [notes, setNotes] = useState(record?.notes ?? '')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const draft: CreateTransfer = {
      sourceWarehouseId: Number(source),
      destinationWarehouseId: Number(destination),
      items,
      scheduledDepartureAt: schedule ? `${schedule}:00+08:00` : null,
      notes: notes.trim() || null,
    }
    const validation = transferDraftErrors(draft)
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
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
      <WriteMessage {...state} onReview={onCancel} />
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-3 font-semibold">1. Warehouses</legend>
        <p className="text-xs text-muted-foreground">Choose where the stock will come from and where it will go. Items stay selected if you change the source.</p>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {(
          [
            {
              field: 'sourceWarehouseId',
              label: 'From Warehouse',
              value: source,
              set: setSource,
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
              accept={(item) => item.isActive && (field.field === 'sourceWarehouseId' || item.id !== Number(source))}
              getLabel={(item) => item.name}
              onChange={field.set}
              disabled={state.busy || state.review}
              error={state.errors[field.field]}
            />
          </div>
        ))}
        </div>
        {source && source === destination && <p role="alert" className="text-xs text-destructive">Choose different source and destination warehouses.</p>}
      </fieldset>
      <fieldset className="flex min-w-0 flex-col gap-3 border-t pt-4">
      <legend className="font-semibold">2. Items to Transfer</legend>
      <p className="text-xs text-muted-foreground">Enter the quantities to move. Stock is checked when you review sending this transfer.</p>
      {products.isError && <p role="alert" className="text-xs text-destructive">Some product details could not be loaded. Saved product references are kept.</p>}
      <FieldError field="items" errors={state.errors} />
      {items.map((item, index) => {
        const product = products.data.find((product) => product.id === item.inventoryItemId)
        return <fieldset
          key={index}
          className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
        >
          <legend className="sr-only">Transfer item {index + 1}</legend>
          <div className="min-w-0 space-y-1">
            <Label htmlFor={`transfer-item-${index}`}>{product?.name ?? `Product ${index + 1}`}</Label>
            <CursorLookup<Reference>
              id={`transfer-item-${index}`}
              path="/inventory-items"
              label={`Item ${index + 1}`}
              value={String(item.inventoryItemId || '')}
              filter={{ includeInactive: 'false' }}
              accept={(ref) =>
                ref.isActive &&
                !items.some(
                  (other, position) => position !== index && other.inventoryItemId === ref.id,
                )
              }
              getLabel={(ref) => ref.name}
              onChange={(id) =>
                setItems(
                  items.map((line, position) =>
                    position === index ? { ...line, inventoryItemId: Number(id) } : line,
                  ),
                )
              }
              disabled={state.busy || state.review}
              error={state.errors[`items.${index}.inventoryItemId`]}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`transfer-quantity-${index}`}>Quantity {product?.unit ? `(${formatProductUnit(product.unit)})` : ''}</Label>
            <Input
              id={`transfer-quantity-${index}`}
              aria-label={`Quantity for item ${index + 1}`}
              inputMode="decimal"
              value={item.quantity}
              aria-invalid={Boolean(state.errors[`items.${index}.quantity`])}
              aria-describedby={`transfer-error-items.${index}.quantity`}
              onChange={(event) =>
                setItems(
                  items.map((line, position) =>
                    position === index ? { ...line, quantity: event.target.value } : line,
                  ),
                )
              }
              disabled={state.busy || state.review}
            />
            <FieldError field={`items.${index}.quantity`} errors={state.errors} />
          </div>
          <Button
            type="button"
            variant="ghost"
            aria-label={`Remove item ${index + 1}`}
            disabled={state.busy || state.review || items.length === 1}
            onClick={() => setItems(items.filter((_, position) => position !== index))}
          >
            Remove
          </Button>
        </fieldset>
      })}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={state.busy || state.review || items.length >= 100}
        onClick={() => setItems([...items, { inventoryItemId: 0, quantity: '' }])}
      >
        Add Item
      </Button>
      </fieldset>
      <fieldset className="flex min-w-0 flex-col gap-3 border-t pt-4">
      <legend className="font-semibold">3. Additional Details</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="transfer-schedule">Scheduled Departure (Manila)</Label>
          <LogisticsDateTimeInput id="transfer-schedule" label="Scheduled Departure" value={schedule} onChange={setSchedule} disabled={state.busy || state.review} />
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
      <DialogFooter className="sticky bottom-0 border-t bg-background pt-3">
        <Button type="button" variant="outline" disabled={state.busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={state.busy || state.review}>
          {state.busy ? 'Saving…' : 'Save Transfer'}
        </Button>
      </DialogFooter>
    </form>
  )
}

const outcomeLabels = {
  receivedQuantity: 'Received',
  damagedQuantity: 'Damaged',
  returnedSellableQuantity: 'Returned — Good',
  returnedDamagedQuantity: 'Returned — Damaged',
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
      sent: line.quantity, good: received === null || damaged === null ? null : received - damaged }
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
          <fieldset hidden={reviewing} disabled={state.busy || state.review} className="flex flex-col gap-3">
            <legend className="mb-3 text-sm font-medium">Were all items received in good condition?</legend>
            <Label className={deliveryFormStyles.outcomeChoice}>
              <input type="radio" name="transfer-outcome" checked={outcome === 'all'}
                onChange={() => chooseOutcome('all')} aria-describedby="transfer-all-help" className={deliveryFormStyles.outcomeRadio} />
              All items received in good condition
            </Label>
            <p id="transfer-all-help" className="text-xs text-muted-foreground">All listed items arrived without damage, returns, or missing items.</p>
            <Label className={deliveryFormStyles.outcomeChoice}>
              <input type="radio" name="transfer-outcome" checked={outcome === 'exceptions'}
                onChange={() => chooseOutcome('exceptions')} aria-describedby="transfer-exceptions-help" className={deliveryFormStyles.outcomeRadio} />
              Some items were damaged, missing, or returned
            </Label>
            <p id="transfer-exceptions-help" className="text-xs text-muted-foreground">Enter the actual quantities received, damaged, returned, or missing.</p>
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
          {outcome === 'exceptions' && items.map((item, index) => {
            const line = record.items[index]
            const product = products.find((item) => item.id === line.inventoryItemId)
            const accounted = [
              'receivedQuantity',
              'returnedSellableQuantity',
              'returnedDamagedQuantity',
              'missingQuantity',
            ].reduce<bigint | null>((total, field) => {
              const value = parseOrderDecimal(item[field as keyof typeof outcomeLabels])
              return total === null || value === null ? null : total + value
            }, 0n)
            return (
              <fieldset key={line.id} hidden={reviewing} disabled={state.busy || state.review || reviewing} className="min-w-0 space-y-2 border-t pt-3">
                <legend className="text-sm font-medium">
                  {product?.name ?? `Item #${line.inventoryItemId}`} · Sent {line.quantity}{' '}
                  {product?.unit}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {outcomeFields.map((field) => (
                    <div className="space-y-1" key={field}>
                      <Label htmlFor={`outcome-${index}-${field}`}>{outcomeLabels[field]}</Label>
                      <Input
                        id={`outcome-${index}-${field}`}
                        aria-label={`${outcomeLabels[field]} for item ${line.inventoryItemId}`}
                        inputMode="decimal"
                        value={item[field]}
                        disabled={state.busy || state.review}
                        aria-invalid={Boolean(state.errors[`items.${index}.${field}`])}
                        aria-describedby={`transfer-error-items.${index}.${field}`}
                        onChange={(event) =>
                          setItems(
                            items.map((entry, position) =>
                              position === index
                                ? { ...entry, [field]: event.target.value }
                                : entry,
                            ),
                          )
                        }
                      />
                      <FieldError field={`items.${index}.${field}`} errors={state.errors} />
                    </div>
                  ))}
                </div>
                <p className="text-sm tabular-nums" role="status">
                  Accounted: {accounted === null ? 'Check quantities' : decimalString(accounted)} /{' '}
                  {line.quantity}
                </p>
                <FieldError field={`items.${index}.balance`} errors={state.errors} />
                <Label htmlFor={`outcome-reason-${index}`}>
                  Reason for difference for item {line.inventoryItemId}
                </Label>
                <Textarea
                  id={`outcome-reason-${index}`}
                  value={item.discrepancyReason ?? ''}
                  disabled={state.busy || state.review}
                  onChange={(event) =>
                    setItems(
                      items.map((entry, position) =>
                        position === index
                          ? { ...entry, discrepancyReason: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <FieldError field={`items.${index}.discrepancyReason`} errors={state.errors} />
              </fieldset>
            )
          })}
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
