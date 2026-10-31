import { useState } from 'react'
import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { useResourcePage } from '@/lib/use-cursor-page'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
import { getErrorMessage } from '@/lib/api-client'
import {
  getVehicleAssignments,
  getVehicleCondition,
  getVehicleAvailabilityStatus,
  VEHICLE_CONDITION_LABELS as CONDITIONS,
  VEHICLE_AVAILABILITY_LABELS as STATUS_LABELS,
} from '@/features/logistics/vehicle-assignment'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

export function VehicleDetailModal({
  viewVehicle,
  open,
  onClose,
  onViewRun,
}: {
  viewVehicle?: DeliveryVehicle
  open: boolean
  onClose: () => void
  onViewRun: (id: number) => void
}) {
  const [historyStatus, setHistoryStatus] = useState('ALL')
  const query = useResourcePage<DeliveryRunRecord>('/delivery-runs', {
    deliveryVehicleId: viewVehicle?.id,
    ...(historyStatus !== 'ALL' ? { statuses: [historyStatus] } : {}),
  }, open && !!viewVehicle)
  const allTrips = query.items
  const trips = allTrips
  return (
    <Dialog open={open && !!viewVehicle} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{viewVehicle?.plateNumber || 'Vehicle'}</DialogTitle>
          <DialogDescription>Vehicle details and paged run history.</DialogDescription>
        </DialogHeader>
        {viewVehicle && (
          <>
            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
              {[
                ['Model / Make', viewVehicle.model || '—'],
                ['Vehicle Type', viewVehicle.vehicleType],
                ['Capacity', viewVehicle.capacityKg ? `${viewVehicle.capacityKg} kg` : '—'],
                ['Condition', CONDITIONS[getVehicleCondition(viewVehicle)]],
                [
                  'Availability / Status',
                  STATUS_LABELS[getVehicleAvailabilityStatus(viewVehicle, allTrips)],
                ],
                [
                  'Current Assignment',
                  getVehicleAssignments(viewVehicle.id, allTrips)
                    .map((delivery) => delivery.runNumber)
                    .join(', ') || '—',
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 font-medium">{value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
              {[
                ['Trips', allTrips.length],
                ['Completed', allTrips.filter((trip) => trip.status === 'COMPLETED').length],
                ['In Transit', allTrips.filter((trip) => trip.status === 'DISPATCHED').length],
                ['Cancelled', allTrips.filter((trip) => trip.status === 'CANCELLED').length],
              ].map(([label, count]) => (
                <div key={label} className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{count}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Run History</h2>
              <Select value={historyStatus} onValueChange={setHistoryStatus}>
                <SelectTrigger aria-label="Vehicle history status" className="h-9 w-44 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="ALL">All Runs</SelectItem>
                    {['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'].map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Counts reflect loaded runs matching this filter.</p>
            {query.isError && <p role="alert">{getErrorMessage(query.error)} <Button variant="link" onClick={() => void query.reload()}>Reload runs</Button></p>}
            <DataTable
              pagination={false}
              manualSorting
              isLoading={query.isFetching}
              data={trips}
              getRowKey={(delivery) => delivery.id}
              tableClassName="min-w-[640px]"
              columns={[
                {
                  id: 'reference',
                  header: 'Reference',
                  accessorKey: 'runNumber',
                  sortable: false,
                },
                {
                  id: 'members',
                  header: 'Deliveries',
                  cell: ({ row }) => row.deliveries.map((member) => member.deliveryNumber).join(', '),
                },
                {
                  id: 'date',
                  header: 'Date',
                  cell: ({ row }) => DeliveryUtils.formatDateTime(row.scheduledDepartureAt),
                },
                {
                  id: 'status',
                  header: 'Status',
                  cell: ({ row }) => <span>{row.status}</span>,
                },
                {
                  id: 'view',
                  header: 'Actions',
                  cell: ({ row }) => (
                    <Button variant="ghost" size="sm" onClick={() => onViewRun(row.id)}>
                      View Run
                    </Button>
                  ),
                },
              ]}
              emptyContent={
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No runs match this vehicle and status.
                </p>
              }
            />
            <CursorPageControls {...query} label="Run" />
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
