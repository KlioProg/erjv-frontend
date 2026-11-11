import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTransfer } from '@/features/warehouse-transfers/warehouse-transfers.hooks'
import type { WarehouseTransfer } from '@/features/warehouse-transfers/warehouse-transfers.types'
import { useChangeRunTransfers, useDeliveryRunById } from '@/features/logistics/delivery-runs.hooks'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { getErrorMessage } from '@/lib/api-client'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

export function AssignTransferToRun({
  transferId,
  onClose,
  onCreate,
  onAssigned,
}: {
  transferId: number
  onClose: () => void
  onCreate: (transfer: WarehouseTransfer) => void
  onAssigned: (id: number) => void
}) {
  const query = useTransfer(transferId)
  const transfer = query.data
  const [runId, setRunId] = useState('')
  const trip = useDeliveryRunById(Number(runId) || undefined)
  const change = useChangeRunTransfers()
  const lock = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const busy = saving || change.isPending
  const eligible = !query.isError && transfer?.status === 'DRAFT' && transfer.runId === null
  const accepts = (run: DeliveryRunRecord) =>
    run.status === 'DRAFT' &&
    run.warehouseId === transfer?.sourceWarehouseId &&
    run.deliveries.length + (run.warehouseTransfers?.length ?? 0) < 100 &&
    !run.warehouseTransfers?.some((member) => member.id === transferId)
  const ready =
    eligible &&
    trip.data &&
    accepts(trip.data) &&
    !trip.isError &&
    query.isFetchedAfterMount &&
    trip.isFetchedAfterMount &&
    !query.isFetching &&
    !trip.isFetching
  async function assign() {
    if (lock.current || busy || review || !ready || !transfer || !trip.data) return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      const [latestTransfer, latestTrip] = await Promise.all([query.refetch(), trip.refetch()])
      if (
        latestTransfer.isError ||
        latestTrip.isError ||
        !latestTransfer.data ||
        !latestTrip.data ||
        latestTransfer.data.revision !== transfer.revision ||
        latestTrip.data.revision !== trip.data.revision ||
        latestTransfer.data.status !== 'DRAFT' ||
        latestTransfer.data.runId !== null ||
        latestTransfer.data.sourceWarehouseId !== trip.data.warehouseId ||
        !accepts(latestTrip.data)
      )
        throw Error('The transfer or trip changed. Refresh and review before adding it.')
      const saved = await change.mutateAsync({
        id: trip.data.id,
        payload: {
          expectedRevision: trip.data.revision,
          add: [{ transferId, expectedRevision: transfer.revision }],
        },
      })
      if (
        saved.id !== trip.data.id ||
        saved.status !== 'DRAFT' ||
        !Number.isSafeInteger(saved.revision) ||
        saved.revision <= trip.data.revision ||
        !saved.warehouseTransfers?.some((member) => member.id === transferId)
      )
        throw Error(
          'Transfer membership was not confirmed. Review the saved trip before trying again.',
        )
      toast.success('Transfer added to trip.')
      onAssigned(saved.id)
    } catch (cause) {
      setError(getErrorMessage(cause))
      setReview(true)
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent closeDisabled={busy} className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add Transfer to Trip</DialogTitle>
          <DialogDescription>
            Choose a preparing trip from the source warehouse. Departure is confirmed in the trip.
          </DialogDescription>
        </DialogHeader>
        {query.isPending && <p role="status">Loading transfer…</p>}
        {(error || query.isError || trip.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              {error || getErrorMessage(query.error ?? trip.error)}
            </AlertDescription>
          </Alert>
        )}
        {transfer && <p className="text-sm font-medium">{transfer.transferNumber}</p>}
        {transfer?.runId != null ? (
          <Button onClick={() => onAssigned(transfer.runId!)}>View Trip</Button>
        ) : eligible ? (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-trip">Delivery trip</Label>
              <CursorLookup<DeliveryRunRecord>
                id="transfer-trip"
                path="/delivery-runs"
                value={runId}
                onChange={setRunId}
                filter={{ statuses: ['DRAFT'], warehouseId: transfer.sourceWarehouseId }}
                label="Delivery trip"
                getLabel={(run) => run.runNumber}
                accept={accepts}
                disabled={busy || review}
              />
            </div>
            <Button
              variant="outline"
              disabled={busy || review || query.isFetching}
              onClick={() => onCreate(transfer)}
            >
              Create New Trip
            </Button>
          </>
        ) : (
          transfer && <p role="status">This transfer is unavailable for trip assignment.</p>
        )}
        {(review || query.isError || trip.isError) && (
          <Button
            variant="outline"
            disabled={busy || query.isFetching || trip.isFetching}
            onClick={() =>
              void Promise.all([query.refetch(), ...(runId ? [trip.refetch()] : [])]).then(
                (results) => {
                  if (results.every((result) => !result.isError)) {
                    setError('')
                    setReview(false)
                  }
                },
              )
            }
          >
            Refresh to review
          </Button>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          {eligible && (
            <Button disabled={!ready || busy || review} onClick={() => void assign()}>
              {busy ? 'Adding…' : 'Add to Trip'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
