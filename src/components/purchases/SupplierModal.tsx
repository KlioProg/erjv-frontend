import { useRef, useState, type FormEvent } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { CreateSupplierPayload, Supplier } from '@/features/logistics/suppliers.types'
import { getErrorMessage } from '@/lib/api-client'
import { sanitizePhilippinePhone, validatePhilippinePhone } from '@/lib/phone-utils'

const contactDigits = (value: string) => value.replace(/\D/g, '').replace(/^63(?=9)/, '0')

type SupplierModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (values: CreateSupplierPayload) => Promise<void>
  supplier?: Supplier | null
  isSubmitting?: boolean
}

export function SupplierModal({
  open,
  onClose,
  onSubmit,
  supplier,
  isSubmitting = false,
}: SupplierModalProps) {
  const [code, setCode] = useState(supplier?.code || '')
  const [name, setName] = useState(supplier?.name || '')
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson || '')
  const [phone, setPhone] = useState(supplier?.phone || '')
  const [email, setEmail] = useState(supplier?.email || '')
  const [address, setAddress] = useState(supplier?.address || '')
  const [errorMessage, setErrorMessage] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const submitting = useRef(false)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (submitting.current || isSubmitting) return
    if (!name.trim()) {
      setErrorMessage('Supplier company name is required.')
      return
    }

    const digits = contactDigits(phone)
    const mobile = digits.startsWith('09')
    const invalidPhone = mobile
      ? digits.length > 11
        ? 'Philippine mobile numbers may not exceed 11 digits.'
        : validatePhilippinePhone(digits)
      : phone.trim() && !digits
        ? 'Enter a phone number.'
        : null
    setPhoneError(invalidPhone || '')
    if (invalidPhone) return

    submitting.current = true
    setSaving(true)
    try {
      setErrorMessage('')
      await onSubmit({
        code: code.trim() || `SUP-${Date.now().toString(36).toUpperCase()}`,
        name: name.trim(),
        contactPerson: contactPerson.trim() || null,
        phone: mobile ? sanitizePhilippinePhone(digits) : phone.trim() || null,
        email: email.trim() || null,
        address: address.trim(),
      })
      onClose()
    } catch (err: unknown) {
      setErrorMessage(getErrorMessage(err))
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto gap-4 p-6 sm:max-w-md">
        <DialogHeader className="pb-1">
          <DialogTitle>{supplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
          <DialogDescription className="text-ui">
            Manage supplier details for buying products and materials.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-code" className="text-ui font-medium">
                Supplier Code
              </Label>
              <Input
                id="supplier-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. SUP-001"
                className="h-9 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-name" className="text-ui font-medium">
                Company Name <span className="text-primary">*</span>
              </Label>
              <Input
                id="supplier-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Holcim Philippines"
                className="h-9 text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-contact" className="text-ui font-medium">
                Contact Person
              </Label>
              <Input
                id="supplier-contact"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. John Doe"
                className="h-9 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-phone" className="text-ui font-medium">
                Phone Number
              </Label>
              <Input
                id="supplier-phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setPhoneError('')
                }}
                aria-invalid={!!phoneError || undefined}
                aria-describedby={`supplier-phone-help${phoneError ? ' supplier-phone-error' : ''}`}
                placeholder="e.g. 09171234567"
                className="h-9 text-sm"
              />
              <p id="supplier-phone-help" className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                Philippine mobile: 11 digits starting 09. Landlines and other international formats are accepted.
              </p>
              {phoneError && <p id="supplier-phone-error" role="alert" className="text-xs text-destructive">{phoneError}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier-email" className="text-ui font-medium">
              Email Address
            </Label>
            <Input
              id="supplier-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. sales@vendor.com"
              className="h-9 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier-address" className="text-ui font-medium">
              Warehouse / Plant Address
            </Label>
            <Input
              id="supplier-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Km 12 Sasa, Davao City"
              className="h-9 text-sm"
            />
          </div>

          <DialogFooter className="mt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || saving}
              className="font-medium"
            >
              {supplier ? 'Save Changes' : 'Add Supplier'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
