import { toast } from '@/lib/notifications'
import { useRef, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { DateTimeField } from '@/components/common/DateTimeField'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { toManilaSchedule, manilaScheduleToIso } from '@/lib/manila-schedule'
import { getErrorMessage } from '@/lib/api-client'
import { updateIncomingDraftApi } from '@/features/logistics/incoming-deliveries.api'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'

export function IncomingIssueCorrection({
  delivery,
  currentRevision,
  target,
  warehouses,
  onSaved,
  onBusyChange,
  onCancel,
}: {
  delivery: IncomingDeliveryRecord
  currentRevision: number
  target: 'warehouse' | 'schedule'
  warehouses: Warehouse[]
  onBusyChange: (busy: boolean) => void
  onSaved: () => Promise<unknown>
  onCancel: () => void
}) {
  // Hold the revision shown when editing began; never substitute a newer revision for unsaved edits.
  const [revision] = useState(delivery.revision)
  const [warehouseId, setWarehouseId] = useState('')
  const [arrival, setArrival] = useState(toManilaSchedule(delivery.scheduledAt))
  const [error, setError] = useState('')
  const [requiresRefresh, setRequiresRefresh] = useState(false)
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const changed = revision !== currentRevision
  const client = useQueryClient()
  const mutation = useMutation({
    mutationFn: updateIncomingDraftApi.bind(null, delivery.id),
    retry: false,
  })
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!event.currentTarget.reportValidity() || lock.current || requiresRefresh || changed) return
    lock.current = true
    setSaving(true)
    onBusyChange(true)
    setError('')
    try {
      if (
        target === 'warehouse' &&
        !warehouses.some((warehouse) => warehouse.id === Number(warehouseId) && warehouse.isActive)
      )
        throw Error('Select an active receiving warehouse.')
      const scheduledAt = target === 'schedule' ? manilaScheduleToIso(arrival) : undefined
      if (target === 'schedule' && !scheduledAt) throw Error('Enter a valid arrival date and time.')
      const saved = await mutation.mutateAsync({
        expectedRevision: revision,
        ...(target === 'warehouse'
          ? { warehouseId: Number(warehouseId) }
          : { scheduledAt: scheduledAt ?? undefined }),
      })
      if (
        target === 'warehouse'
          ? saved.warehouseId !== Number(warehouseId)
          : Date.parse(saved.scheduledAt ?? '') !== Date.parse(scheduledAt ?? '')
      )
        throw Error(
          'The saved correction could not be verified. Refresh the delivery before continuing.',
        )
      await client.invalidateQueries({ queryKey: ['incoming-deliveries'] })
      await onSaved()
      toast.success('Delivery correction saved.')
    } catch (error) {
      setError(getErrorMessage(error))
      setRequiresRefresh(true)
      await client.invalidateQueries({ queryKey: ['incoming-deliveries'] })
    } finally {
      lock.current = false
      setSaving(false)
      onBusyChange(false)
    }
  }
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-3"
      aria-label="Correct incoming delivery"
    >
      {target === 'warehouse' ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="issue-warehouse">Receiving warehouse</Label>
          <SearchableDropdown
            id="issue-warehouse"
            value={warehouseId}
            onValueChange={setWarehouseId}
            getOptionValue={(option) => option.value}
            getOptionLabel={(option) => option.label}
            searchPlaceholder="Search warehouses"
            emptyMessage="No active warehouses available"
            ariaLabel="Receiving warehouse"
            options={warehouses
              .filter((warehouse) => warehouse.isActive)
              .map((warehouse) => ({ value: String(warehouse.id), label: warehouse.name }))}
            placeholder="Select an active warehouse"
            disabled={saving || requiresRefresh || changed}
          />
        </div>
      ) : (
        <DateTimeField
          id="issue-arrival"
          label="Arrival date and time"
          value={arrival}
          onChange={setArrival}
          required
          disabled={saving || requiresRefresh || changed}
        />
      )}
      {changed && !saving && (
        <p role="alert" className="text-sm text-destructive">
          This delivery changed while you were editing. Close the edit section and review its
          current details before trying again.
        </p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error} Close the edit section and refresh the delivery before trying again.
          </AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button
          type="submit"
          size="sm"
          disabled={
            saving || requiresRefresh || changed || (target === 'warehouse' && !warehouseId)
          }
        >
          {saving ? 'Saving…' : 'Save Correction'}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={saving} onClick={onCancel}>
          Close Edit
        </Button>
      </div>
    </form>
  )
}
