import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { VehicleDetailModal } from '@/components/deliveries/shared/VehicleDetailModal'
import {
  VEHICLE_CONDITION_LABELS as CONDITIONS,
  VEHICLE_AVAILABILITY_LABELS as STATUS_LABELS,
} from '@/features/logistics/vehicle-assignment'
import { useState } from 'react'
import { Eye, MoreVertical, Plus, Search, Truck } from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useDeactivateVehicle,
  useReactivateVehicle,
  useUpdateVehicleStatus,
} from '@/features/logistics/delivery-vehicles.hooks'
import { useResourcePage } from '@/lib/use-cursor-page'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
import { useRecordsById } from '@/lib/use-records-by-id'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { useNavigate } from 'react-router'
import { ROUTES } from '@/routes'
import { useAuth } from '@/features/auth/AuthContext'
import type { DeliveryVehicle, VehicleStatus, VehicleOperationalStatus } from '@/features/logistics/delivery-vehicles.types'
import {
  getVehicleAssignments,
  getVehicleAvailabilityStatus,
  getVehicleCondition,
} from '@/features/logistics/vehicle-assignment'
import { VehicleStatusBadge } from '@/components/deliveries/shared/VehicleStatusBadge'
import { VehicleModal } from './VehicleModal'
import { toast } from 'sonner'

type VehicleRow = {
  vehicle: DeliveryVehicle
  condition: string
  status: VehicleStatus | 'ARCHIVED'
  assignment: string
  driver: string
}
export function VehicleList() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [editVehicleId, setEditVehicleId] = useState<number | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [viewVehicleId, setViewVehicleId] = useState<number | null>(null)
  const navigate = useNavigate()
  const [archiveId, setArchiveId] = useState<number | null>(null)
  const vehicleQuery = useResourcePage<DeliveryVehicle>('/delivery-vehicles', {
    includeInactive: activeTab === 'ARCHIVED' ? 'only' : 'false',
    ...(search.trim() ? { q: search.trim() } : {}),
  }, true, statusFilter)
  const vehicles = vehicleQuery.items
  const deliveryQuery = useRecordsById<DeliveryRunRecord>('/delivery-runs', vehicles.map(vehicle => vehicle.activeRunId))
  const deliveries = deliveryQuery.data
  const deactivate = useDeactivateVehicle({ onViewArchive: () => setActiveTab('ARCHIVED') })
  const reactivate = useReactivateVehicle()
  const updateStatus = useUpdateVehicleStatus()
  const { isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const pending = deactivate.isPending || reactivate.isPending || updateStatus.isPending
  const rows: VehicleRow[] = vehicles.map((vehicle) => {
    const assignments = getVehicleAssignments(vehicle.id, deliveries)
    const drivers = assignments.flatMap((run) =>
      run.driverEmployeeId == null ? [] : [`Employee #${run.driverEmployeeId}`],
    )
    return {
      vehicle,
      condition: CONDITIONS[getVehicleCondition(vehicle)],
      status: getVehicleAvailabilityStatus(vehicle, deliveries),
      assignment: assignments.map((delivery) => delivery.runNumber).join(', ') || '—',
      driver: [...new Set(drivers)].join(', ') || '—',
    }
  })
  const active = rows.filter((row) => row.vehicle.isActive)
  const archived = rows.filter((row) => !row.vehicle.isActive)
  const filtered = (activeTab === 'ACTIVE' ? active : archived).filter(
    (row) => activeTab === 'ARCHIVED' || statusFilter === 'ALL' || row.status === statusFilter,
  )
  const viewVehicle = vehicles.find((vehicle) => vehicle.id === viewVehicleId)
  const archiveVehicle = vehicles.find((vehicle) => vehicle.id === archiveId)
  const canChangeCondition = (vehicle: DeliveryVehicle) =>
    !deliveryQuery.isPending &&
    !deliveryQuery.isError &&
    vehicle.activeRunId == null && getVehicleAssignments(vehicle.id, deliveries).length === 0
  const changeCondition = (vehicle: DeliveryVehicle, operationalStatus: VehicleOperationalStatus) => {
    if (!canChangeCondition(vehicle)) {
      toast.error('Finish or cancel the active delivery before changing this vehicle’s condition.')
      return
    }
    updateStatus.mutate({ id: vehicle.id, operationalStatus })
  }
  const columns: ColumnDef<VehicleRow>[] = [
    {
      id: 'vehicle',
      header: 'Vehicle',
      accessorFn: (row) => row.vehicle.model || row.vehicle.vehicleType,
      sortable: false,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="font-medium">{row.vehicle.model || row.vehicle.vehicleType}</span>
          <span className="text-xs text-muted-foreground">
            {row.vehicle.capacityKg
              ? `${Number(row.vehicle.capacityKg).toLocaleString()} kg capacity`
              : 'Capacity not specified'}
          </span>
        </div>
      ),
    },
    {
      id: 'plate',
      header: 'Plate Number',
      accessorFn: (row) => row.vehicle.plateNumber,
      sortable: false,
      cell: ({ row }) => <span className="font-medium">{row.vehicle.plateNumber}</span>,
    },
    {
      id: 'type',
      header: 'Vehicle Type',
      accessorFn: (row) => row.vehicle.vehicleType,
      sortable: false,
    },
    { id: 'condition', header: 'Condition', accessorKey: 'condition', sortable: false },
    {
      id: 'status',
      header: 'Availability / Status',
      accessorKey: 'status',
      sortable: false,
      cell: ({ row }) =>
        row.status === 'ARCHIVED' ? (
          <Badge variant="outline">Archived</Badge>
        ) : (
          <VehicleStatusBadge status={row.status} />
        ),
    },
    {
      id: 'assignment',
      header: 'Current Assignment',
      accessorKey: 'assignment',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          {getVehicleAssignments(row.vehicle.id, deliveries).map((delivery) => (
            <Button
              key={delivery.id}
              variant="link"
              size="sm"
              className="justify-start text-[13px]"
              onClick={() => navigate(`${ROUTES.deliveryRuns}?run=${delivery.id}`)}
            >
              {delivery.runNumber}
            </Button>
          ))}
          {row.assignment === '—' && '—'}
        </div>
      ),
    },
    { id: 'driver', header: 'Driver', accessorKey: 'driver' },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`View vehicle ${row.vehicle.plateNumber}`}
            onClick={() => {
              setViewVehicleId(row.vehicle.id)
            }}
          >
            <Eye data-icon="inline-start" />
          </Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for ${row.vehicle.plateNumber}`}
                >
                  <MoreVertical data-icon="inline-start" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => {
                      setEditVehicleId(row.vehicle.id)
                      setIsModalOpen(true)
                    }}
                  >
                    Edit Vehicle
                  </DropdownMenuItem>
                  {row.vehicle.isActive ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={pending || !canChangeCondition(row.vehicle)}
                        onClick={() => changeCondition(row.vehicle, 'MAINTENANCE')}
                      >
                        Mark Under Maintenance
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={pending || !canChangeCondition(row.vehicle)}
                        onClick={() => changeCondition(row.vehicle, 'OUT_OF_SERVICE')}
                      >
                        Mark Out of Service
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={
                          pending ||
                          !canChangeCondition(row.vehicle) ||
                          row.vehicle.operationalStatus === 'SERVICEABLE'
                        }
                        onClick={() => changeCondition(row.vehicle, 'SERVICEABLE')}
                      >
                        Return to Service
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={
                          pending ||
                          !canChangeCondition(row.vehicle) ||
                          !row.vehicle.isAvailable
                        }
                        onClick={() => setArchiveId(row.vehicle.id)}
                      >
                        Archive Vehicle
                      </DropdownMenuItem>
                    </>
                  ) : (
                    <DropdownMenuItem
                      disabled={pending || !canChangeCondition(row.vehicle)}
                      onClick={() => reactivate.mutate(row.vehicle.id)}
                    >
                      Restore Vehicle
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ),
    },
  ]
  const countStatus = (status: VehicleStatus) =>
    active.filter((row) => row.status === status).length
  const availableCount = countStatus('AVAILABLE')
  const inDeliveryCount = countStatus('IN_DELIVERY')
  const maintenanceCount = countStatus('MAINTENANCE')
  const outOfServiceCount = countStatus('OUT_OF_SERVICE')
  const fleetOverview = [
    { label: 'Total', count: active.length, valueClass: 'text-foreground' },
    {
      label: 'Available',
      count: availableCount,
      valueClass: availableCount > 0 ? 'text-primary-text' : 'text-muted-foreground',
    },
    {
      label: 'In Delivery',
      count: inDeliveryCount,
      valueClass: inDeliveryCount > 0 ? 'text-foreground' : 'text-muted-foreground',
    },
    {
      label: 'Maintenance',
      count: maintenanceCount,
      valueClass: maintenanceCount > 0 ? 'text-status-warning-foreground' : 'text-muted-foreground',
    },
    {
      label: 'Out of Service',
      count: outOfServiceCount,
      valueClass: outOfServiceCount > 0 ? 'text-destructive' : 'text-muted-foreground',
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description="Manage vehicles, their condition, and delivery assignments.">
        Vehicles
      </PageHeader>
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Vehicles"

        archivedLabel="Archived Vehicles"

        activeIcon={<Truck className="size-3.5" />}
        bannerDescription="Archived ERJV vehicles remain linked to their historical deliveries and can be restored."
      />
      <p className="text-xs text-muted-foreground">Status filters apply to the current page. Search matches plate, model, or vehicle type.</p>
      <dl
        aria-label="Fleet status overview"
        className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/40 p-3 sm:grid-cols-3 lg:grid-cols-5"
      >
        {fleetOverview.map(({ label, count, valueClass }) => (
          <div key={label} className="flex min-w-0 flex-col gap-1">
            <dt className="truncate text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className={`text-lg font-semibold leading-6 tabular-nums ${valueClass}`}>
              {count}
            </dd>
          </div>
        ))}
      </dl>
      <PageToolbar>
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search vehicles"
            placeholder="Search plate, model, or vehicle type..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        {activeTab === 'ACTIVE' && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Vehicle status filter" className="h-9 text-[13px] sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {Object.entries(STATUS_LABELS)
                  .filter(([value]) => value !== 'ARCHIVED')
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        {canManage && activeTab === 'ACTIVE' && (
          <Button
            size="sm"
            onClick={() => {
              setEditVehicleId(null)
              setIsModalOpen(true)
            }}
          >
            <Plus data-icon="inline-start" />
            Add Vehicle
          </Button>
        )}
      </PageToolbar>
      {(vehicleQuery.isError || deliveryQuery.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            Vehicle availability could not be checked.{' '}
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                void vehicleQuery.reload()
                void deliveryQuery.refetch()
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <DataTable
            pagination={false}
            manualSorting
        appearance="management"
        data={filtered}
        columns={columns}
        getRowKey={(row) => row.vehicle.id}
        isLoading={vehicleQuery.isFetching || deliveryQuery.isLoading}
        tableClassName="min-w-[900px]"
        emptyContent={
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Truck className="size-8 text-muted-foreground" />
            <p className="text-sm font-semibold">
              No {activeTab === 'ARCHIVED' ? 'archived' : 'active'} vehicles found
            </p>
            <p className="text-xs text-muted-foreground">Adjust the search or status filter.</p>
          </div>
        }
      />
      <CursorPageControls {...vehicleQuery} label="Vehicle" />
      <VehicleModal
        vehicle={vehicles.find((vehicle) => vehicle.id === editVehicleId) || null}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      {viewVehicle && <VehicleDetailModal
        key={viewVehicleId ?? 'vehicle'}
        viewVehicle={viewVehicle}
        open={viewVehicleId !== null}
        onClose={() => setViewVehicleId(null)}
        onViewRun={(id) => navigate(`${ROUTES.deliveryRuns}?run=${id}`)}
      />}
      <ConfirmDeleteModal
        open={archiveId !== null}
        onClose={() => setArchiveId(null)}
        onConfirm={async () => {
          if (
            archiveVehicle &&
            canChangeCondition(archiveVehicle) &&
            archiveVehicle.isAvailable
          )
            await deactivate.mutateAsync(archiveVehicle)
          else throw new Error('Vehicle has an active delivery assignment.')
        }}
        title="Archive Vehicle"
        description="Archive this vehicle while preserving its details and historical deliveries."
        itemName={archiveVehicle?.plateNumber}
        confirmText="Archive Vehicle"
      />
    </div>
  )
}
