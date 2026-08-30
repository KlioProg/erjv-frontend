import { useState } from 'react'
import {
  Truck,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Wrench,
  AlertOctagon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useDeactivateVehicle,
  useDeliveryVehicles,
  useUpdateVehicleStatus,
} from '@/features/logistics/delivery-vehicles.hooks'
import {
  VEHICLE_STATUSES,
  type DeliveryVehicle,
  type VehicleStatus,
} from '@/features/logistics/delivery-vehicles.types'
import { VehicleModal } from './VehicleModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  switch (status) {
    case 'AVAILABLE':
      return (
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/25 text-[11px] font-semibold gap-1">
          <CheckCircle2 className="size-3" />
          Available
        </Badge>
      )
    case 'IN_DELIVERY':
      return (
        <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/25 text-[11px] font-semibold gap-1">
          <Clock className="size-3 animate-spin" />
          In Delivery
        </Badge>
      )
    case 'MAINTENANCE':
      return (
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/25 text-[11px] font-semibold gap-1">
          <Wrench className="size-3" />
          Maintenance
        </Badge>
      )
    case 'OUT_OF_SERVICE':
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/25 text-[11px] font-semibold gap-1">
          <AlertOctagon className="size-3" />
          Out of Service
        </Badge>
      )
  }
}

export function VehicleList() {
  const { data: vehicles = [], isLoading } = useDeliveryVehicles()
  const deactivateMutation = useDeactivateVehicle()
  const statusMutation = useUpdateVehicleStatus()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedVehicle, setSelectedVehicle] = useState<DeliveryVehicle | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [vehicleToDeactivate, setVehicleToDeactivate] = useState<DeliveryVehicle | null>(null)

  const filteredVehicles = vehicles.filter((v) => {
    const matchesSearch =
      v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.model && v.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      v.vehicleType.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus =
      statusFilter.toUpperCase() === 'ALL' || v.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const availableCount = vehicles.filter((v) => v.status === 'AVAILABLE').length
  const inDeliveryCount = vehicles.filter((v) => v.status === 'IN_DELIVERY').length
  const maintenanceCount = vehicles.filter((v) => v.status === 'MAINTENANCE').length

  const handleCreate = () => {
    setSelectedVehicle(null)
    setIsModalOpen(true)
  }

  const handleEdit = (vehicle: DeliveryVehicle) => {
    setSelectedVehicle(vehicle)
    setIsModalOpen(true)
  }

  const handleStatusChange = async (id: number, status: VehicleStatus) => {
    await statusMutation.mutateAsync({ id, status })
  }

  const handleDeactivate = (vehicle: DeliveryVehicle) => {
    setVehicleToDeactivate(vehicle)
  }

  const confirmDeactivate = async () => {
    if (vehicleToDeactivate) {
      await deactivateMutation.mutateAsync(vehicleToDeactivate.id)
      setVehicleToDeactivate(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Fleet KPI Quick Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Truck className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">{vehicles.length}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Total Fleet</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">{availableCount}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Available for Dispatch</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
            <Clock className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">{inDeliveryCount}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Active In-Transit</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Wrench className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">{maintenanceCount}</div>
            <div className="text-[11px] text-muted-foreground font-medium">In Maintenance</div>
          </div>
        </div>
      </div>

      {/* Controls & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search plate, vehicle type, model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={statusFilter.toUpperCase() === 'ALL' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter('ALL')}
              className="h-8 text-xs font-semibold cursor-pointer"
            >
              All Statuses
            </Button>
            {VEHICLE_STATUSES.map((st) => (
              <Button
                key={st}
                variant={statusFilter === st ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter(st)}
                className="h-8 text-xs whitespace-nowrap cursor-pointer"
              >
                {st.replace(/_/g, ' ')}
              </Button>
            ))}
          </div>
        </div>

        <Button onClick={handleCreate} size="sm" className="gap-1.5 shadow-xs">
          <Plus className="size-4" />
          Register Vehicle
        </Button>
      </div>

      {/* Vehicle Fleet Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Spinner className="mr-2 size-5" /> Loading delivery fleet assets...
        </div>
      ) : filteredVehicles.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Truck className="size-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No vehicles found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm || statusFilter !== 'all'
                ? 'No delivery assets match your selected filters.'
                : 'Register your store delivery trucks, vans, and fleet units to track availability in real-time.'}
            </p>
            {!searchTerm && statusFilter === 'all' && (
              <Button onClick={handleCreate} size="sm" variant="outline" className="mt-4 gap-1.5">
                <Plus className="size-3.5" />
                Register First Vehicle
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => {
            return (
              <Card
                key={vehicle.id}
                className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/40 border-border/80"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                        <Truck className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-extrabold text-foreground tracking-tight">
                            {vehicle.plateNumber}
                          </span>
                          <VehicleStatusBadge status={vehicle.status} />
                        </div>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5">
                          {vehicle.vehicleType}
                        </p>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                        >
                          <MoreVertical className="size-4" />
                          <span className="sr-only">Vehicle actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(vehicle)} className="gap-2 text-xs">
                          <Edit2 className="size-3.5" />
                          Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                          Change Status
                        </div>
                        {VEHICLE_STATUSES.map((st) => (
                          <DropdownMenuItem
                            key={st}
                            onClick={() => handleStatusChange(vehicle.id, st)}
                            className={`gap-2 text-xs ${vehicle.status === st ? 'font-bold text-primary' : ''}`}
                          >
                            {st === 'AVAILABLE' && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                            {st === 'IN_DELIVERY' && <Clock className="size-3.5 text-blue-500" />}
                            {st === 'MAINTENANCE' && <Wrench className="size-3.5 text-amber-500" />}
                            {st === 'OUT_OF_SERVICE' && <AlertOctagon className="size-3.5 text-destructive" />}
                            {st.replace(/_/g, ' ')}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeactivate(vehicle)}
                          className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                        >
                          <Trash2 className="size-3.5" />
                          Deactivate Vehicle
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Model & Capacity Specs */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Payload Capacity
                      </span>
                      <span className="font-extrabold text-foreground text-xs">
                        {vehicle.capacity || 'Not specified'}
                      </span>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Operational Status
                      </span>
                      <span className="font-semibold text-xs text-foreground">
                        {vehicle.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Status Toggle Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px]">
                    <span className="text-muted-foreground font-medium">Quick Status:</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[11px] text-muted-foreground hover:text-foreground px-2"
                        >
                          Update Status ▾
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {VEHICLE_STATUSES.map((st) => (
                          <DropdownMenuItem
                            key={st}
                            onClick={() => handleStatusChange(vehicle.id, st)}
                            className="gap-2 text-xs"
                          >
                            {st.replace(/_/g, ' ')}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <VehicleModal
        vehicle={selectedVehicle}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <ConfirmDeleteModal
        open={!!vehicleToDeactivate}
        onClose={() => setVehicleToDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Deactivate Delivery Vehicle"
        description="Are you sure you want to deactivate this transport vehicle? It will be removed from available dispatch allocations."
        itemName={`Plate: ${vehicleToDeactivate?.plateNumber}`}
        itemDetails={vehicleToDeactivate ? `${vehicleToDeactivate.vehicleType} • ${vehicleToDeactivate.model || 'Standard Cargo Unit'}` : undefined}
        confirmText="Deactivate Vehicle"
        variant="destructive"
      />
    </div>
  )
}
