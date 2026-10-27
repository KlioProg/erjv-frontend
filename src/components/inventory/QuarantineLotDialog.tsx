import { useRef, useState, type FormEvent } from 'react'
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
  useQuarantineLots,
  useResolveQuarantine,
} from '@/features/logistics/quarantine.hooks'
import type {
  QuarantineCondition,
  QuarantineLot,
  StockItemWithRelations,
} from '@/features/logistics/stock-items.types'
import { parseStockCents } from '@/features/logistics/stock-display'
import { decimalString } from '@/features/logistics/purchase-pricing'
import { getApiError, getErrorMessage } from '@/lib/api-client'

type Action = 'CLEAR' | 'REMOVE' | 'CORRECT'
const choices = [
  {
    value: 'CLEAR',
    label: 'Release to Available Stock',
    description: 'Release inspected goods that are safe to return to available stock.',
  },
  {
    value: 'REMOVE',
    label: 'Remove from Inventory',
    description: 'Permanently remove unusable goods and reduce physical inventory.',
  },
  {
    value: 'CORRECT',
    label: 'Correct Condition',
    description:
      'Change the DAMAGED or SPOILED classification while keeping the goods quarantined.',
  },
] as const
const snapshot = (lot: QuarantineLot) =>
  JSON.stringify([
    lot.id,
    lot.stockItemId,
    lot.condition,
    lot.remainingQuantity,
    lot.conditionChanges?.length,
    lot.resolutions?.length,
  ])
const displayQuantity = (value: unknown) => {
  const parsed = parseStockCents(value)
  return parsed === null ? 'Unavailable' : decimalString(parsed)
}

export function QuarantineLotDialog({
  selectedLot,
  stock,
  onClose,
}: {
  selectedLot: QuarantineLot
  stock?: StockItemWithRelations
  onClose: () => void
}) {
  const query = useQuarantineLots({ stockItemId: selectedLot.stockItemId })
  const lot = query.data?.find((candidate) => candidate.id === selectedLot.id)
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
    if (Object.values(drafts).some((draft) => draft.quantity.trim() || draft.reason.trim())) setDiscardOpen(true)
    else onClose()
  }
  const [removal, setRemoval] = useState<{
    snapshot: string
    quantity: string
    reason: string
  } | null>(null)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [checking, setChecking] = useState(false)
  const inFlight = useRef(false)
  const pending = checking || correct.isPending || resolve.isPending
  const remaining = lot ? parseStockCents(lot.remainingQuantity) : null
  const isOpen = remaining !== null && remaining > 0n
  const unit = stock?.inventoryItem.unit ?? ''
  const metadataAvailable =
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
    : amount === null
      ? 'Enter a quantity with up to two decimals.'
      : amount <= 0n
        ? 'Quantity must be greater than zero.'
        : remaining === null
          ? 'Remaining quarantined quantity is unavailable.'
          : amount > remaining
            ? 'Quantity cannot exceed remaining quarantined stock.'
            : ''
  const valid =
    !!action &&
    !!draft.reason.trim() &&
    (action === 'CORRECT'
      ? ['DAMAGED', 'SPOILED'].includes(condition) && condition !== lot?.condition
      : amount !== null &&
        amount > 0n &&
        remaining !== null &&
        amount <= remaining &&
        (action !== 'CLEAR' || safetyConfirmed))
  function change(field: 'quantity' | 'reason', value: string) {
    if (!action) return
    setDrafts((current) => ({ ...current, [action]: { ...current[action], [field]: value } }))
    if (field === 'quantity') setConfirmedSnapshot(null)
    setError('')
  }
  async function apply(finalRemoval = false) {
    if (inFlight.current || disabled || !lot || !action || !valid) return
    inFlight.current = true
    setChecking(true)
    setError('')
    let mutationStarted = false
    try {
      const fresh = await query.refetch()
      if (fresh.isError || !fresh.data)
        throw Error(
          'The current quarantine lot could not be checked. Reload and review before confirming.',
        )
      const current = fresh.data.find((candidate) => candidate.id === selectedLot.id)
      if (
        !current ||
        snapshot(current) !== signature ||
        (finalRemoval && removal?.snapshot !== signature)
      )
        throw Error(
          'This quarantine lot changed. Review its current balance and condition, then confirm again. Your inputs have been kept.',
        )
      if (action === 'REMOVE' && !finalRemoval) {
        setRemoval({
          snapshot: signature,
          quantity: decimalString(amount!),
          reason: draft.reason.trim(),
        })
        return
      }
      if (
        action === 'REMOVE' &&
        (!removal ||
          removal.quantity !== decimalString(amount!) ||
          removal.reason !== draft.reason.trim())
      )
        throw Error('Review the removal quantity and reason, then confirm again.')
      mutationStarted = true
      if (action === 'CORRECT')
        await correct.mutateAsync({
          id: current.id,
          payload: { condition, reason: draft.reason.trim() },
        })
      else
        await resolve.mutateAsync({
          id: current.id,
          payload: { action, quantity: decimalString(amount!), reason: draft.reason.trim() },
        })
      toast.success(
        action === 'CORRECT'
          ? 'Stock condition corrected. Goods remain quarantined.'
          : action === 'CLEAR'
            ? 'Quarantined goods released to available stock.'
            : 'Quarantined goods removed from inventory.',
      )
      setDrafts((previous) => ({ ...previous, [action]: { quantity: '', reason: '' } }))
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
          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-6 pb-5">
            {query.isLoading ? (
              <p role="status">Loading current quarantine record...</p>
            ) : query.isError || !lot ? (
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
                <dl className="grid min-w-0 grid-cols-2 gap-3 text-sm">
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Product</dt>
                    <OverflowValue asChild value={stock?.inventoryItem.name ?? 'Unavailable'}>
                      <dd className="truncate font-medium">
                        {stock?.inventoryItem.name ?? 'Unavailable'}
                      </dd>
                    </OverflowValue>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-muted-foreground">Warehouse</dt>
                    <OverflowValue asChild value={stock?.warehouse.name ?? 'Unavailable'}>
                      <dd className="truncate font-medium">
                        {stock?.warehouse.name ?? 'Unavailable'}
                      </dd>
                    </OverflowValue>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Current condition</dt>
                    <dd>{lot.condition}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Originally reported condition</dt>
                    <dd>{lot.reportedCondition}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Remaining quarantined</dt>
                    <dd className="font-medium tabular-nums">
                      {displayQuantity(lot.remainingQuantity)} {unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Originally reported</dt>
                    <dd className="tabular-nums">
                      {displayQuantity(lot.initialQuantity)} {unit}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Source</dt>
                    <dd>{lot.sourceKind.replaceAll('_', ' ')}</dd>
                  </div>
                  {lot.tagReason && (
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Report reason</dt>
                      <dd className="break-words">{lot.tagReason}</dd>
                    </div>
                  )}
                </dl>
                <details>
                  <summary className="cursor-pointer text-sm font-medium">Audit history</summary>
                  <ul className="mt-2 flex flex-col gap-3 text-sm">
                    <li>
                      Reported {lot.reportedCondition} on {new Date(lot.createdAt).toLocaleString()}
                      {lot.taggedByUserId !== null ? ` by user #${lot.taggedByUserId}` : ''}.
                    </li>
                    {(lot.conditionChanges ?? []).map((change) => (
                      <li key={`condition-${change.id}`}>
                        {change.fromCondition} to {change.toCondition}: {change.reason} — user #
                        {change.actorUserId}, {new Date(change.createdAt).toLocaleString()}
                      </li>
                    ))}
                    {(lot.resolutions ?? []).map((resolution) => (
                      <li key={`resolution-${resolution.id}`}>
                        {resolution.action} {resolution.quantity}: {resolution.reason} — user #
                        {resolution.actorUserId}, {new Date(resolution.createdAt).toLocaleString()}
                      </li>
                    ))}
                  </ul>
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
                {!metadataAvailable && (
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
                      The outcome is uncertain. This change will not be retried automatically.
                      Review the balance and audit history before another action.
                      <Button
                        type="button"
                        variant="link"
                        disabled={pending || query.isFetching}
                        onClick={async () => {
                          const fresh = await query.refetch()
                          if (!fresh.isError && fresh.data) {
                            setUncertain(false)
                            setConfirmedSnapshot(null)
                            setAction(null)
                            setError('')
                          }
                        }}
                      >
                        Refresh and review
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
                {canManage && isOpen && (
                  <form
                    id="quarantine-resolution-form"
                    aria-label="Quarantine action"
                    onSubmit={submit}
                    className="flex min-w-0 flex-col gap-4 border-t pt-4"
                  >
                    <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-2">
                      <legend className="mb-2 text-sm font-medium">
                        What would you like to do?
                      </legend>
                      {choices.map((choice) => (
                        <Button
                          key={choice.value}
                          type="button"
                          variant="outline"
                          aria-pressed={action === choice.value}
                          onClick={() => {
                            setAction(choice.value)
                            setConfirmedSnapshot(null)
                            setRemoval(null)
                            setError('')
                          }}
                          className="h-auto min-h-11 w-full flex-col items-start gap-1 whitespace-normal px-3 py-2 text-left aria-pressed:border-primary aria-pressed:bg-primary/5"
                        >
                          <span className={choice.value === 'REMOVE' ? 'text-destructive' : ''}>
                            {choice.label}
                          </span>
                          <span className="text-xs font-normal leading-5 text-muted-foreground">
                            {choice.description}
                          </span>
                        </Button>
                      ))}
                    </fieldset>
                    {action && (
                      <fieldset disabled={disabled} className="flex min-w-0 flex-col gap-4">
                        {action === 'CORRECT' ? (
                          <>
                            <p className="text-xs text-muted-foreground">
                              Correcting the condition keeps this stock quarantined. It does not
                              release goods or remove physical inventory.
                            </p>
                            <div className="flex flex-col gap-2">
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
                            {action === 'REMOVE' && (
                              <p className="text-xs text-destructive">
                                This removes the selected quantity from quarantined stock and
                                decreases physical inventory.
                              </p>
                            )}
                            <div className="flex flex-col gap-2">
                              <Label htmlFor="quarantine-quantity">{quantityLabel}</Label>
                              <Input
                                id="quarantine-quantity"
                                inputMode="decimal"
                                value={draft.quantity}
                                onChange={(event) => change('quantity', event.target.value)}
                                aria-invalid={!!quantityError}
                                aria-describedby={`quarantine-quantity-help${quantityError ? ' quarantine-quantity-error' : ''}`}
                                required
                              />
                              <p
                                id="quarantine-quantity-help"
                                className="text-xs text-muted-foreground"
                              >
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
                          <Label className="flex items-start gap-2 text-sm">
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
                      </fieldset>
                    )}
                  </form>
                )}
              </>
            )}
          </div>
          <DialogFooter className="shrink-0 border-t px-6 py-4">
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
                    ? 'Confirm Release'
                    : action === 'REMOVE'
                      ? 'Review Removal'
                      : 'Confirm Condition Correction'}
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
