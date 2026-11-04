import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DialogFooter } from '@/components/ui/dialog'
import { getApiError, getApiFieldErrors, getErrorMessage } from '@/lib/api-client'
import { useRecordsById } from '@/lib/use-records-by-id'
import { decimalString, parseOrderDecimal } from '@/lib/order-amounts'
import { useTransferWrite } from '@/features/warehouse-transfers/warehouse-transfers.hooks'
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

type Reference = { id: number; name: string; isActive: boolean }
type FormProps = {
  record?: WarehouseTransfer
  onSaved: () => void
  onCancel: () => void
  onBusy: (busy: boolean) => void
}

function useSubmission({ onSaved, onBusy }: FormProps) {
  const mutation = useTransferWrite()
  const lock = useRef(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const [review, setReview] = useState(false)
  const submit = async (command: TransferCommand, validation: Record<string, string>) => {
    if (lock.current || review) return
    setErrors(validation)
    setMessage('')
    if (Object.keys(validation).length) return
    lock.current = true
    onBusy(true)
    try {
      await mutation.mutateAsync(command)
      onSaved()
    } catch (error) {
      setErrors(getApiFieldErrors(error))
      setMessage(getErrorMessage(error))
      const status = getApiError(error)?.status
      setReview(status === undefined || status === 409 || status >= 500)
    } finally {
      lock.current = false
      onBusy(false)
    }
  }
  return { submit, errors, message, review, busy: mutation.isPending }
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
  const initialSchedule = record?.scheduledDepartureAt
    ? new Date(Date.parse(record.scheduledDepartureAt) + 8 * 3_600_000).toISOString().slice(0, 16)
    : ''
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
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {(
          [
            {
              field: 'sourceWarehouseId',
              label: 'Source Warehouse',
              value: source,
              set: setSource,
            },
            {
              field: 'destinationWarehouseId',
              label: 'Destination Warehouse',
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
              accept={(item) => item.isActive}
              getLabel={(item) => item.name}
              onChange={(id) => field.set(id)}
              disabled={state.busy || state.review}
              error={state.errors[field.field]}
            />
            <FieldError field={field.field} errors={state.errors} />
          </div>
        ))}
      </div>
      <FieldError field="items" errors={state.errors} />
      {items.map((item, index) => (
        <fieldset
          key={index}
          className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end"
        >
          <legend className="sr-only">Transfer item {index + 1}</legend>
          <div className="min-w-0 space-y-1">
            <Label htmlFor={`transfer-item-${index}`}>Item {index + 1}</Label>
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
            <FieldError field={`items.${index}.inventoryItemId`} errors={state.errors} />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`transfer-quantity-${index}`}>Quantity</Label>
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
      ))}
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={state.busy || state.review || items.length >= 100}
        onClick={() => setItems([...items, { inventoryItemId: 0, quantity: '' }])}
      >
        Add item
      </Button>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="transfer-schedule">Scheduled Departure (Manila)</Label>
          <Input
            id="transfer-schedule"
            type="datetime-local"
            value={schedule}
            onChange={(event) => setSchedule(event.target.value)}
            disabled={state.busy || state.review}
          />
          <FieldError field="scheduledDepartureAt" errors={state.errors} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="transfer-notes">Notes</Label>
          <Textarea
            id="transfer-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            disabled={state.busy || state.review}
          />
        </div>
      </div>
      <DialogFooter>
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
  receivedQuantity: 'Received at destination',
  damagedQuantity: 'Damaged at destination',
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
  const [items, setItems] = useState<TransferOutcome[]>(
    record.items.map((line) => ({
      warehouseTransferItemId: line.id,
      receivedQuantity: line.quantity,
      damagedQuantity: '0.00',
      returnedSellableQuantity: '0.00',
      returnedDamagedQuantity: '0.00',
      missingQuantity: '0.00',
      discrepancyReason: '',
    })),
  )
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const validation =
      action === 'reconcile'
        ? transferReconciliationErrors(record.items, items)
        : action === 'cancel' && !reason.trim()
          ? { reason: 'Enter a cancellation reason.' }
          : {}
    const revision = { expectedRevision: record.revision }
    const command: TransferCommand =
      action === 'reconcile'
        ? { action, id: record.id, payload: { ...revision, items } }
        : action === 'cancel'
          ? { action, id: record.id, payload: { ...revision, reason: reason.trim() } }
          : { action, id: record.id, payload: revision }
    void state.submit(command, validation)
  }
  return (
    <form onSubmit={submit} className="flex min-w-0 flex-col gap-4">
      <WriteMessage {...state} onReview={onCancel} />
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
          <p className="text-sm">
            Record all final quantities received at the destination. Include damaged, returned, and
            missing goods. These results are final.
          </p>
          <FieldError field="items" errors={state.errors} />
          {items.map((item, index) => {
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
              <fieldset key={line.id} className="min-w-0 space-y-2 border-t pt-3">
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
        <Button type="button" variant="outline" disabled={state.busy} onClick={onCancel}>
          Back
        </Button>
        <Button disabled={state.busy || state.review}>
          {state.busy
            ? 'Saving…'
            : action === 'dispatch'
              ? 'Send Goods'
              : action === 'reconcile'
                ? 'Save Receipt'
                : 'Cancel Transfer'}
        </Button>
      </DialogFooter>
    </form>
  )
}
