import { useState, type FormEvent } from 'react'
import { Users, Building2, User, Phone, Mail, MapPin } from 'lucide-react'
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
  useClients,
  useCreateClient,
  useUpdateClientDetails,
} from '@/features/crm/clients.hooks'
import type { Client } from '@/features/crm/clients.types'
import { getErrorMessage } from '@/lib/api-client'

type ClientModalProps = {
  client: Client | null
  open: boolean
  onClose: () => void
}

function ClientFormContent({
  client,
  onClose,
}: {
  client: Client | null
  onClose: () => void
}) {
  const isEditing = !!client
  const { data: allClients = [] } = useClients()
  const createMutation = useCreateClient()
  const updateMutation = useUpdateClientDetails()

  const [name, setName] = useState(client?.name || '')
  const [contactPerson, setContactPerson] = useState(client?.contactPerson || '')
  const [phone, setPhone] = useState(client?.phone || '')
  const [email, setEmail] = useState(client?.email || '')
  const [address, setAddress] = useState(client?.address || '')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorMsg('Client business/account name is required.')
      return
    }

    if (!address.trim()) {
      setErrorMsg('Billing / Delivery address is required.')
      return
    }

    const isNameDup = allClients.some(
      (c) => c.id !== client?.id && c.name.toLowerCase().trim() === cleanName.toLowerCase()
    )
    if (isNameDup) {
      setErrorMsg(`A client business named "${cleanName}" already exists in the database.`)
      return
    }

    const cleanEmail = email.trim().toLowerCase()
    if (cleanEmail) {
      const isEmailDup = allClients.some(
        (c) => c.id !== client?.id && c.email?.toLowerCase().trim() === cleanEmail
      )
      if (isEmailDup) {
        setErrorMsg(`A client with email "${cleanEmail}" already exists in the database.`)
        return
      }
    }

    try {
      if (isEditing && client) {
        await updateMutation.mutateAsync({
          id: client.id,
          payload: {
            name: name.trim(),
            contactPerson: contactPerson.trim() || null,
            phone: phone.trim() || null,
            email: email.trim() || null,
            address: address.trim(),
          },
        })
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          contactPerson: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim(),
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
      <DialogHeader className="pb-2">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-2xs">
          {isEditing ? <Building2 className="size-5" /> : <Users className="size-5" />}
        </div>
        <DialogTitle className="text-xl font-bold tracking-tight">
          {isEditing ? 'Edit Client Business Profile' : 'Register New Client'}
        </DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
          {isEditing
            ? 'Update customer contact personnel, delivery locations, and business details.'
            : 'Register a commercial or wholesale customer to manage orders, POS billing, and deliveries.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && (
        <Alert variant="destructive" className="my-1">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client-name" className="text-xs font-semibold text-foreground/90">
            Business / Client Name <span className="text-primary">*</span>
          </Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="client-name"
              placeholder="e.g. Davao Fresh Supermarket, Matina Central Mart"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-9 h-10 text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-contact" className="text-xs font-semibold text-foreground/90">
              Primary Contact Person
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="client-contact"
                placeholder="e.g. Maria Reyes (Purchasing)"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-phone" className="text-xs font-semibold text-foreground/90">
              Contact Number / Mobile
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="client-phone"
                placeholder="0917-123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-9 h-10 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client-email" className="text-xs font-semibold text-foreground/90">
            Work Email / Billing Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="client-email"
              type="email"
              placeholder="purchasing@clientdomain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9 h-10 text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client-address" className="text-xs font-semibold text-foreground/90">
            Delivery / Store Location <span className="text-primary">*</span>
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="client-address"
              placeholder="e.g. Km. 5 Bajada, Davao City, Davao del Sur"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="pl-9 h-10 text-sm"
              required
            />
          </div>
        </div>

        <DialogFooter className="gap-2.5 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="font-semibold shadow-xs">
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                {isEditing ? 'Saving...' : 'Registering Client...'}
              </>
            ) : (
              <>{isEditing ? 'Save Changes' : 'Register Client Profile'}</>
            )}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}

export function ClientModal({ client, open, onClose }: ClientModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[540px]">
        {open && (
          <ClientFormContent
            key={client ? `client-${client.id}` : 'new-client'}
            client={client}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
