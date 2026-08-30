import { useState, type FormEvent } from 'react'
import { Truck, Hash, Gauge, Layers } from 'lucide-react'
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
  useCreateVehicle,
  useUpdateVehicleDetails,
} from '@/features/logistics/delivery-vehicles.hooks'
import {
  VEHICLE_STATUSES,
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
  const createMutation = useCreateVehicle()
  const updateMutation = useUpdateVehicleDetails()

  const [plateNumber, setPlateNumber] = useState(vehicle?.plateNumber || '')
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType || VEHICLE_TYPES[0])
  const [model, setModel] = useState(vehicle?.model || '')
  const [capacity, setCapacity] = useState(vehicle?.capacity ? String(vehicle.capacity) : '')
  const [status, setStatus] = useState<VehicleStatus>(vehicle?.status || 'AVAILABLE')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!plateNumber.trim()) {
      setErrorMsg('Vehicle plate number is required.')
      return
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
            capacity: parsedCap !== null ? parsedCap.toFixed(2) : null,
          },
        })
      } else {
        await createMutation.mutateAsync({
          plateNumber: plateNumber.trim().toUpperCase(),
          vehicleType: vehicleType.trim(),
          model: model.trim() || null,
          capacity: parsedCap !== null ? parsedCap.toFixed(2) : null,
          status,
          isActive: true,
        })
      }
      onClose()
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

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
            ? 'Update vehicle specifications and payload capacity.'
            : 'Register a new logistics or delivery transport asset to the fleet.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
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
                onChange={(e) => setPlateNumber(e.target.value)}
                className="pl-9 uppercase font-mono"
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
                className="pl-9"
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
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {!isEditing && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="v-status" className="text-xs font-medium">
              Initial Availability Status
            </Label>
            <Select value={status} onValueChange={(val) => setStatus(val as VehicleStatus)}>
              <SelectTrigger id="v-status">
                <SelectValue placeholder="Select initial status..." />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {VEHICLE_STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        )}

        <DialogFooter className="gap-2 mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                {isEditing ? 'Saving...' : 'Registering...'}
              </>
            ) : (
              <>{isEditing ? 'Save Vehicle' : 'Register Vehicle'}</>
            )}
          </Button>
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
