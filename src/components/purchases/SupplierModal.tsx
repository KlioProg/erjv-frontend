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
import { PhoneInput } from '@/components/common/PhoneInput'
import { Label } from '@/components/ui/label'
import type { CreateSupplierPayload, Supplier } from '@/features/logistics/suppliers.types'
import { getApiFieldErrors } from '@/lib/api-client'
import { normalizeContactPhone, validateContactPhone } from '@/lib/phone-utils'

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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

    const invalidPhone = validateContactPhone(phone)
    setPhoneError(invalidPhone || '')
    if (invalidPhone) return

    submitting.current = true
    setSaving(true)
    try {
      setErrorMessage('')
      setFieldErrors({})
      await onSubmit({
        code: code.trim() || `SUP-${Date.now().toString(36).toUpperCase()}`,
        name: name.trim(),
        contactPerson: contactPerson.trim() || null,
        phone: normalizeContactPhone(phone) || null,
        email: email.trim() || null,
        address: address.trim(),
      })
      onClose()
    } catch (err: unknown) {
      const fields = getApiFieldErrors(err)
      setFieldErrors(fields)
      setErrorMessage(fields.name ?? '')
      setPhoneError(fields.phone ?? '')
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-code" className="text-ui font-medium">
                Supplier Code
              </Label>
              <Input
                id="supplier-code"
                error={fieldErrors.code}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. SUP-001"
                className="h-9 text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier-name" className="text-ui font-medium">
                Company Name <span aria-hidden="true" className="text-primary">*</span>
              </Label>
              <Input
                id="supplier-name" pattern=".*\S.*" title="Supplier company name is required."
                error={errorMessage || undefined}
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
                error={fieldErrors.contactPerson}
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
              <PhoneInput
                id="supplier-phone"
                value={phone}
                onValueChange={(value) => {
                  setPhone(value)
                  setPhoneError('')
                }}
                aria-invalid={!!phoneError || undefined}
                aria-describedby={phoneError ? 'supplier-phone-error' : undefined}
                className="h-9 text-sm"
              />
              {phoneError && <p id="supplier-phone-error" role="alert" className="text-xs text-destructive">{phoneError}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supplier-email" className="text-ui font-medium">
              Email Address
            </Label>
            <Input
              id="supplier-email"
              error={fieldErrors.email}
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
              error={fieldErrors.address}
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
