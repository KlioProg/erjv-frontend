import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useRecordsById } from '@/lib/use-records-by-id'
import { useOutgoingDeliveryById } from '@/features/logistics/outgoing-deliveries.hooks'
import { useChangeRunMembers, useDeliveryRunById } from '@/features/logistics/delivery-runs.hooks'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import { getApiError, getErrorMessage } from '@/lib/api-client'
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

export function AssignDeliveryToRun({
  deliveryId,
  onClose,
  onCreate,
  onAssigned,
}: {
  deliveryId: number
  onClose: () => void
  onCreate: (delivery: OutgoingDeliveryRecord) => void
  onAssigned: (runId: number) => void
}) {
  const deliveryQuery = useOutgoingDeliveryById(deliveryId)
  const delivery = deliveryQuery.data
  const warehouses = useRecordsById<{ id: number; name: string }>('/warehouses', [
    delivery?.warehouseId,
  ])
  const [runId, setRunId] = useState('')
  const [step, setStep] = useState<'choice' | 'existing'>('choice')
  const previousStep = useRef(step)
  useEffect(() => {
    if (previousStep.current !== step)
      document
        .getElementById(step === 'existing' ? 'assignment-run' : 'assignment-existing')
        ?.focus()
    previousStep.current = step
  }, [step])
  const runQuery = useDeliveryRunById(Number(runId) || undefined)
  const change = useChangeRunMembers()
  const [error, setError] = useState('')
  const [review, setReview] = useState(false)
  const [saving, setSaving] = useState(false)
  const submitting = useRef(false)
  const busy = saving || change.isPending
  const eligible =
    !deliveryQuery.isError &&
    delivery?.id === deliveryId &&
    delivery.status === 'READY' &&
    delivery.runId === null &&
    Number.isSafeInteger(delivery.warehouseId) &&
    Number(delivery.warehouseId) > 0
  const run = runQuery.data
  const drivers = useRecordsById<{ id: number; firstName: string; lastName: string }>(
    '/employees',
    [run?.driverEmployeeId],
  )
  const vehicles = useRecordsById<{ id: number; plateNumber: string }>('/delivery-vehicles', [
    run?.deliveryVehicleId,
  ])
  const driver = drivers.data.find((record) => record.id === run?.driverEmployeeId)
  const vehicle = vehicles.data.find((record) => record.id === run?.deliveryVehicleId)
  const eligibleRun =
    !runQuery.isError &&
    run?.status === 'DRAFT' &&
    run.id === Number(runId) &&
    Array.isArray(run.deliveries) &&
    run.warehouseId === delivery?.warehouseId &&
    run.deliveries.length < 100 &&
    !run.deliveries.some((member) => member.id === deliveryId)
  async function assign() {
    if (submitting.current || busy || review || !eligible || !eligibleRun || !delivery || !run)
      return
    submitting.current = true
    setSaving(true)
    try {
      setError('')
      const [latestDelivery, latestRun] = await Promise.all([
        deliveryQuery.refetch(),
        runQuery.refetch(),
      ])
      if (latestDelivery.isError || latestRun.isError || !latestDelivery.data || !latestRun.data)
        throw Error('Could not verify these records. Refresh and review before trying again.')
      if (
        latestDelivery.data.id !== deliveryId ||
        latestRun.data.id !== run.id ||
        latestDelivery.data.revision !== delivery.revision ||
        latestRun.data.revision !== run.revision ||
        latestDelivery.data.status !== 'READY' ||
        latestDelivery.data.runId !== null ||
        latestDelivery.data.warehouseId !== run.warehouseId ||
        latestRun.data.status !== 'DRAFT' ||
        latestRun.data.warehouseId !== delivery.warehouseId ||
        !Array.isArray(latestRun.data.deliveries) ||
        latestRun.data.deliveries.length >= 100 ||
        latestRun.data.deliveries.some((member) => member.id === deliveryId)
      ) {
        setReview(true)
        throw Error('The delivery or run changed. Refresh and review before confirming again.')
      }
      const saved = await change.mutateAsync({
        id: run.id,
        payload: {
          expectedRevision: run.revision,
          add: [{ deliveryId, expectedRevision: delivery.revision }],
        },
      })
      if (
        saved.id !== run.id ||
        !Number.isSafeInteger(saved.revision) ||
        saved.revision <= run.revision ||
        !saved.deliveries?.some((member) => member.id === deliveryId)
      ) {
        setReview(true)
        throw Error('Assignment was not confirmed. Review the run before submitting again.')
      }
      toast.success('Delivery added to run.')
      onAssigned(saved.id)
    } catch (cause) {
      setError(getErrorMessage(cause))
      if (
        getApiError(cause)?.code === 'STALE_REVISION' ||
        !getApiError(cause)?.status ||
        (getApiError(cause)?.status ?? 0) >= 500
      )
        setReview(true)
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent closeDisabled={busy}>
        <DialogHeader>
          <DialogTitle>Assign Delivery</DialogTitle>
          <DialogDescription>Choose which delivery trip will carry this order.</DialogDescription>
        </DialogHeader>
        {deliveryQuery.isPending && <p role="status">Loading delivery…</p>}
        {(error || deliveryQuery.isError || runQuery.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              {error || 'Could not load the selected delivery or run.'}
            </AlertDescription>
          </Alert>
        )}
        {delivery && (
          <p className="text-sm font-medium">
            {delivery.deliveryNumber} · Sales Order #{delivery.salesOrderId}
          </p>
        )}
        {delivery?.warehouseId != null && (
          <p className="text-sm text-muted-foreground">
            Warehouse:{' '}
            {warehouses.data.find((warehouse) => warehouse.id === delivery.warehouseId)?.name ??
              `Warehouse #${delivery.warehouseId}`}
          </p>
        )}
        {delivery && !eligible && (
          <p role="status" className="text-sm">
            {delivery.runId != null
              ? 'This delivery has already been assigned.'
              : 'This delivery is not available for assignment. Refresh to check its current status.'}
          </p>
        )}
        {delivery?.runId != null && (
          <Button onClick={() => onAssigned(delivery.runId!)}>Open Run</Button>
        )}
        {eligible && step === 'choice' && (
          <div className="grid gap-3">
            <Button
              id="assignment-existing"
              disabled={busy || review}
              onClick={() => setStep('existing')}
            >
              Use Existing Run
            </Button>
            <Button variant="outline" disabled={busy || review} onClick={() => onCreate(delivery!)}>
              Create New Run
            </Button>
          </div>
        )}
        {eligible && step === 'existing' && (
          <>
            <Label htmlFor="assignment-run">Choose an existing delivery run</Label>
            <CursorLookup<DeliveryRunRecord>
              id="assignment-run"
              path="/delivery-runs"
              value={runId}
              label="Run"
              filter={{ statuses: ['DRAFT'], warehouseId: delivery!.warehouseId }}
              getLabel={(entry) =>
                `${entry.runNumber} · ${warehouses.data.find((warehouse) => warehouse.id === entry.warehouseId)?.name ?? `Warehouse #${entry.warehouseId}`} · ${entry.deliveries?.length ?? 'Unknown'} ${entry.deliveries?.length === 1 ? 'delivery' : 'deliveries'} assigned`
              }
              emptyMessage="No eligible runs on this page. Create a new run or check another page."
              accept={(entry) =>
                entry.status === 'DRAFT' &&
                Array.isArray(entry.deliveries) &&
                entry.warehouseId === delivery!.warehouseId &&
                entry.deliveries.length < 100 &&
                !entry.deliveries.some((member) => member.id === deliveryId)
              }
              onChange={setRunId}
              disabled={busy || review}
            />
            {run && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm" role="status">
                <p className="font-medium">{run.runNumber}</p>
                <p>
                  {eligibleRun
                    ? `${run.deliveries.length} ${run.deliveries.length === 1 ? 'delivery' : 'deliveries'} assigned`
                    : 'This run is no longer available. Refresh to review it.'}
                </p>
                {run.driverEmployeeId != null && (
                  <p>
                    {driver
                      ? `${driver.firstName} ${driver.lastName}`
                      : 'Driver details unavailable'}
                  </p>
                )}
                {run.deliveryVehicleId != null && (
                  <p>{vehicle?.plateNumber ?? 'Vehicle details unavailable'}</p>
                )}
                {run.scheduledDepartureAt && (
                  <p>
                    Departure:{' '}
                    {new Date(run.scheduledDepartureAt).toLocaleString('en-PH', {
                      timeZone: 'Asia/Manila',
                    })}
                  </p>
                )}
              </div>
            )}
            {!eligibleRun && (
              <Button
                variant="outline"
                disabled={busy || review}
                onClick={() => onCreate(delivery!)}
              >
                Create New Run
              </Button>
            )}
          </>
        )}
        {review && run && (
          <Button variant="outline" disabled={busy} onClick={() => onAssigned(run.id)}>
            Open run for review
          </Button>
        )}
        {(review || deliveryQuery.isError || runQuery.isError) && (
          <Button
            variant="ghost"
            disabled={busy || deliveryQuery.isFetching || runQuery.isFetching}
            onClick={() =>
              void Promise.all([
                deliveryQuery.refetch(),
                ...(runId ? [runQuery.refetch()] : []),
              ]).then((results) => {
                if (results.every((result) => !result.isError)) {
                  setReview(false)
                  setError('')
                }
              })
            }
          >
            Refresh to review
          </Button>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() => (step === 'existing' && eligible ? setStep('choice') : onClose())}
          >
            {step === 'existing' && eligible ? 'Back' : 'Cancel'}
          </Button>
          {step === 'existing' && eligibleRun && (
            <Button
              disabled={
                !eligible ||
                !eligibleRun ||
                busy ||
                review ||
                runQuery.isFetching ||
                deliveryQuery.isFetching
              }
              onClick={() => void assign()}
            >
              {busy ? 'Assigning…' : 'Assign Delivery'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
