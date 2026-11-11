import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useRecordsById } from '@/lib/use-records-by-id'
import { useOutgoingDeliveryById } from '@/features/logistics/outgoing-deliveries.hooks'
import { useChangeRunMembers, useDeliveryRunById } from '@/features/logistics/delivery-runs.hooks'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import { getApiError, getErrorMessage } from '@/lib/api-client'
import { useCursorLookup } from '@/lib/use-cursor-lookup'
import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { OverflowValue } from '@/components/ui/OverflowValue'
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
  const [search, setSearch] = useState('')
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
  const trips = useCursorLookup<DeliveryRunRecord>(
    '/delivery-runs',
    {
      statuses: ['DRAFT'],
      warehouseId: delivery?.warehouseId,
      ...(search.trim() ? { q: search.trim() } : {}),
    },
    eligible,
  )
  const acceptsTrip = (entry: DeliveryRunRecord) =>
    entry.status === 'DRAFT' &&
    Array.isArray(entry.deliveries) &&
    entry.warehouseId === delivery?.warehouseId &&
    entry.deliveries.length + (entry.warehouseTransfers?.length ?? 0) < 100 &&
    !entry.deliveries.some((member) => member.id === deliveryId)
  const availableTrips = trips.items.filter(acceptsTrip)
  const run = runQuery.data
  const drivers = useRecordsById<{ id: number; firstName: string; lastName: string }>(
    '/employees',
    [run?.driverEmployeeId, ...availableTrips.map((trip) => trip.driverEmployeeId)],
  )
  const vehicles = useRecordsById<{ id: number; plateNumber: string }>('/delivery-vehicles', [
    run?.deliveryVehicleId,
    ...availableTrips.map((trip) => trip.deliveryVehicleId),
  ])
  const eligibleRun =
    !runQuery.isError &&
    run?.status === 'DRAFT' &&
    run.id === Number(runId) &&
    Array.isArray(run.deliveries) &&
    run.warehouseId === delivery?.warehouseId &&
    run.deliveries.length + (run.warehouseTransfers?.length ?? 0) < 100 &&
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
        latestRun.data.deliveries.length + (latestRun.data.warehouseTransfers?.length ?? 0) >= 100 ||
        latestRun.data.deliveries.some((member) => member.id === deliveryId)
      ) {
        setReview(true)
        throw Error('The delivery or trip changed. Refresh and review before confirming again.')
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
        throw Error('The delivery was not added. Review the trip before trying again.')
      }
      toast.success('Delivery added to trip.')
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
      <DialogContent closeDisabled={busy} className="flex max-h-[calc(100dvh-2rem)] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Delivery to Trip</DialogTitle>
          <DialogDescription>Choose an existing trip or create a new one.</DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-col gap-4 overflow-y-auto overscroll-contain">
        {deliveryQuery.isPending && <p role="status">Loading delivery…</p>}
        {(error || deliveryQuery.isError || runQuery.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              {error || 'Could not load the selected delivery or trip.'}
            </AlertDescription>
          </Alert>
        )}
        {delivery && (
          <section aria-label="Delivery information" className="flex min-w-0 flex-col gap-1 rounded-md bg-secondary px-3 py-2">
          <p className="text-sm font-medium">
            {delivery.deliveryNumber} · Sales Order #{delivery.salesOrderId}
          </p>
          {delivery.warehouseId != null && <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            Warehouse:{' '}
            <OverflowValue value={warehouses.data.find((warehouse) => warehouse.id === delivery.warehouseId)?.name ??
              `Warehouse #${delivery.warehouseId}`} />
          </div>}
          </section>
        )}
        {delivery && !eligible && (
          <p role="status" className="text-sm">
            {delivery.runId != null
              ? 'This delivery has already been added to a trip.'
              : 'This delivery is not available for assignment. Refresh to check its current status.'}
          </p>
        )}
        {delivery?.runId != null && (
          <Button onClick={() => onAssigned(delivery.runId!)}>View Trip</Button>
        )}
        {eligible && (
          <>
            <div className="flex items-end justify-between gap-3">
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Label htmlFor="assignment-search">Available trips</Label>
                <Input
                  id="assignment-search"
                  aria-label="Search delivery trips"
                  placeholder="Search trip number..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  disabled={busy || review}
                />
              </div>
              <Button
                variant="outline"
                disabled={busy || review}
                onClick={() => onCreate(delivery!)}
              >
                Create New Trip
              </Button>
            </div>
            {trips.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  {getErrorMessage(trips.error)}{' '}
                  <Button
                    variant="link"
                    disabled={busy || trips.isFetching}
                    onClick={() => void trips.reload()}
                  >
                    Reload trips
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <div className="min-w-0">
              <DataTable<DeliveryRunRecord>
                data={availableTrips}
                pagination={false}
                appearance="subtle"
                isLoading={trips.isPending}
                getRowKey={(trip) => trip.id}
                emptyContent={
                  trips.isError
                    ? 'Trips could not be loaded.'
                    : 'No eligible trips shown. Create a new trip or load more results.'
                }
                columns={[
                  {
                    id: 'trip',
                    header: 'Trip',
                    cell: ({ row }) => {
                      const tripDriver = drivers.data.find(
                        (entry) => entry.id === row.driverEmployeeId,
                      )
                      const tripVehicle = vehicles.data.find(
                        (entry) => entry.id === row.deliveryVehicleId,
                      )
                      return (
                        <div className="flex flex-col gap-1 text-sm">
                          <Button
                            variant={runId === String(row.id) ? 'secondary' : 'outline'}
                            aria-pressed={runId === String(row.id)}
                            disabled={busy || review || trips.isFetching}
                            onClick={() => setRunId(String(row.id))}
                          >
                            {row.runNumber}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {warehouses.data.find((entry) => entry.id === row.warehouseId)?.name ??
                              `Warehouse #${row.warehouseId}`}{' '}
                            &middot; {row.deliveries.length}{' '}
                            {row.deliveries.length === 1 ? 'delivery' : 'deliveries'} assigned
                          </span>
                          {(row.driverEmployeeId || row.deliveryVehicleId) && (
                            <span className="text-xs text-muted-foreground">
                              {[
                                tripDriver
                                  ? `${tripDriver.firstName} ${tripDriver.lastName}`
                                  : row.driverEmployeeId
                                    ? `Driver #${row.driverEmployeeId}`
                                    : null,
                                tripVehicle?.plateNumber ??
                                  (row.deliveryVehicleId
                                    ? `Vehicle #${row.deliveryVehicleId}`
                                    : null),
                              ]
                                .filter(Boolean)
                                .join(' / ')}
                            </span>
                          )}
                          {row.scheduledDepartureAt && (
                            <span className="text-xs text-muted-foreground">
                              Departure:{' '}
                              {new Date(row.scheduledDepartureAt).toLocaleString('en-PH', {
                                timeZone: 'Asia/Manila',
                              })}
                            </span>
                          )}
                        </div>
                      )
                    },
                  },
                ]}
              />
            </div>
            {trips.hasNextPage && (
              <Button
                variant="outline"
                disabled={busy || review || trips.isFetching}
                onClick={() => void trips.fetchNextPage()}
              >
                {trips.isFetching ? 'Loading...' : 'Load more results'}
              </Button>
            )}
            {run && (
              <p className="text-sm" role="status">
                {eligibleRun
                  ? `Selected trip: ${run.runNumber}`
                  : 'This trip is no longer available. Refresh to review it.'}
              </p>
            )}
          </>
        )}
        {review && run && (
          <Button variant="outline" disabled={busy} onClick={() => onAssigned(run.id)}>
            Review Trip
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
        </div>
        <DialogFooter className="shrink-0 border-t border-border pt-3">
          <Button variant="outline" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          {eligible && (
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
              {busy ? 'Adding…' : 'Add to Trip'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
