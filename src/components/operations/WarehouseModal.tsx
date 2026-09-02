import { useState, type FormEvent } from 'react'
import { Warehouse as WarehouseIcon, Building2, MapPin, Phone, RotateCcw } from 'lucide-react'
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
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useCreateWarehouse,
  useUpdateWarehouseDetails,
  useReactivateWarehouse,
  fetchWarehouseByNameApi,
} from '@/features/logistics/warehouses.hooks'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { getErrorMessage } from '@/lib/api-client'
import { sanitizePhilippinePhone, validatePhilippinePhone } from '@/lib/phone-utils'

type WarehouseModalProps = {
  warehouse: Warehouse | null
  open: boolean
  onClose: () => void
}

function WarehouseFormContent({
  warehouse,
  onClose,
}: {
  warehouse: Warehouse | null
  onClose: () => void
}) {
  const isEditing = !!warehouse
  const createMutation = useCreateWarehouse()
  const updateMutation = useUpdateWarehouseDetails()
  const reactivateMutation = useReactivateWarehouse()

  const [name, setName] = useState(warehouse?.name || '')
  const [address, setAddress] = useState(warehouse?.address || '')
  const [contactNumber, setContactNumber] = useState(warehouse?.contactNumber || '')
  const [errorMsg, setErrorMsg] = useState('')
  const [deactivatedWarehouseMatch, setDeactivatedWarehouseMatch] = useState<Warehouse | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setDeactivatedWarehouseMatch(null)

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorMsg('Warehouse name is required.')
      return
    }

    if (!address.trim()) {
      setErrorMsg('Warehouse address / location is required.')
      return
    }

    const phoneError = validatePhilippinePhone(contactNumber, 'Contact number')
    if (phoneError) {
      setErrorMsg(phoneError)
      return
    }

    // NOTE: removed client-side constraint validation, need backend to provide constraint errors
    // - deactivatedWarehouseMatch: set when there exists a deactivated warehouse with the specified name.
    // recommendations:
    // - just let the DB check the constraints and interpret it later

    try {
      const cleanContactNumber = sanitizePhilippinePhone(contactNumber) || null

      if (isEditing && warehouse) {
        await updateMutation.mutateAsync({
          id: warehouse.id,
          payload: {
            name: name.trim(),
            address: address.trim(),
            contactNumber: cleanContactNumber,
          },
        })
      } else {
        // Pre-check if an archived warehouse with this name exists so user can restore it directly
        const existingMatch = await fetchWarehouseByNameApi(cleanName).catch(() => null)
        if (existingMatch && existingMatch.isActive === false) {
          setDeactivatedWarehouseMatch(existingMatch)
          return
        }

        await createMutation.mutateAsync({
          name: name.trim(),
          address: address.trim(),
          contactNumber: cleanContactNumber,
          isActive: true,
        })
      }
      onClose()
    } catch (err) {
      const msg = getErrorMessage(err)
      if (
        !isEditing &&
        (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate'))
      ) {
        try {
          const match = await fetchWarehouseByNameApi(cleanName)
          if (match && match.isActive === false) {
            setDeactivatedWarehouseMatch(match)
            return
          }
        } catch {
          // Ignore
        }
      }
      setErrorMsg(msg)
    }
  }

  const handleRestoreFoundWarehouse = async () => {
    if (deactivatedWarehouseMatch) {
      await reactivateMutation.mutateAsync(deactivatedWarehouseMatch.id)
      onClose()
    }
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || reactivateMutation.isPending

  return (
    <>
      <DialogHeader>
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
          {isEditing ? <Building2 className="size-5" /> : <WarehouseIcon className="size-5" />}
        </div>
        <DialogTitle>
          {isEditing ? 'Edit Warehouse Location' : 'Register New Warehouse'}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Update facility details and contact information.'
            : 'Register a new storage and distribution hub to manage local inventory.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && !deactivatedWarehouseMatch && (
        <Alert
          variant="destructive"
          className="animate-in fade-in-0 slide-in-from-top-1 duration-200"
        >
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {deactivatedWarehouseMatch && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-2xs animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 mt-0.5">
            <RotateCcw className="size-4 animate-in spin-in-180 duration-500" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-foreground">Deactivated Warehouse Found</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              An archived facility record for{' '}
              <strong className="text-foreground">{deactivatedWarehouseMatch.name}</strong> (
              {deactivatedWarehouseMatch.address}) already exists. Click{' '}
              <strong>"Reactivate Warehouse"</strong> below to restore it.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 py-1">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wh-name" className="text-xs font-medium">
            Warehouse Name <span className="text-primary">*</span>
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="wh-name"
              placeholder="e.g. Main Distribution Hub, Panabo Storage Facility"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (deactivatedWarehouseMatch) setDeactivatedWarehouseMatch(null)
                if (errorMsg) setErrorMsg('')
              }}
              className="pl-9 transition-all duration-200"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wh-address" className="text-xs font-medium">
            Street Address / Location <span className="text-primary">*</span>
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="wh-address"
              placeholder="e.g. Km. 7 JP Laurel Ave, Lanang, Davao City"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="pl-9 transition-all duration-200"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="wh-phone" className="text-xs font-medium">
              Contact Number / Hotline
            </Label>
            {contactNumber && (
              <span
                className={`text-[10px] font-semibold ${
                  contactNumber.length === 11 && contactNumber.startsWith('09')
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {contactNumber.length}/11 digits
              </span>
            )}
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="wh-phone"
              type="tel"
              placeholder="09171234567"
              value={contactNumber}
              maxLength={11}
              onChange={(e) => setContactNumber(sanitizePhilippinePhone(e.target.value))}
              className="pl-9 transition-all duration-200"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 mt-4 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {deactivatedWarehouseMatch ? (
            <Button
              type="button"
              onClick={handleRestoreFoundWarehouse}
              disabled={isPending}
              className="group gap-2 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all duration-300 animate-in fade-in-0 zoom-in-95"
            >
              {reactivateMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Reactivating Warehouse...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4 transition-transform duration-200 group-hover:-rotate-45" />
                  Reactivate Warehouse Facility
                </>
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={isPending}
              className="font-semibold shadow-xs cursor-pointer transition-all duration-300"
            >
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  {isEditing ? 'Saving...' : 'Registering...'}
                </>
              ) : (
                <>{isEditing ? 'Save Changes' : 'Register Warehouse'}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </form>
    </>
  )
}

export function WarehouseModal({ warehouse, open, onClose }: WarehouseModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {open && (
          <WarehouseFormContent
            key={warehouse ? `wh-${warehouse.id}` : 'new-wh'}
            warehouse={warehouse}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
