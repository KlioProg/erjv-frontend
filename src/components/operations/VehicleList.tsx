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
  useAllDeliveryVehicles,
  useDeactivateVehicle,
  useReactivateVehicle,
  useUpdateVehicleStatus,
} from '@/features/logistics/delivery-vehicles.hooks'
import { useOutgoingDeliveries } from '@/features/logistics/outgoing-deliveries.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { DeliveryVehicle, VehicleStatus } from '@/features/logistics/delivery-vehicles.types'
import {
  getVehicleAssignments,
  getVehicleAvailabilityStatus,
  getVehicleCondition,
} from '@/features/logistics/vehicle-assignment'
import { VehicleStatusBadge } from '@/components/deliveries/shared/VehicleStatusBadge'
import { DeliveryDetailModal } from '@/components/deliveries/shared/DeliveryDetailModal'
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
  const [historyDeliveryId, setHistoryDeliveryId] = useState<number | null>(null)
  const [archiveId, setArchiveId] = useState<number | null>(null)
  const vehicleQuery = useAllDeliveryVehicles()
  const { data: vehicles = [] } = vehicleQuery
  const deliveryQuery = useOutgoingDeliveries()
  const { data: deliveries = [] } = deliveryQuery
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: clients = [] } = useClients({ includeInactive: 'true' })
  const { data: employees = [] } = useEmployees({ includeInactive: 'true' })
  const deactivate = useDeactivateVehicle({ onViewArchive: () => setActiveTab('ARCHIVED') })
  const reactivate = useReactivateVehicle()
  const updateStatus = useUpdateVehicleStatus()
  const { isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const pending = deactivate.isPending || reactivate.isPending || updateStatus.isPending
  const rows: VehicleRow[] = vehicles.map((vehicle) => {
    const assignments = getVehicleAssignments(vehicle.id, deliveries)
    const drivers = assignments.flatMap((delivery) => {
      const employee = employees.find((employee) => employee.id === delivery.driverEmployeeId)
      return employee ? [`${employee.firstName} ${employee.lastName}`] : []
    })
    return {
      vehicle,
      condition: CONDITIONS[getVehicleCondition(vehicle)],
      status: getVehicleAvailabilityStatus(vehicle, deliveries),
      assignment: assignments.map((delivery) => delivery.deliveryNumber).join(', ') || '—',
      driver: [...new Set(drivers)].join(', ') || '—',
    }
  })
  const active = rows.filter((row) => row.vehicle.isActive)
  const archived = rows.filter((row) => !row.vehicle.isActive)
  const filtered = (activeTab === 'ACTIVE' ? active : archived).filter(
    (row) =>
      (activeTab === 'ARCHIVED' || statusFilter === 'ALL' || row.status === statusFilter) &&
      [
        row.vehicle.plateNumber,
        row.vehicle.model || '',
        row.vehicle.vehicleType,
        row.assignment,
        row.driver,
      ].some((value) => value.toLowerCase().includes(search.trim().toLowerCase())),
  )
  const viewVehicle = vehicles.find((vehicle) => vehicle.id === viewVehicleId)
  const archiveVehicle = vehicles.find((vehicle) => vehicle.id === archiveId)
  const canChangeCondition = (vehicle: DeliveryVehicle) =>
    !deliveryQuery.isPending &&
    !deliveryQuery.isError &&
    getVehicleAssignments(vehicle.id, deliveries).length === 0
  const changeCondition = (vehicle: DeliveryVehicle, status: VehicleStatus) => {
    if (!canChangeCondition(vehicle)) {
      toast.error('Finish or cancel the active delivery before changing this vehicle’s condition.')
      return
    }
    updateStatus.mutate({ id: vehicle.id, status })
  }
  const columns: ColumnDef<VehicleRow>[] = [
    {
      id: 'vehicle',
      header: 'Vehicle',
      accessorFn: (row) => row.vehicle.model || row.vehicle.vehicleType,
      sortable: true,
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span className="font-semibold">{row.vehicle.model || row.vehicle.vehicleType}</span>
          <span className="text-[11px] text-muted-foreground">
            {row.vehicle.capacity
              ? `${Number(row.vehicle.capacity).toLocaleString()} kg capacity`
              : 'Capacity not specified'}
          </span>
        </div>
      ),
    },
    {
      id: 'plate',
      header: 'Plate Number',
      accessorFn: (row) => row.vehicle.plateNumber,
      sortable: true,
      cell: ({ row }) => <span className="font-mono font-bold">{row.vehicle.plateNumber}</span>,
    },
    {
      id: 'type',
      header: 'Vehicle Type',
      accessorFn: (row) => row.vehicle.vehicleType,
      sortable: true,
    },
    { id: 'condition', header: 'Condition', accessorKey: 'condition', sortable: true },
    {
      id: 'status',
      header: 'Availability / Status',
      accessorKey: 'status',
      sortable: true,
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
              className="justify-start text-xs"
              onClick={() => setHistoryDeliveryId(delivery.id)}
            >
              {delivery.deliveryNumber}
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
                          row.vehicle.status === 'AVAILABLE'
                        }
                        onClick={() => changeCondition(row.vehicle, 'AVAILABLE')}
                      >
                        Return to Service
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={
                          pending ||
                          !canChangeCondition(row.vehicle) ||
                          row.vehicle.status === 'IN_DELIVERY'
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
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Vehicles</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Manage ERJV vehicles, their condition, and delivery assignments.
          </p>
        </div>
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
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ['Total', active.length],
          ['Available', active.filter((row) => row.status === 'AVAILABLE').length],
          ['In Delivery', active.filter((row) => row.status === 'IN_DELIVERY').length],
          ['Maintenance', active.filter((row) => row.status === 'MAINTENANCE').length],
          ['Out of Service', active.filter((row) => row.status === 'OUT_OF_SERVICE').length],
        ].map(([label, count]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 p-3"
          >
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <span className="font-mono text-lg font-bold">{count}</span>
          </div>
        ))}
      </div>
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Vehicles"
        activeCount={active.length}
        archivedLabel="Archived Vehicles"
        archivedCount={archived.length}
        activeIcon={<Truck className="size-3.5" />}
        bannerDescription="Archived ERJV vehicles remain linked to their historical deliveries and can be restored."
      />
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search vehicles"
            placeholder="Search plate, model, type, assignment, or driver..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
        {activeTab === 'ACTIVE' && (
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label="Vehicle status filter" className="h-9 text-xs sm:w-44">
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
      </div>
      {(vehicleQuery.isError || deliveryQuery.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            Vehicle availability could not be checked.{' '}
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                void vehicleQuery.refetch()
                void deliveryQuery.refetch()
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <DataTable
        data={filtered}
        columns={columns}
        getRowKey={(row) => row.vehicle.id}
        isLoading={vehicleQuery.isLoading || deliveryQuery.isLoading}
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
      <VehicleModal
        vehicle={vehicles.find((vehicle) => vehicle.id === editVehicleId) || null}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <VehicleDetailModal
        key={viewVehicleId ?? 'vehicle'}
        viewVehicle={viewVehicle}
        deliveries={deliveries}
        salesOrders={salesOrders}
        clients={clients}
        open={viewVehicleId !== null && historyDeliveryId === null}
        onClose={() => setViewVehicleId(null)}
        onViewDelivery={setHistoryDeliveryId}
      />
      <DeliveryDetailModal
        deliveryId={historyDeliveryId}
        open={historyDeliveryId !== null}
        onClose={() => setHistoryDeliveryId(null)}
      />
      <ConfirmDeleteModal
        open={archiveId !== null}
        onClose={() => setArchiveId(null)}
        onConfirm={async () => {
          if (
            archiveVehicle &&
            canChangeCondition(archiveVehicle) &&
            archiveVehicle.status !== 'IN_DELIVERY'
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
