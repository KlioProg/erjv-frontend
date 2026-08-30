import { useState, type FormEvent } from 'react'
import { Warehouse as WarehouseIcon, Building2, MapPin, Phone } from 'lucide-react'
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
  useWarehouses,
  useCreateWarehouse,
  useUpdateWarehouseDetails,
} from '@/features/logistics/warehouses.hooks'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { getErrorMessage } from '@/lib/api-client'

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
  const { data: allWarehouses = [] } = useWarehouses()
  const createMutation = useCreateWarehouse()
  const updateMutation = useUpdateWarehouseDetails()

  const [name, setName] = useState(warehouse?.name || '')
  const [address, setAddress] = useState(warehouse?.address || '')
  const [contactNumber, setContactNumber] = useState(warehouse?.contactNumber || '')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorMsg('Warehouse name is required.')
      return
    }

    if (!address.trim()) {
      setErrorMsg('Warehouse address / location is required.')
      return
    }

    const isDuplicate = allWarehouses.some(
      (w) => w.id !== warehouse?.id && w.name.toLowerCase().trim() === cleanName.toLowerCase()
    )
    if (isDuplicate) {
      setErrorMsg(`A warehouse named "${cleanName}" already exists in the database.`)
      return
    }

    try {
      if (isEditing && warehouse) {
        await updateMutation.mutateAsync({
          id: warehouse.id,
          payload: {
            name: name.trim(),
            address: address.trim(),
            contactNumber: contactNumber.trim() || null,
          },
        })
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          address: address.trim(),
          contactNumber: contactNumber.trim() || null,
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

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
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
              onChange={(e) => setName(e.target.value)}
              className="pl-9"
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
              className="pl-9"
              required
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wh-phone" className="text-xs font-medium">
            Contact Number / Hotline
          </Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="wh-phone"
              placeholder="e.g. 082-234-5678 or 0917-000-1111"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

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
              <>{isEditing ? 'Save Changes' : 'Register Warehouse'}</>
            )}
          </Button>
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
