import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { fetchQuarantineLotApi } from '@/features/logistics/quarantine.api'
import { useAuth } from '@/features/auth/AuthContext'
import {
  useCorrectQuarantineCondition,
  useRefreshQuarantine,
} from '@/features/logistics/quarantine.hooks'
import type { QuarantineLot } from '@/features/logistics/quarantine.types'
import { parseStockCents } from '@/features/logistics/stock-display'
import { getApiError, getErrorMessage } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function CorrectQuarantineConditionDialog({
  lot: selectedLot,
  onClose,
}: {
  lot: QuarantineLot
  onClose: () => void
}) {
  const [lot, setLot] = useState(selectedLot)
  const { user } = useAuth()
  const allowed = ['ADMIN', 'MANAGER', 'SUPERADMIN'].includes(user?.role ?? '')
  const mutation = useCorrectQuarantineCondition(),
    refresh = useRefreshQuarantine()
  const [attempt, setAttempt] = useState<{
    condition: typeof lot.condition
    reason: string
    expectedRevision: number
    requestId: string
  } | null>(null)
  const [uncertain, setUncertain] = useState(false)
  const [condition, setCondition] = useState(lot.condition)
  const [reason, setReason] = useState(''),
    [error, setError] = useState('')
  const [busy, setBusy] = useState(false),
    [review, setReview] = useState(false)
  const lock = useRef(false)
  const [saved, setSaved] = useState(false)
  async function refreshData() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    try {
      await refresh()
      if (!saved) setLot(await fetchQuarantineLotApi(lot.id))
      if (saved) onClose()
      else {
        setReview(false)
        setError(
          'Review the current condition before retrying. The previous request may already have been recorded.',
        )
      }
    } catch (cause) {
      setError(getErrorMessage(cause))
      setReview(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function submit() {
    if (
      lock.current ||
      busy ||
      review ||
      saved ||
      !allowed ||
      (!uncertain && condition === lot.condition) ||
      !reason.trim() ||
      (!uncertain && (parseStockCents(lot.remainingQuantity) ?? 0n) <= 0n)
    )
      return
    lock.current = true
    setBusy(true)
    setError('')
    try {
      const payload = attempt ?? {
        condition,
        reason: reason.trim(),
        expectedRevision: lot.revision,
        requestId: crypto.randomUUID(),
      }
      setAttempt(payload)
      await mutation.mutateAsync({ id: lot.id, payload })
      setSaved(true)
      await refresh()
      toast.success('Quarantine condition corrected')
      onClose()
    } catch (cause) {
      setError(`${getErrorMessage(cause)} Refresh and review the current lot before continuing.`)
      const status = getApiError(cause)?.status
      setUncertain(!status || status >= 500)
      if (status && status < 500) setAttempt(null)
      setReview(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent closeDisabled={busy} className="flex max-h-[90dvh] flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Correct lot #{lot.id} condition</DialogTitle>
          <DialogDescription>
            Current condition: {lot.condition}. This corrects the classification and records an
            audit reason.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <div className="min-h-0 space-y-4 overflow-y-auto">
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <fieldset
              disabled={busy || review || uncertain || !allowed || saved}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="correct-condition">Corrected condition</Label>
                <select
                  id="correct-condition"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={condition}
                  onChange={(event) => setCondition(event.target.value as typeof condition)}
                >
                  <option value="DAMAGED">Damaged</option>
                  <option value="SPOILED">Spoiled</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition-reason">Correction reason</Label>
                <Textarea
                  id="condition-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required
                />
              </div>
            </fieldset>
          </div>
          <DialogFooter className="shrink-0 border-t pt-3">
            {review && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void refreshData()}
              >
                Refresh lot
              </Button>
            )}
            <Button
              type="submit"
              disabled={
                busy ||
                review ||
                !allowed ||
                (!uncertain && condition === lot.condition) ||
                !reason.trim() ||
                (!uncertain && (parseStockCents(lot.remainingQuantity) ?? 0n) <= 0n)
              }
            >
              {uncertain ? 'Retry same correction' : 'Save condition'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
