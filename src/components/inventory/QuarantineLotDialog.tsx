import { Check, PackageCheck, PackageMinus, PencilLine } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { decimalLimitError } from '@/lib/decimal-limits'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/features/auth/AuthContext'
import {
  useCorrectQuarantineCondition,
  useQuarantineLot,
  useQuarantineConditionChanges,
  useQuarantineResolutions,
  useResolveQuarantine,
} from '@/features/logistics/quarantine.hooks'
import type { QuarantineCondition, QuarantineLot } from '@/features/logistics/quarantine.types'
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'
import { parseStockCents } from '@/features/logistics/stock-display'
import { decimalString } from '@/features/logistics/purchase-pricing'
import { getApiError, getErrorMessage } from '@/lib/api-client'
import { useStockMetadata } from '@/features/logistics/use-stock-metadata'

type Action = 'CLEAR' | 'REMOVE' | 'CORRECT'
const choices = [
  {
    value: 'CLEAR',
    label: 'Release Stock',
    icon: PackageCheck,
    description: 'Return inspected goods to available stock.',
  },
  {
    value: 'REMOVE',
    label: 'Remove Stock',
    icon: PackageMinus,
    description: 'Permanently reduce physical inventory.',
  },
  {
    value: 'CORRECT',
    label: 'Correct Condition',
    icon: PencilLine,
    description: 'Change the condition while keeping goods quarantined.',
  },
] as const
const conditionLabels: Record<QuarantineCondition, string> = {
  DAMAGED: 'Damaged',
  SPOILED: 'Spoiled',
}
const sourceLabels: Record<QuarantineLot['sourceKind'], string> = {
  MANUAL: 'Manual',
  INCOMING_DELIVERY: 'Incoming Delivery',
  OUTGOING_DELIVERY: 'Outgoing Delivery',
  WAREHOUSE_TRANSFER: 'Warehouse Transfer',
}
const snapshot = (lot: QuarantineLot) =>
  JSON.stringify([lot.id, lot.stockItemId, lot.condition, lot.remainingQuantity, lot.revision])
const displayQuantity = (value: unknown) => {
  const parsed = parseStockCents(value)
  return parsed === null ? 'Unavailable' : decimalString(parsed)
}

export function QuarantineLotDialog({
  selectedLot,
  stock: suppliedStock,
  onClose,
}: {
  selectedLot: QuarantineLot
  stock?: StockItemWithRelations
  onClose: () => void
}) {
  const query = useQuarantineLot(selectedLot.id)
  const lot = query.data
  const stockId = lot?.stockItemId ?? selectedLot.stockItemId
  const needsStockDetails = suppliedStock?.id !== stockId
  const stockDetails = useStockMetadata(needsStockDetails ? stockId : undefined)
  const stock = needsStockDetails ? stockDetails.data : suppliedStock
  const changes = useQuarantineConditionChanges(selectedLot.id)
  const resolutions = useQuarantineResolutions(selectedLot.id)
  const { isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const correct = useCorrectQuarantineCondition()
  const resolve = useResolveQuarantine()
  const [action, setAction] = useState<Action | null>(null)
  const [condition, setCondition] = useState<QuarantineCondition>(selectedLot.condition)
  const [drafts, setDrafts] = useState<Record<Action, { quantity: string; reason: string }>>({
    CLEAR: { quantity: '', reason: '' },
    REMOVE: { quantity: '', reason: '' },
    CORRECT: { quantity: '', reason: '' },
  })
  const [confirmedSnapshot, setConfirmedSnapshot] = useState<string | null>(null)
  const [discardOpen, setDiscardOpen] = useState(false)
  function requestClose() {
    if (pending) return
    if (Object.values(drafts).some((draft) => draft.quantity.trim() || draft.reason.trim()))
      setDiscardOpen(true)
    else onClose()
  }
  const [removal, setRemoval] = useState<{
    snapshot: string
    quantity: string
    reason: string
  } | null>(null)
  const [error, setError] = useState('')
  type Attempt = {
    action: Action
    payload: {
      expectedRevision: number
      requestId: string
      reason: string
      condition: QuarantineCondition
      action: 'CLEAR' | 'REMOVE'
      quantity: string
    }
  }
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [checking, setChecking] = useState(false)
  const inFlight = useRef(false)
  const pending = checking || correct.isPending || resolve.isPending
  const remaining = lot ? parseStockCents(lot.remainingQuantity) : null
  const isOpen = remaining !== null && remaining > 0n
  const unit = stock?.inventoryItem.unit ?? ''
  const metadataAvailable =
    (!needsStockDetails ||
      (!stockDetails.isPending && !stockDetails.isFetching && !stockDetails.isError)) &&
    stock?.id === lot?.stockItemId &&
    !!stock?.inventoryItem.name &&
    !!stock?.warehouse.name &&
    !!unit
  const disabled =
    pending ||
    query.isFetching ||
    query.isError ||
    !canManage ||
    !isOpen ||
    uncertain ||
    !metadataAvailable
  const draft = action ? drafts[action] : { quantity: '', reason: '' }
  const amount = parseStockCents(draft.quantity)
  const signature = lot ? snapshot(lot) : ''
  const safetyConfirmed = confirmedSnapshot === signature
  const quantityError = !draft.quantity.trim()
    ? ''
    : decimalLimitError(draft.quantity, true) ||
      (amount === null
        ? 'Enter a quantity with up to two decimals.'
        : amount <= 0n
          ? 'Quantity must be greater than zero.'
          : remaining === null
            ? 'Remaining quarantined quantity is unavailable.'
            : amount > remaining
              ? 'Quantity cannot exceed remaining quarantined stock.'
              : '')
  const valid =
    !!action &&
    !!draft.reason.trim() &&
    (action === 'CORRECT'
      ? ['DAMAGED', 'SPOILED'].includes(condition) && condition !== lot?.condition
      : amount !== null &&
        !quantityError &&
        amount > 0n &&
        remaining !== null &&
        amount <= remaining &&
        (action !== 'CLEAR' || safetyConfirmed))
  const actionRequirements = [
    action &&
      action !== 'CORRECT' &&
      (!draft.quantity.trim() || quantityError) &&
      (draft.quantity.trim() ? 'correct the quantity' : 'enter a quantity'),
    action && !draft.reason.trim() && 'add a reason',
    action === 'CLEAR' && !safetyConfirmed && 'confirm inspection and safety',
    action === 'CORRECT' && condition === lot?.condition && 'select a different condition',
  ].filter((requirement): requirement is string => !!requirement)
  const actionGuidance =
    actionRequirements.length > 0
      ? `To enable ${
          action === 'CLEAR'
            ? 'Release Stock'
            : action === 'REMOVE'
              ? 'Review Removal'
              : 'Save Correction'
        }, ${actionRequirements.join(', ')}.`
      : ''
  function change(field: 'quantity' | 'reason', value: string) {
    if (!action) return
    setDrafts((current) => ({ ...current, [action]: { ...current[action], [field]: value } }))
    if (field === 'quantity') setConfirmedSnapshot(null)
    setError('')
  }
  async function apply(finalRemoval = false, retry = false) {
    if (
      inFlight.current ||
      (!retry && (disabled || !valid)) ||
      !lot ||
      !action ||
      (retry && !attempt)
    )
      return
    inFlight.current = true
    setChecking(true)
    setError('')
    let mutationStarted = false
    try {
      const fresh = retry ? { data: lot, isError: false } : await query.refetch()
      if (fresh.isError || !fresh.data)
        throw Error(
          'The current quarantine lot could not be checked. Reload and review before confirming.',
        )
      const current = fresh.data
      if (
        !current ||
        (!retry && snapshot(current) !== signature) ||
        (!retry && finalRemoval && removal?.snapshot !== signature)
      )
        throw Error(
          'This quarantine lot changed. Review its current balance and condition, then confirm again. Your inputs have been kept.',
        )
      if (!retry && action === 'REMOVE' && !finalRemoval) {
        setRemoval({
          snapshot: signature,
          quantity: decimalString(amount!),
          reason: draft.reason.trim(),
        })
        return
      }
      if (
        !retry &&
        action === 'REMOVE' &&
        (!removal ||
          removal.quantity !== decimalString(amount!) ||
          removal.reason !== draft.reason.trim())
      )
        throw Error('Review the removal quantity and reason, then confirm again.')
      const command = retry
        ? attempt!
        : {
            action,
            payload: {
              expectedRevision: current.revision,
              requestId: crypto.randomUUID(),
              condition,
              reason: draft.reason.trim(),
              action: action === 'REMOVE' ? ('REMOVE' as const) : ('CLEAR' as const),
              quantity: action === 'CORRECT' ? '' : decimalString(amount!),
            },
          }
      setAttempt(command)
      mutationStarted = true
      if (action === 'CORRECT')
        await correct.mutateAsync({
          id: current.id,
          payload: {
            condition: command.payload.condition,
            reason: command.payload.reason,
            expectedRevision: command.payload.expectedRevision,
            requestId: command.payload.requestId,
          },
        })
      else
        await resolve.mutateAsync({
          id: current.id,
          payload: {
            action: command.payload.action,
            quantity: command.payload.quantity,
            reason: command.payload.reason,
            expectedRevision: command.payload.expectedRevision,
            requestId: command.payload.requestId,
          },
        })
      toast.success(
        action === 'CORRECT'
          ? 'Stock condition corrected. Goods remain quarantined.'
          : action === 'CLEAR'
            ? 'Quarantined goods released to available stock.'
            : 'Quarantined goods removed from inventory.',
      )
      setDrafts((previous) => ({ ...previous, [action]: { quantity: '', reason: '' } }))
      setAttempt(null)
      setUncertain(false)
      setAction(null)
      setConfirmedSnapshot(null)
      setRemoval(null)
    } catch (cause) {
      if (mutationStarted) {
        const status = getApiError(cause)?.status
        setUncertain(!status || status >= 500)
      }
      setConfirmedSnapshot(null)
      setRemoval(null)
      setError(getErrorMessage(cause))
    } finally {
      inFlight.current = false
      setChecking(false)
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault()
    void apply()
  }
  const quantityLabel = action === 'CLEAR' ? 'Quantity to release' : 'Quantity to remove'
  return (
    <>
      <Dialog open onOpenChange={(next) => !next && requestClose()}>
        <DialogContent
          closeDisabled={pending}
          className="flex max-h-[calc(100svh-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl"
        >
          <DialogHeader className="shrink-0 px-6 pr-14 pt-6 text-left">
            <DialogTitle>Review Quarantined Stock</DialogTitle>
            <DialogDescription>
              Review the balance and history, then choose an action.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-6 pb-4">
            {query.isLoading ? (
              <p role="status">Loading current quarantine record...</p>
            ) : !lot ? (
              <Alert variant="destructive">
                <AlertDescription>
                  {query.error
                    ? getErrorMessage(query.error)
                    : 'This quarantine lot is no longer available.'}
                  <Button type="button" variant="link" onClick={() => void query.refetch()}>
                    Reload lot
                  </Button>
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <dl
                  aria-label="Quarantined stock summary"
                  className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-2 text-sm"
                >
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Product</dt>
                    <dd className="font-medium">
                      <OverflowValue value={stock?.inventoryItem.name ?? 'Unavailable'} />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Warehouse</dt>
                    <dd className="font-medium">
                      <OverflowValue value={stock?.warehouse.name ?? 'Unavailable'} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Current condition</dt>
                    <dd>{conditionLabels[lot.condition]}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Remaining quarantined</dt>
                    <dd className="whitespace-nowrap font-medium tabular-nums">
                      {displayQuantity(lot.remainingQuantity)} {unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Source</dt>
                    <dd>{sourceLabels[lot.sourceKind]}</dd>
                  </div>
                  {lot.sourceKind === 'WAREHOUSE_TRANSFER' &&
                    lot.warehouseTransferItemId != null && (
                      <div>
                        <dt className="text-xs text-muted-foreground">Transfer line</dt>
                        <dd>#{lot.warehouseTransferItemId}</dd>
                      </div>
                    )}
                </dl>
                <details>
                  <summary className="cursor-pointer rounded text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                    Audit history
                  </summary>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">
                        Originally reported condition
                      </dt>
                      <dd>{conditionLabels[lot.reportedCondition]}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Originally reported</dt>
                      <dd className="whitespace-nowrap tabular-nums">
                        {displayQuantity(lot.initialQuantity)} {unit}
                      </dd>
                    </div>
                    {lot.tagReason && (
                      <div className="col-span-2">
                        <dt className="text-xs text-muted-foreground">Report reason</dt>
                        <dd className="break-words">{lot.tagReason}</dd>
                      </div>
                    )}
                  </dl>
                  <ul className="mt-2 flex flex-col gap-3 text-sm">
                    <li>
                      Reported {lot.reportedCondition} on {new Date(lot.createdAt).toLocaleString()}
                      {lot.taggedByUserId !== null ? ` by user #${lot.taggedByUserId}` : ''}.
                    </li>
                    {changes.items.map((change) => (
                      <li key={`condition-${change.id}`}>
                        {change.fromCondition} to {change.toCondition}: {change.reason} — user #
                        {change.actorUserId}, {new Date(change.createdAt).toLocaleString()}
                      </li>
                    ))}
                    {resolutions.items.map((resolution) => (
                      <li key={`resolution-${resolution.id}`}>
                        {resolution.action} {resolution.quantity}: {resolution.reason} — user #
                        {resolution.actorUserId}, {new Date(resolution.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
                  {changes.isError && (
                    <p role="alert">
                      Condition history could not be loaded.{' '}
                      <Button variant="link" onClick={() => void changes.reload()}>
                        Retry condition history
                      </Button>
                    </p>
                  )}
                  {resolutions.isError && (
                    <p role="alert">
                      Resolution history could not be loaded.{' '}
                      <Button variant="link" onClick={() => void resolutions.reload()}>
                        Retry resolution history
                      </Button>
                    </p>
                  )}
                  {(changes.isLoading || resolutions.isLoading) && (
                    <p role="status">Loading history...</p>
                  )}
                  {changes.hasNextPage && (
                    <Button
                      variant="outline"
                      disabled={changes.isFetching}
                      onClick={() => void changes.fetchNextPage()}
                    >
                      Load more condition changes
                    </Button>
                  )}
                  {resolutions.hasNextPage && (
                    <Button
                      variant="outline"
                      disabled={resolutions.isFetching}
                      onClick={() => void resolutions.fetchNextPage()}
                    >
                      Load more resolutions
                    </Button>
                  )}
                </details>
                {remaining === 0n && (
                  <p className="text-sm text-muted-foreground">
                    This lot is closed. No quarantined quantity remains. Condition corrections and
                    resolutions are unavailable.
                  </p>
                )}
                {remaining === null && (
                  <p role="alert" className="text-sm text-destructive">
                    Remaining quarantined quantity is unavailable. Reload the lot before making
                    changes.
                  </p>
                )}
                {needsStockDetails && stockDetails.isPending && (
                  <p role="status" className="text-sm text-muted-foreground">
                    Loading selected stock details...
                  </p>
                )}
                {needsStockDetails && stockDetails.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {getErrorMessage(stockDetails.error)}
                      <Button
                        type="button"
                        variant="link"
                        disabled={stockDetails.isFetching}
                        onClick={() => void stockDetails.refetch()}
                      >
                        Reload stock details
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {!metadataAvailable && !(needsStockDetails && stockDetails.isPending) && (
                  <p className="text-sm text-muted-foreground">
                    Product, warehouse, or unit details are unavailable. Reload inventory before
                    making changes.
                  </p>
                )}
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                {uncertain && (
                  <Alert>
                    <AlertDescription>
                      The outcome is uncertain. Retry the same request to safely confirm the outcome
                      without recording it twice.
                      <Button
                        type="button"
                        variant="link"
                        disabled={pending || query.isFetching}
                        onClick={() => void apply(true, true)}
                      >
                        Retry same request
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {canManage && isOpen && (
                  <form
                    id="quarantine-resolution-form"
                    aria-label="Quarantine action"
                    onSubmit={submit}
                    className="flex min-w-0 flex-col gap-3 border-t pt-3"
                  >
                    <fieldset disabled={disabled} className="min-w-0">
                      <legend id="quarantine-action-label" className="mb-2 text-sm font-medium">
                        Action
                      </legend>
                      <div
                        role="radiogroup"
                        aria-labelledby="quarantine-action-label"
                        className="flex flex-col gap-2"
                      >
                        {choices.map(({ value, label, description, icon: Icon }) => (
                          <label key={value} className="min-w-0 cursor-pointer">
                            <input
                              type="radio"
                              name="quarantine-action"
                              value={value}
                              aria-label={label}
                              aria-describedby={`quarantine-action-${value}-description`}
                              checked={action === value}
                              className="peer sr-only"
                              onChange={() => {
                                setAction(value)
                                setConfirmedSnapshot(null)
                                setRemoval(null)
                                setError('')
                              }}
                            />
                            <span className="flex min-h-14 items-center gap-3 rounded-md border border-input bg-card px-3 py-2 transition-colors hover:bg-accent peer-checked:border-primary-contrast peer-checked:bg-primary-subtle peer-checked:ring-1 peer-checked:ring-primary-contrast peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                              <Icon aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                              <span className="flex min-w-0 flex-1 flex-col gap-1">
                                <span className="text-sm font-medium leading-5">{label}</span>
                                <span id={`quarantine-action-${value}-description`} className="text-xs leading-4 text-muted-foreground">
                                  {description}
                                </span>
                              </span>
                              <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center rounded-full border border-input">
                                {action === value && <Check className="size-3" />}
                              </span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    {!action && <p className="text-sm text-muted-foreground">Select an action to continue.</p>}
                    {action && (
                      <fieldset
                        disabled={disabled}
                        className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)]"
                      >
                        {action === 'CORRECT' ? (
                          <>
                            <div className="flex min-w-40 flex-col gap-2">
                              <Label htmlFor="quarantine-condition">Corrected condition</Label>
                              <Select
                                value={condition}
                                onValueChange={(value) => {
                                  setCondition(value as QuarantineCondition)
                                  setError('')
                                }}
                              >
                                <SelectTrigger id="quarantine-condition">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectGroup>
                                    <SelectItem value="DAMAGED">Damaged</SelectItem>
                                    <SelectItem value="SPOILED">Spoiled</SelectItem>
                                  </SelectGroup>
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="quarantine-quantity">{quantityLabel}</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  id="quarantine-quantity"
                                  inputMode="decimal"
                                  className="min-w-28 max-w-full"
                                  style={{ width: `${Math.max(14, draft.quantity.length + 4)}ch` }}
                                  value={draft.quantity}
                                  onChange={(event) => change('quantity', event.target.value)}
                                  aria-invalid={!!quantityError}
                                  aria-describedby={`quarantine-quantity-help${quantityError ? ' quarantine-quantity-error' : ''}`}
                                  required
                                />
                                <span className="text-sm">{unit}</span>
                              </div>
                              <p id="quarantine-quantity-help" className="sr-only">
                                Remaining quarantined: {displayQuantity(lot.remainingQuantity)}{' '}
                                {unit}
                              </p>
                              {quantityError && (
                                <p
                                  id="quarantine-quantity-error"
                                  role="alert"
                                  className="text-xs text-destructive"
                                >
                                  {quantityError}
                                </p>
                              )}
                            </div>
                          </>
                        )}
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="quarantine-reason">Reason</Label>
                          <Input
                            id="quarantine-reason"
                            value={draft.reason}
                            onChange={(event) => change('reason', event.target.value)}
                            required
                          />
                        </div>
                        {action === 'CLEAR' && (
                          <Label className="flex items-start gap-2 text-sm sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={safetyConfirmed}
                              onChange={(event) =>
                                setConfirmedSnapshot(event.target.checked ? signature : null)
                              }
                              className="mt-0.5 size-4 shrink-0"
                            />
                            I confirm these goods have been inspected and are safe to return to
                            available stock.
                          </Label>
                        )}
                        {actionGuidance && (
                          <p
                            role="status"
                            aria-live="polite"
                            className="text-xs text-muted-foreground sm:col-span-2"
                          >
                            {actionGuidance}
                          </p>
                        )}
                      </fieldset>
                    )}
                  </form>
                )}
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-3">
            <Button type="button" variant="outline" disabled={pending} onClick={requestClose}>
              Close
            </Button>
            {action && canManage && isOpen && (
              <Button
                type="submit"
                form="quarantine-resolution-form"
                variant={action === 'REMOVE' ? 'destructive' : 'default'}
                disabled={disabled || !valid}
              >
                {pending
                  ? 'Checking and saving...'
                  : action === 'CLEAR'
                    ? 'Release Stock'
                    : action === 'REMOVE'
                      ? 'Review Removal'
                      : 'Save Correction'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteModal
        open={discardOpen}
        title="Discard Changes?"
        description="Your unsubmitted quarantine entries will be lost."
        confirmText="Discard Changes"
        cancelText="Keep Editing"
        onClose={() => setDiscardOpen(false)}
        onConfirm={onClose}
      />
      {removal && (
        <ConfirmDeleteModal
          open
          title="Remove from Inventory"
          description="This decreases physical inventory and permanently removes the selected goods. The quarantine audit history will be retained."
          itemName={stock?.inventoryItem.name}
          itemDetails={`${stock?.warehouse.name} / ${lot?.condition} / ${removal.quantity} ${unit}`}
          confirmText="Confirm Removal"
          onClose={() => setRemoval(null)}
          onConfirm={() => apply(true)}
        />
      )}
    </>
  )
}
