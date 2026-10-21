import { useRef, useState, type FormEvent } from 'react'
import { RotateCcw } from 'lucide-react'
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import './customers-pilot.css'
import {
  useClients,
  useCreateClient,
  useUpdateClientDetails,
  useReactivateClient,
  searchClientsByNameApi,
} from '@/features/crm/clients.hooks'
import type { Client } from '@/features/crm/clients.types'
import { getErrorMessage } from '@/lib/api-client'
import { sanitizePhilippinePhone, validatePhilippinePhone } from '@/lib/phone-utils'

type ClientModalProps = {
  client: Client | null
  open: boolean
  onClose: () => void
}

function ClientFormContent({ client, onClose }: { client: Client | null; onClose: () => void }) {
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
  const [errorField, setErrorField] = useState<'name' | 'address' | 'email' | 'phone' | null>(null)
  const [deactivatedClientMatch, setDeactivatedClientMatch] = useState<Client | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setErrorField(null)
    setDeactivatedClientMatch(null)

    const cleanName = name.trim()
    if (!cleanName) {
      setErrorField('name')
      setErrorMsg('Customer business/account name is required.')
      return
    }

    if (!address.trim()) {
      setErrorField('address')
      setErrorMsg('Billing / Delivery address is required.')
      return
    }

    if (!isEditing) {
      let backendMatches: Client[]
      try {
        backendMatches = await searchClientsByNameApi(cleanName)
      } catch (err) {
        setErrorMsg(getErrorMessage(err))
        return
      }

      const backendInactive = backendMatches.find(
        (c) => c.name.toUpperCase().trim() === cleanName.toUpperCase() && c.isActive === false,
      )

      if (backendInactive) {
        setDeactivatedClientMatch(backendInactive)
        setErrorMsg(
          `Customer account "${cleanName}" is currently deactivated. You can reactivate it directly.`,
        )
        return
      }

      // 2. Check if active duplicate exists
      const isNameDup = allClients.some(
        (c) => c.name.toLowerCase().trim() === cleanName.toLowerCase() && c.isActive !== false,
      )
      const backendActive = backendMatches.find(
        (c) => c.name.toUpperCase().trim() === cleanName.toUpperCase() && c.isActive !== false,
      )
      if (isNameDup || backendActive) {
        setErrorField('name')
        setErrorMsg(`A customer account with the name "${cleanName}" is already registered.`)
        return
      }
    }

    const cleanEmail = email.trim().toLowerCase()
    if (cleanEmail) {
      const isEmailDup = allClients.some(
        (c) => c.id !== client?.id && c.email?.toLowerCase().trim() === cleanEmail,
      )
      if (isEmailDup) {
        setErrorField('email')
        setErrorMsg(`A customer with email "${cleanEmail}" already exists.`)
        return
      }
    }

    const phoneError = validatePhilippinePhone(phone, 'Phone number')
    if (phoneError) {
      setErrorField('phone')
      setErrorMsg(phoneError)
      return
    }

    try {
      const cleanPhone = sanitizePhilippinePhone(phone) || null

      if (isEditing && client) {
        await updateMutation.mutateAsync({
          id: client.id,
          payload: {
            name: name.trim(),
            contactPerson: contactPerson.trim() || null,
            phone: cleanPhone,
            email: email.trim() || null,
            address: address.trim(),
          },
        })
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          contactPerson: contactPerson.trim() || null,
          phone: cleanPhone,
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
      try {
        await reactivateMutation.mutateAsync(deactivatedClientMatch.id)
        onClose()
      } catch (err) {
        setErrorMsg(getErrorMessage(err))
      }
    }
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || reactivateMutation.isPending

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? 'Edit Customer Business Profile' : 'Register New Customer'}
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Update account details and the people we contact for orders and deliveries.'
            : 'Add a customer account for sales orders, billing, and deliveries.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && !deactivatedClientMatch && !errorField && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}
      {deactivatedClientMatch && (
        <Alert className="customer-restore-notice">
          <AlertTitle>Archived customer found</AlertTitle>
          <AlertDescription>
            <p>
              {deactivatedClientMatch.name} already has an archived account at{' '}
              {deactivatedClientMatch.address}. Reactivate it to keep the existing order history.
            </p>
            <p className="mt-2">{errorMsg}</p>
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="customer-form flex flex-col gap-6">
        <fieldset className="flex min-w-0 flex-col gap-4">
          <legend>Customer account</legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-name">
              Business / Customer Name <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="client-name"
              placeholder="e.g. Davao Central Supermarket"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (deactivatedClientMatch) setDeactivatedClientMatch(null)
                if (errorMsg) {
                  setErrorMsg('')
                  setErrorField(null)
                }
              }}
              aria-invalid={errorField === 'name' || undefined}
              aria-describedby={errorField === 'name' ? 'client-name-error' : undefined}
              required
            />
            {errorField === 'name' && (
              <p id="client-name-error" role="alert" className="customer-field-error">
                {errorMsg}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-address">
              Delivery / Billing Address <span aria-hidden="true">*</span>
            </Label>
            <Input
              id="client-address"
              placeholder="Street, barangay, city"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              aria-invalid={errorField === 'address' || undefined}
              aria-describedby={
                errorField === 'address' ? 'client-address-error' : 'client-address-hint'
              }
              required
            />
            {errorField === 'address' ? (
              <p id="client-address-error" role="alert" className="customer-field-error">
                {errorMsg}
              </p>
            ) : (
              <p id="client-address-hint" className="customer-field-hint">
                Use the address for billing and customer deliveries.
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="flex min-w-0 flex-col gap-4 border-t pt-5">
          <legend>
            Contact details <span className="customer-field-hint">Optional</span>
          </legend>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="client-contact">Contact Person</Label>
            <Input
              id="client-contact"
              placeholder="e.g. Juan dela Cruz"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-phone">Phone Number</Label>
              <Input
                id="client-phone"
                type="tel"
                inputMode="tel"
                placeholder="09171234567"
                value={phone}
                maxLength={11}
                onChange={(e) => setPhone(sanitizePhilippinePhone(e.target.value))}
                aria-invalid={errorField === 'phone' || undefined}
                aria-describedby={
                  errorField === 'phone' ? 'client-phone-error' : 'client-phone-hint'
                }
              />
              {errorField === 'phone' ? (
                <p id="client-phone-error" role="alert" className="customer-field-error">
                  {errorMsg}
                </p>
              ) : (
                <p id="client-phone-hint" className="customer-field-hint">
                  11 digits, starting with 09.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="client-email">Email Address</Label>
              <Input
                id="client-email"
                type="email"
                placeholder="purchasing@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errorField === 'email' || undefined}
                aria-describedby={errorField === 'email' ? 'client-email-error' : undefined}
              />
              {errorField === 'email' && (
                <p id="client-email-error" role="alert" className="customer-field-error">
                  {errorMsg}
                </p>
              )}
            </div>
          </div>
        </fieldset>

        <DialogFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {deactivatedClientMatch ? (
            <Button
              type="button"
              variant="primary-contrast"
              onClick={handleRestoreFoundClient}
              disabled={isPending}
            >
              {reactivateMutation.isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RotateCcw data-icon="inline-start" />
              )}
              {reactivateMutation.isPending
                ? 'Reactivating Customer...'
                : 'Reactivate Customer Profile'}
            </Button>
          ) : (
            <Button type="submit" variant="primary-contrast" disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              {isPending
                ? isEditing
                  ? 'Saving...'
                  : 'Registering Customer...'
                : isEditing
                  ? 'Save Changes'
                  : 'Register Customer Profile'}
            </Button>
          )}
        </DialogFooter>
      </form>
    </>
  )
}

export function ClientModal({ client, open, onClose }: ClientModalProps) {
  const returnFocus = useRef<HTMLElement | null>(null)
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className="customer-dialog sm:max-w-[580px]"
        onOpenAutoFocus={() => {
          returnFocus.current = document.activeElement as HTMLElement | null
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus.current?.focus()
        }}
      >
        {open && (
          <ClientFormContent
            key={client ? `client-${client.id}` : 'new-customer'}
            client={client}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
