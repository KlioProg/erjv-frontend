import { useState, type FormEvent } from 'react'
import { Users, Building2, User, Phone, Mail, MapPin, RotateCcw } from 'lucide-react'
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
  useReactivateClient,
  searchClientsByNameApi,
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
  const reactivateMutation = useReactivateClient()

  const [name, setName] = useState(client?.name || '')
  const [contactPerson, setContactPerson] = useState(client?.contactPerson || '')
  const [phone, setPhone] = useState(client?.phone || '')
  const [email, setEmail] = useState(client?.email || '')
  const [address, setAddress] = useState(client?.address || '')
  const [errorMsg, setErrorMsg] = useState('')
  const [deactivatedClientMatch, setDeactivatedClientMatch] = useState<Client | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setDeactivatedClientMatch(null)

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorMsg('Client business/account name is required.')
      return
    }

    if (!address.trim()) {
      setErrorMsg('Billing / Delivery address is required.')
      return
    }

    if (!isEditing) {
      let backendMatches: Client[] = []
      try {
        backendMatches = await searchClientsByNameApi(cleanName)
      } catch {
        // Ignore
      }

      const backendInactive = backendMatches.find(
        (c) => c.name.toUpperCase().trim() === cleanName.toUpperCase() && c.isActive === false
      )

      if (backendInactive) {
        setDeactivatedClientMatch(backendInactive)
        setErrorMsg(
          `Client account "${cleanName}" is currently deactivated. You can reactivate it directly.`
        )
        return
      }

      // 2. Check if active duplicate exists
      const isNameDup = allClients.some(
        (c) => c.name.toLowerCase().trim() === cleanName.toLowerCase() && c.isActive !== false
      )
      const backendActive = backendMatches.find(
        (c) => c.name.toUpperCase().trim() === cleanName.toUpperCase() && c.isActive !== false
      )
      if (isNameDup || backendActive) {
        setErrorMsg(`A client account with the name "${cleanName}" is already registered.`)
        return
      }
    }

    const cleanEmail = email.trim().toLowerCase()
    if (cleanEmail) {
      const isEmailDup = allClients.some(
        (c) => c.id !== client?.id && c.email?.toLowerCase().trim() === cleanEmail
      )
      if (isEmailDup) {
        setErrorMsg(`A client with email "${cleanEmail}" already exists.`)
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

  const handleRestoreFoundClient = async () => {
    if (deactivatedClientMatch) {
      await reactivateMutation.mutateAsync(deactivatedClientMatch.id)
      onClose()
    }
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || reactivateMutation.isPending

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

      {errorMsg && !deactivatedClientMatch && (
        <Alert variant="destructive" className="my-1">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {deactivatedClientMatch && (
        <div className="my-1 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-2xs animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-300">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 mt-0.5">
            <RotateCcw className="size-4 animate-in spin-in-180 duration-500" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-foreground">Deactivated Client Found</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              An archived account for <strong className="text-foreground">{deactivatedClientMatch.name}</strong> ({deactivatedClientMatch.address}) already exists. Click <strong>"Reactivate Client"</strong> below to restore it.
            </p>
          </div>
        </div>
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
              placeholder="e.g. Davao Central Supermarket, Lanang Retail Depot"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (deactivatedClientMatch) setDeactivatedClientMatch(null)
                if (errorMsg) setErrorMsg('')
              }}
              className="pl-9 h-10 text-sm transition-all duration-200"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-contact" className="text-xs font-semibold text-foreground/90">
              Contact Person
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="client-contact"
                placeholder="e.g. Juan dela Cruz"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="pl-9 h-10 text-sm transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-phone" className="text-xs font-semibold text-foreground/90">
              Phone Number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="client-phone"
                placeholder="e.g. 0917-123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-9 h-10 text-sm transition-all duration-200"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client-email" className="text-xs font-semibold text-foreground/90">
            Email Address
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="client-email"
              type="email"
              placeholder="e.g. purchasing@davaocentral.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-9 h-10 text-sm transition-all duration-200"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client-address" className="text-xs font-semibold text-foreground/90">
            Delivery / Billing Address <span className="text-primary">*</span>
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="client-address"
              placeholder="e.g. Door 4, Commercial Center, JP Laurel Ave, Bajada, Davao City"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="pl-9 h-10 text-sm transition-all duration-200"
              required
            />
          </div>
        </div>

        <DialogFooter className="gap-2.5 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {deactivatedClientMatch ? (
            <Button
              type="button"
              onClick={handleRestoreFoundClient}
              disabled={isPending}
              className="gap-2 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer transition-all duration-300 animate-in fade-in-0 zoom-in-95"
            >
              {reactivateMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Reactivating Client...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reactivate Client Profile
                </>
              )}
            </Button>
          ) : (
            <Button type="submit" disabled={isPending} className="font-semibold shadow-xs cursor-pointer transition-all duration-300">
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  {isEditing ? 'Saving...' : 'Registering Client...'}
                </>
              ) : (
                <>{isEditing ? 'Save Changes' : 'Register Client Profile'}</>
              )}
            </Button>
          )}
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
