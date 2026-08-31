import { useState, type FormEvent } from 'react'
import { Truck, Hash, Gauge, Layers, RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useDeliveryVehicles,
  useCreateVehicle,
  useUpdateVehicleDetails,
  useReactivateVehicle,
  fetchVehicleByPlateNumberApi,
} from '@/features/logistics/delivery-vehicles.hooks'
import {
  OPERATIONAL_STATUSES,
  type DeliveryVehicle,
  type VehicleStatus,
} from '@/features/logistics/delivery-vehicles.types'
import { getErrorMessage } from '@/lib/api-client'

type VehicleModalProps = {
  vehicle: DeliveryVehicle | null
  open: boolean
  onClose: () => void
}

const VEHICLE_TYPES = [
  'Heavy Truck (6-Wheeler)',
  'Light Truck (4-Wheeler)',
  'Delivery Van',
  'Cargo Multicab',
  'Cargo Motorcycle',
]

function VehicleFormContent({
  vehicle,
  onClose,
}: {
  vehicle: DeliveryVehicle | null
  onClose: () => void
}) {
  const isEditing = !!vehicle
  const { data: allVehicles = [] } = useDeliveryVehicles()
  const createMutation = useCreateVehicle()
  const updateMutation = useUpdateVehicleDetails()
  const reactivateMutation = useReactivateVehicle()

  const [plateNumber, setPlateNumber] = useState(vehicle?.plateNumber || '')
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType || VEHICLE_TYPES[0])
  const [model, setModel] = useState(vehicle?.model || '')
  const [capacity, setCapacity] = useState(vehicle?.capacity ? String(vehicle.capacity) : '')
  const [status, setStatus] = useState<VehicleStatus>(vehicle?.status || 'AVAILABLE')
  const [errorMsg, setErrorMsg] = useState('')
  const [deactivatedVehicleMatch, setDeactivatedVehicleMatch] = useState<DeliveryVehicle | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setDeactivatedVehicleMatch(null)

    const cleanPlate = plateNumber.trim().toUpperCase()
    if (!cleanPlate) {
      setErrorMsg('Vehicle plate number is required.')
      return
    }

    if (!isEditing) {
      let backendMatch: DeliveryVehicle | null = null
      try {
        backendMatch = await fetchVehicleByPlateNumberApi(cleanPlate)
      } catch {
        // Ignore
      }

      if (backendMatch && typeof backendMatch === 'object' && backendMatch.id && backendMatch.isActive === false) {
        setDeactivatedVehicleMatch(backendMatch)
        setErrorMsg(
          `Vehicle with plate number "${cleanPlate}" is currently deactivated. You can reactivate it directly.`
        )
        return
      }

      // Check if active duplicate exists
      const isDuplicatePlate = allVehicles.some(
        (v) => v.plateNumber.toUpperCase().trim() === cleanPlate && v.isActive !== false
      )
      if (isDuplicatePlate || (backendMatch && typeof backendMatch === 'object' && backendMatch.id && backendMatch.isActive !== false)) {
        setErrorMsg(`A vehicle with plate number "${cleanPlate}" is already active in the fleet.`)
        return
      }
    }

    if (!vehicleType.trim()) {
      setErrorMsg('Vehicle type is required.')
      return
    }

    const parsedCap = capacity.trim() ? parseFloat(capacity) : null

    try {
      if (isEditing && vehicle) {
        await updateMutation.mutateAsync({
          id: vehicle.id,
          payload: {
            plateNumber: plateNumber.trim().toUpperCase(),
            vehicleType: vehicleType.trim(),
            model: model.trim() || null,
            capacity: parsedCap !== null && !isNaN(parsedCap) ? parsedCap.toFixed(2) : null,
          },
        })
      } else {
        await createMutation.mutateAsync({
          plateNumber: plateNumber.trim().toUpperCase(),
          vehicleType: vehicleType.trim(),
          model: model.trim() || null,
          capacity: parsedCap !== null && !isNaN(parsedCap) ? parsedCap.toFixed(2) : null,
          status,
          isActive: true,
        })
      }
      onClose()
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    }
  }

  const handleRestoreFoundVehicle = async () => {
    if (deactivatedVehicleMatch) {
      await reactivateMutation.mutateAsync(deactivatedVehicleMatch.id)
      onClose()
    }
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || reactivateMutation.isPending

  return (
    <>
      <DialogHeader>
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
          <Truck className="size-5" />
        </div>
        <DialogTitle>
          {isEditing ? 'Edit Delivery Vehicle' : 'Register Delivery Vehicle'}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Update vehicle specifications, payload capacity, and route.'
            : 'Register a new logistics or delivery transport asset to the fleet.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && !deactivatedVehicleMatch && (
        <Alert variant="destructive" className="animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {deactivatedVehicleMatch && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-2xs animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 mt-0.5">
            <RotateCcw className="size-4 animate-in spin-in-180 duration-500" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-foreground">Deactivated Vehicle Found</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              An archived vehicle record with plate <strong className="font-mono text-foreground">{deactivatedVehicleMatch.plateNumber}</strong> ({deactivatedVehicleMatch.vehicleType}) already exists. Click <strong>"Reactivate Vehicle"</strong> below to restore it.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 py-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-plate" className="text-xs font-medium">
              Plate Number <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="v-plate"
                placeholder="e.g. ABC-1234"
                value={plateNumber}
                onChange={(e) => {
                  setPlateNumber(e.target.value)
                  if (deactivatedVehicleMatch) setDeactivatedVehicleMatch(null)
                  if (errorMsg) setErrorMsg('')
                }}
                className="pl-9 uppercase font-mono transition-all duration-200"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-type" className="text-xs font-medium">
              Vehicle Type <span className="text-primary">*</span>
            </Label>
            <Select value={vehicleType} onValueChange={setVehicleType}>
              <SelectTrigger id="v-type">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {VEHICLE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-model" className="text-xs font-medium">
              Model / Make
            </Label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="v-model"
                placeholder="e.g. Isuzu NPR 75, Toyota HiAce"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="pl-9 transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-capacity" className="text-xs font-medium">
              Payload Capacity (kg)
            </Label>
            <div className="relative">
              <Gauge className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="v-capacity"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 2500"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className="pl-9 transition-all duration-200"
              />
            </div>
          </div>
        </div>

        {!isEditing && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-status" className="text-xs font-medium">
              Initial Availability Status
            </Label>
            <Select
              value={status}
              onValueChange={(val) => setStatus(val as VehicleStatus)}
            >
              <SelectTrigger id="v-status">
                <SelectValue placeholder="Select initial status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {OPERATIONAL_STATUSES.map((st) => {
                    const label =
                      st === 'AVAILABLE'
                        ? 'Available'
                        : st === 'IN_DELIVERY'
                        ? 'In Delivery'
                        : st === 'MAINTENANCE'
                        ? 'Maintenance'
                        : 'Out of Service'

                    return (
                      <SelectItem key={st} value={st}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter className="gap-2.5 mt-4 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {deactivatedVehicleMatch ? (
            <Button
              type="button"
              onClick={handleRestoreFoundVehicle}
              disabled={isPending}
              className="gap-2 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all duration-300 animate-in fade-in-0 zoom-in-95"
            >
              {reactivateMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Reactivating Vehicle...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reactivate Vehicle Fleet
                </>
              )}
            </Button>
          ) : (
            <Button type="submit" disabled={isPending} className="font-semibold shadow-xs cursor-pointer transition-all duration-300">
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  {isEditing ? 'Saving...' : 'Registering...'}
                </>
              ) : (
                <>{isEditing ? 'Save Vehicle' : 'Register Vehicle'}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </form>
    </>
  )
}

export function VehicleModal({ vehicle, open, onClose }: VehicleModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {open && (
          <VehicleFormContent
            key={vehicle ? `vehicle-${vehicle.id}` : 'new-vehicle'}
            vehicle={vehicle}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
