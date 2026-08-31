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
  MapPin,
  Building2,
  Navigation,
  Archive,
  RotateCcw,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  useReactivateVehicle,
  useUpdateVehicleStatus,
  getArchivedVehicles,
} from '@/features/logistics/delivery-vehicles.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useAuth } from '@/features/auth/AuthContext'
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
  const { data: clients = [] } = useClients()
  const deactivateMutation = useDeactivateVehicle()
  const reactivateMutation = useReactivateVehicle()
  const statusMutation = useUpdateVehicleStatus()
  const { isOwner, isAdmin } = useAuth()

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedVehicle, setSelectedVehicle] = useState<DeliveryVehicle | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [vehicleToDeactivate, setVehicleToDeactivate] = useState<DeliveryVehicle | null>(null)

  // Dispatch Destination Quick Modal state
  const [vehicleForDispatch, setVehicleForDispatch] = useState<DeliveryVehicle | null>(null)
  const [dispatchLocation, setDispatchLocation] = useState('')

  const activeVehicles = vehicles.filter((v) => v.isActive !== false)
  const archivedVehicles = getArchivedVehicles()

  const currentVehicleList = activeTab === 'ACTIVE' ? activeVehicles : archivedVehicles

  const filteredVehicles = currentVehicleList.filter((v) => {
    const matchesSearch =
      v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.model && v.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      v.vehicleType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.destinationLocation && v.destinationLocation.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus =
      activeTab !== 'ACTIVE' ||
      statusFilter.toUpperCase() === 'ALL' ||
      v.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const availableCount = activeVehicles.filter((v) => v.status === 'AVAILABLE').length
  const inDeliveryCount = activeVehicles.filter((v) => v.status === 'IN_DELIVERY').length
  const maintenanceCount = activeVehicles.filter((v) => v.status === 'MAINTENANCE').length
  const outOfServiceCount = activeVehicles.filter((v) => v.status === 'OUT_OF_SERVICE').length

  const handleCreate = () => {
    setSelectedVehicle(null)
    setIsModalOpen(true)
  }

  const handleEdit = (vehicle: DeliveryVehicle) => {
    setSelectedVehicle(vehicle)
    setIsModalOpen(true)
  }

  const handleStatusChange = async (id: number, status: VehicleStatus) => {
    if (status === 'IN_DELIVERY') {
      const v = vehicles.find((veh) => veh.id === id)
      if (v) {
        setVehicleForDispatch(v)
        setDispatchLocation(v.destinationLocation || '')
        return
      }
    }
    await statusMutation.mutateAsync({ id, status, destinationLocation: null })
  }

  const handleConfirmDispatch = async () => {
    if (vehicleForDispatch) {
      await statusMutation.mutateAsync({
        id: vehicleForDispatch.id,
        status: 'IN_DELIVERY',
        destinationLocation: dispatchLocation.trim() || 'Client Location in Transit',
      })
      setVehicleForDispatch(null)
      setDispatchLocation('')
    }
  }

  const handleDeactivate = (vehicle: DeliveryVehicle) => {
    setVehicleToDeactivate(vehicle)
  }

  const confirmDeactivate = async () => {
    if (vehicleToDeactivate) {
      await deactivateMutation.mutateAsync(vehicleToDeactivate)
      setVehicleToDeactivate(null)
    }
  }

  const handleReactivate = async (vehicle: DeliveryVehicle) => {
    await reactivateMutation.mutateAsync(vehicle.id)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Fleet KPI Quick Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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

        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertOctagon className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">{outOfServiceCount}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Out of Service</div>
          </div>
        </div>
      </div>

      {/* Fleet Tabs */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('ACTIVE')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ACTIVE'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Truck className="size-3.5" />
          Active Fleet ({activeVehicles.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ARCHIVED')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'ARCHIVED'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Archive className="size-3.5" />
          Deactivated Vehicles ({archivedVehicles.length})
        </button>
      </div>

      {/* Controls & Filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search plate, type, destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {activeTab === 'ACTIVE' && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <Button
                variant={statusFilter.toUpperCase() === 'ALL' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setStatusFilter('ALL')}
                className="h-8 text-xs font-semibold cursor-pointer"
              >
                All Statuses
              </Button>
              {VEHICLE_STATUSES.map((st) => {
                const label =
                  st === 'AVAILABLE'
                    ? 'Available'
                    : st === 'IN_DELIVERY'
                    ? 'In Delivery'
                    : st === 'MAINTENANCE'
                    ? 'Maintenance'
                    : 'Out of Service'

                return (
                  <Button
                    key={st}
                    variant={statusFilter === st ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setStatusFilter(st)}
                    className="h-8 text-xs font-semibold whitespace-nowrap cursor-pointer"
                  >
                    {label}
                  </Button>
                )
              })}
            </div>
          )}
        </div>

        {(isOwner || isAdmin) && activeTab === 'ACTIVE' && (
          <Button onClick={handleCreate} size="sm" className="gap-1.5 shadow-xs cursor-pointer">
            <Plus className="size-4" />
            Register Vehicle
          </Button>
        )}
      </div>

      {/* Vehicle Fleet Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Spinner className="mr-2 size-5" /> Loading delivery vehicles...
        </div>
      ) : filteredVehicles.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Truck className="size-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">
              {activeTab === 'ACTIVE'
                ? 'No active vehicles found'
                : 'No deactivated vehicles found'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm || statusFilter !== 'ALL'
                ? 'No transport vehicles match your search query or status filter.'
                : activeTab === 'ACTIVE'
                ? 'Register your first delivery truck or cargo hauler.'
                : 'Deactivated delivery vehicles will appear here and can be reactivated at any time.'}
            </p>
            {!searchTerm && statusFilter === 'ALL' && activeTab === 'ACTIVE' && (
              <Button onClick={handleCreate} size="sm" className="mt-4 gap-1.5 cursor-pointer">
                <Plus className="size-3.5" />
                Register Transport Asset
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((vehicle) => {
            const isArchived = vehicle.isActive === false
            const isInDelivery = vehicle.status === 'IN_DELIVERY'
            const isAvailable = vehicle.status === 'AVAILABLE'
            const isMaintenance = vehicle.status === 'MAINTENANCE'

            const iconBg = isArchived
              ? 'bg-muted text-muted-foreground'
              : isAvailable
              ? 'bg-emerald-500/10 text-emerald-600'
              : isInDelivery
              ? 'bg-blue-500/10 text-blue-600'
              : isMaintenance
              ? 'bg-amber-500/10 text-amber-600'
              : 'bg-destructive/10 text-destructive'

            return (
              <Card
                key={vehicle.id}
                className={`group relative overflow-hidden transition-all duration-200 hover:shadow-md border-border/80 rounded-2xl flex flex-col justify-between hover:border-primary/40 ${
                  isArchived ? 'opacity-75 bg-muted/20 border-dashed' : ''
                }`}
              >
                <CardContent className="p-5 flex flex-col justify-between h-full gap-3.5">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${iconBg}`}
                      >
                        <Truck className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-extrabold text-foreground tracking-tight">
                            {vehicle.plateNumber}
                          </span>
                          {isArchived ? (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-[10px] font-bold">
                              Deactivated
                            </Badge>
                          ) : (
                            <VehicleStatusBadge status={vehicle.status} />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-medium mt-0.5 truncate">
                          {vehicle.vehicleType}
                        </p>
                      </div>
                    </div>

                    {(isOwner || isAdmin) && (
                      <div className="flex items-center gap-1.5">
                        {isArchived ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReactivate(vehicle)}
                            disabled={reactivateMutation.isPending}
                            className="h-7 text-xs font-bold gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30 cursor-pointer"
                          >
                            <RotateCcw className="size-3.5" />
                            Reactivate
                          </Button>
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-foreground cursor-pointer shrink-0"
                              >
                                <MoreVertical className="size-4" />
                                <span className="sr-only">Vehicle actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleEdit(vehicle)} className="gap-2 text-xs cursor-pointer">
                                  <Edit2 className="size-3.5" />
                                  Edit Details & Route
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                                  Change Status
                                </div>
                                {VEHICLE_STATUSES.map((st) => {
                                  const label =
                                    st === 'AVAILABLE'
                                      ? 'Available'
                                      : st === 'IN_DELIVERY'
                                      ? 'In Delivery'
                                      : st === 'MAINTENANCE'
                                      ? 'Maintenance'
                                      : 'Out of Service'

                                  return (
                                    <DropdownMenuItem
                                      key={st}
                                      onClick={() => handleStatusChange(vehicle.id, st)}
                                      className={`gap-2 text-xs cursor-pointer ${
                                        vehicle.status === st ? 'font-bold text-primary' : ''
                                      }`}
                                    >
                                      {st === 'AVAILABLE' && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                                      {st === 'IN_DELIVERY' && <Clock className="size-3.5 text-blue-500" />}
                                      {st === 'MAINTENANCE' && <Wrench className="size-3.5 text-amber-500" />}
                                      {st === 'OUT_OF_SERVICE' && <AlertOctagon className="size-3.5 text-destructive" />}
                                      {label}
                                    </DropdownMenuItem>
                                  )
                                })}
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
                        )}
                      </div>
                    )}
                  </div>

                  {/* Uniform Status & Route Banner for ALL Cards */}
                  <div className="min-h-[58px] flex items-center">
                    {isInDelivery ? (
                      <div className="w-full flex items-start gap-2.5 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25">
                        <MapPin className="size-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                            En Route To Destination:
                          </span>
                          <span
                            className="font-bold text-foreground text-xs block truncate"
                            title={vehicle.destinationLocation || 'Commercial Client Location (In Transit)'}
                          >
                            {vehicle.destinationLocation || 'Commercial Client Location (In Transit)'}
                          </span>
                        </div>
                      </div>
                    ) : isAvailable ? (
                      <div className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                        <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                            Dispatch Ready:
                          </span>
                          <span className="font-medium text-muted-foreground text-xs block truncate">
                            Stationed in Central Depot • Ready for loading
                          </span>
                        </div>
                      </div>
                    ) : isMaintenance ? (
                      <div className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                        <Wrench className="size-4 text-amber-600 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block">
                            Fleet Servicing:
                          </span>
                          <span className="font-medium text-muted-foreground text-xs block truncate">
                            Under routine maintenance & safety inspection
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-destructive/5 border border-destructive/15">
                        <AlertOctagon className="size-4 text-destructive shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-destructive block">
                            Off-Duty:
                          </span>
                          <span className="font-medium text-muted-foreground text-xs block truncate">
                            Temporarily removed from active dispatch
                          </span>
                        </div>
                      </div>
                    )}
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
                        Model / Vehicle Make
                      </span>
                      <span className="font-semibold text-xs text-foreground truncate" title={vehicle.model || 'Standard'}>
                        {vehicle.model || 'Standard Unit'}
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
                          className="h-6 text-[11px] font-semibold text-muted-foreground hover:text-foreground px-2 cursor-pointer"
                        >
                          Update Status ▾
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {VEHICLE_STATUSES.map((st) => (
                          <DropdownMenuItem
                            key={st}
                            onClick={() => handleStatusChange(vehicle.id, st)}
                            className="gap-2 text-xs cursor-pointer"
                          >
                            {st === 'AVAILABLE' && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                            {st === 'IN_DELIVERY' && <Clock className="size-3.5 text-blue-500" />}
                            {st === 'MAINTENANCE' && <Wrench className="size-3.5 text-amber-500" />}
                            {st === 'OUT_OF_SERVICE' && <AlertOctagon className="size-3.5 text-destructive" />}
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

      {/* Main Vehicle Edit / Register Modal */}
      <VehicleModal
        vehicle={selectedVehicle}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Quick Dispatch Destination Assignment Dialog */}
      <Dialog open={!!vehicleForDispatch} onOpenChange={(open) => !open && setVehicleForDispatch(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 mb-2 shadow-2xs">
              <Navigation className="size-5" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight">
              Dispatch Vehicle on Delivery Route
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set the delivery destination location for vehicle{' '}
              <span className="font-mono font-bold text-foreground">{vehicleForDispatch?.plateNumber}</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3.5 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dispatch-dest" className="text-xs font-semibold text-foreground">
                Destination Address / Client Location <span className="text-primary">*</span>
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-blue-600 pointer-events-none" />
                <Input
                  id="dispatch-dest"
                  placeholder="e.g. Gaisano Grand Mall Complex, J.P. Laurel Ave, Davao City"
                  value={dispatchLocation}
                  onChange={(e) => setDispatchLocation(e.target.value)}
                  className="pl-10 text-xs font-medium"
                  autoFocus
                />
              </div>
            </div>

            {/* Quick Client Selection */}
            {clients.length > 0 && (
              <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-muted/40 border border-border/70">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Building2 className="size-3" /> Quick pick from registered commercial clients:
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {clients.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDispatchLocation(`${c.name} - ${c.address}`)}
                      className="px-2.5 py-1 rounded-lg bg-card hover:bg-primary/10 hover:border-primary/40 border border-border/80 text-[11px] font-medium text-foreground transition-colors text-left cursor-pointer"
                    >
                      <span className="font-bold block truncate max-w-[240px]">{c.name}</span>
                      <span className="text-[10px] text-muted-foreground block truncate max-w-[240px]">{c.address}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setVehicleForDispatch(null)}
              disabled={statusMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDispatch}
              disabled={statusMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold gap-1.5 shadow-xs cursor-pointer"
            >
              {statusMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" /> Dispatching...
                </>
              ) : (
                <>
                  <Navigation className="size-3.5" /> Dispatch Vehicle
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Themed Deactivation Modal */}
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
