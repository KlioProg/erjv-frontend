import { useState, type FormEvent } from 'react'
import { Calendar, Mail, Phone, MapPin, User as UserIcon, RotateCcw } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useCreateEmployee,
  useUpdateEmployeeProfile,
  useReactivateEmployee,
  useUsers,
} from '@/features/staffing/staffing.hooks'
import type { Employee } from '@/features/staffing/staffing.types'
import { USER_ROLES } from '@/features/auth/roles'
import { getErrorMessage } from '@/lib/api-client'
import { sanitizePhilippinePhone, validatePhilippinePhone } from '@/lib/phone-utils'

type EmployeeModalProps = {
  employee: Employee | null
  open: boolean
  onClose: () => void
}

function EmployeeFormContent({
  employee,
  onClose,
}: {
  employee: Employee | null
  onClose: () => void
}) {
  const isEditing = !!employee
  const createMutation = useCreateEmployee()
  const updateMutation = useUpdateEmployeeProfile()
  const reactivateMutation = useReactivateEmployee()
  const { data: users = [] } = useUsers()

  const [firstName, setFirstName] = useState(employee?.firstName || '')
  const [lastName, setLastName] = useState(employee?.lastName || '')
  const [email, setEmail] = useState(employee?.email || '')
  const [phone, setPhone] = useState(employee?.phone || '')
  const [address, setAddress] = useState(employee?.address || '')
  const [hireDate, setHireDate] = useState(
    employee?.hireDate
      ? new Date(employee.hireDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
  )
  const [selectedUserId, setSelectedUserId] = useState<string>(
    employee?.userId ? String(employee.userId) : 'none',
  )
  const [errorMsg, setErrorMsg] = useState('')
  const [deactivatedEmployeeMatch, setDeactivatedEmployeeMatch] = useState<Employee | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setDeactivatedEmployeeMatch(null)

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('First and last names are required.')
      return
    }

    if (!hireDate) {
      setErrorMsg('Hire date is required.')
      return
    }

    const phoneError = validatePhilippinePhone(phone, 'Phone number')
    if (phoneError) {
      setErrorMsg(phoneError)
      return
    }

    // NOTE: removed client-side constraint validation, need backend to provide constraint errors
    // - deactivatedEmployeeMatch: set when there exists a deactivated employee with the specified email.
    // - also used to check for an active employee with matching email
    // - also used to check for an active or inactive employee with matching first and lastname
    // recommendations:
    // - just let the DB check the email constraint (or remove the email entirely in favor of user linking)
    // - do not make firstname/lastname unique. people can absolutely have the same first and last name.

    try {
      const parsedHireDate = new Date(hireDate).toISOString()
      const userId = selectedUserId !== 'none' ? Number(selectedUserId) : null
      const cleanPhone = sanitizePhilippinePhone(phone) || null

      if (isEditing && employee) {
        await updateMutation.mutateAsync({
          id: employee.id,
          payload: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim() || null,
            phone: cleanPhone,
            address: address.trim() || null,
            hireDate: parsedHireDate,
          },
        })
      } else {
        await createMutation.mutateAsync({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          phone: cleanPhone,
          address: address.trim() || null,
          hireDate: parsedHireDate,
          userId,
        })
      }
      onClose()
    } catch (err) {
      setErrorMsg(getErrorMessage(err))
    }
  }

  const handleRestoreFoundEmployee = async () => {
    if (deactivatedEmployeeMatch) {
      await reactivateMutation.mutateAsync(deactivatedEmployeeMatch)
      onClose()
    }
  }

  const isPending =
    createMutation.isPending || updateMutation.isPending || reactivateMutation.isPending

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? 'Edit Employee Profile' : 'Register New Employee'}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? 'Update the staffing information and contact details.'
            : 'Add a new staff member to the ERJVPOS directory.'}
        </DialogDescription>
      </DialogHeader>

      {errorMsg && !deactivatedEmployeeMatch && (
        <Alert variant="destructive" className="my-1">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
      )}

      {deactivatedEmployeeMatch && (
        <div className="my-1 flex items-start gap-3 rounded-lg border border-status-warning-foreground/20 bg-status-warning p-4 text-status-warning-foreground">
          <RotateCcw className="mt-0.5 size-4 shrink-0 text-status-warning-foreground" />
          <div className="flex-1 text-xs">
            <p className="font-semibold text-foreground">Deactivated Employee Found</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              An archived profile for{' '}
              <strong className="text-foreground">
                {deactivatedEmployeeMatch.firstName} {deactivatedEmployeeMatch.lastName}
              </strong>{' '}
              ({deactivatedEmployeeMatch.email || 'No email'}) already exists. Click{' '}
              <strong>"Reactivate Employee"</strong> below to restore them.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-1">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-fname" className="text-ui font-medium">
              First Name <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="emp-fname"
                placeholder="e.g. Ada"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value)
                  if (deactivatedEmployeeMatch) setDeactivatedEmployeeMatch(null)
                  if (errorMsg) setErrorMsg('')
                }}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-lname" className="text-ui font-medium">
              Last Name <span className="text-primary">*</span>
            </Label>
            <Input
              id="emp-lname"
              placeholder="e.g. Santos"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                if (deactivatedEmployeeMatch) setDeactivatedEmployeeMatch(null)
                if (errorMsg) setErrorMsg('')
              }}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-email" className="text-ui font-medium">
              Work Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="emp-email"
                type="email"
                placeholder="ada@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (deactivatedEmployeeMatch) setDeactivatedEmployeeMatch(null)
                  if (errorMsg) setErrorMsg('')
                }}
                className="pl-9"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="emp-phone" className="text-ui font-medium">
                Phone Number
              </Label>
              {phone && (
                <span
                  className={`text-ui font-medium ${
                    phone.length === 11 && phone.startsWith('09')
                      ? 'text-status-success-foreground'
                      : 'text-status-warning-foreground'
                  }`}
                >
                  {phone.length}/11 digits
                </span>
              )}
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="emp-phone"
                type="tel"
                placeholder="09171234567"
                value={phone}
                maxLength={11}
                onChange={(e) => setPhone(sanitizePhilippinePhone(e.target.value))}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emp-address" className="text-ui font-medium">
            Address / Location
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              id="emp-address"
              placeholder="Davao City, Philippines"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-hiredate" className="text-ui font-medium">
              Hire Date <span className="text-primary">*</span>
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="emp-hiredate"
                type="date"
                value={hireDate}
                onChange={(e) => setHireDate(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          {!isEditing && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="emp-user" className="text-ui font-medium">
                Link User Account
              </Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger id="emp-user">
                  <SelectValue placeholder="Select user (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No linked account</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.email} ({u.role || USER_ROLES.UNKNOWN})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2.5 mt-4 pt-3 border-t">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {deactivatedEmployeeMatch ? (
            <Button
              type="button"
              size="sm"
              onClick={handleRestoreFoundEmployee}
              disabled={isPending}
              className="gap-2"
            >
              {reactivateMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Reactivating Employee...
                </>
              ) : (
                <>
                  <RotateCcw className="size-4" />
                  Reactivate Employee Profile
                </>
              )}
            </Button>
          ) : (
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="font-medium cursor-pointer"
            >
              {isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  {isEditing ? 'Updating...' : 'Registering...'}
                </>
              ) : (
                <>{isEditing ? 'Update Employee' : 'Register Employee'}</>
              )}
            </Button>
          )}
        </DialogFooter>
      </form>
    </>
  )
}

export function EmployeeModal({ employee, open, onClose }: EmployeeModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        {open && (
          <EmployeeFormContent
            key={employee ? `emp-${employee.id}` : 'new-emp'}
            employee={employee}
            onClose={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
