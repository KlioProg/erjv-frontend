import { useState, type FormEvent } from 'react'
import { UserPlus, UserCheck, Calendar, Mail, Phone, MapPin, User as UserIcon, RotateCcw } from 'lucide-react'
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
  useCreateEmployee,
  useUpdateEmployeeProfile,
  useReactivateEmployee,
  useUsers,
  useEmployees,
  getArchivedEmployees,
} from '@/features/staffing/staffing.hooks'
import { fetchEmployeeByEmailApi } from '@/features/staffing/staffing.api'
import type { Employee } from '@/features/staffing/staffing.types'
import { getErrorMessage } from '@/lib/api-client'

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
  const { data: allEmployees = [] } = useEmployees()

  const [firstName, setFirstName] = useState(employee?.firstName || '')
  const [lastName, setLastName] = useState(employee?.lastName || '')
  const [email, setEmail] = useState(employee?.email || '')
  const [phone, setPhone] = useState(employee?.phone || '')
  const [address, setAddress] = useState(employee?.address || '')
  const [hireDate, setHireDate] = useState(
    employee?.hireDate
      ? new Date(employee.hireDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [selectedUserId, setSelectedUserId] = useState<string>(
    employee?.userId ? String(employee.userId) : 'none'
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

    const cleanEmail = email.trim().toLowerCase()
    const targetFullName = `${firstName.trim()} ${lastName.trim()}`.toLowerCase()

    // 1. Check local archive and backend deactivated
    const archivedList = getArchivedEmployees()
    const archivedMatch = archivedList.find(
      (emp) =>
        emp.id !== employee?.id &&
        ((cleanEmail && emp.email?.toLowerCase().trim() === cleanEmail) ||
          `${emp.firstName} ${emp.lastName}`.toLowerCase().trim() === targetFullName)
    )

    let backendEmailMatch: Employee | null = null
    if (cleanEmail) {
      try {
        backendEmailMatch = await fetchEmployeeByEmailApi(cleanEmail)
      } catch {
        // Ignore
      }
    }

    if (backendEmailMatch && backendEmailMatch.id !== employee?.id && backendEmailMatch.isActive === false) {
      setDeactivatedEmployeeMatch(backendEmailMatch)
      setErrorMsg(
        `An employee profile for "${backendEmailMatch.firstName} ${backendEmailMatch.lastName}" (${backendEmailMatch.email || 'No email'}) is currently deactivated. You can reactivate them directly.`
      )
      return
    }

    if (archivedMatch) {
      setDeactivatedEmployeeMatch(archivedMatch)
      setErrorMsg(
        `An employee profile for "${archivedMatch.firstName} ${archivedMatch.lastName}" (${archivedMatch.email || 'No email'}) is currently deactivated. You can reactivate them directly.`
      )
      return
    }

    // 2. Uniqueness validation for active employees
    const duplicateEmail = allEmployees.find(
      (emp) => emp.id !== employee?.id && emp.email && emp.email.toLowerCase().trim() === cleanEmail
    )
    if (cleanEmail && duplicateEmail) {
      setErrorMsg(`An active employee with the email "${cleanEmail}" is already registered.`)
      return
    }

    const duplicateName = allEmployees.find(
      (emp) =>
        emp.id !== employee?.id &&
        `${emp.firstName} ${emp.lastName}`.toLowerCase().trim() === targetFullName
    )
    if (duplicateName) {
      setErrorMsg(`An active employee named "${firstName.trim()} ${lastName.trim()}" is already registered.`)
      return
    }

    try {
      const parsedHireDate = new Date(hireDate).toISOString()
      const userId = selectedUserId !== 'none' ? Number(selectedUserId) : null

      if (isEditing && employee) {
        await updateMutation.mutateAsync({
          id: employee.id,
          payload: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
            hireDate: parsedHireDate,
          },
        })
      } else {
        await createMutation.mutateAsync({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
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
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary mb-1">
          {isEditing ? <UserCheck className="size-5" /> : <UserPlus className="size-5" />}
        </div>
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
        <div className="my-1 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-3 shadow-2xs">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 mt-0.5">
            <RotateCcw className="size-4" />
          </div>
          <div className="flex-1 text-xs">
            <p className="font-bold text-foreground">Deactivated Employee Found</p>
            <p className="text-muted-foreground mt-0.5 leading-relaxed">
              An archived profile for <strong className="text-foreground">{deactivatedEmployeeMatch.firstName} {deactivatedEmployeeMatch.lastName}</strong> ({deactivatedEmployeeMatch.email || 'No email'}) already exists. Click <strong>"Reactivate Employee"</strong> below to restore them.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 py-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-fname" className="text-xs font-medium">
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
            <Label htmlFor="emp-lname" className="text-xs font-medium">
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-email" className="text-xs font-medium">
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
            <Label htmlFor="emp-phone" className="text-xs font-medium">
              Phone Number
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="emp-phone"
                placeholder="09171234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="emp-address" className="text-xs font-medium">
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

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="emp-hiredate" className="text-xs font-medium">
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
              <Label htmlFor="emp-user" className="text-xs font-medium">
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
                        {u.email} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2.5 mt-4 pt-3 border-t">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          {deactivatedEmployeeMatch ? (
            <Button
              type="button"
              onClick={handleRestoreFoundEmployee}
              disabled={isPending}
              className="gap-2 font-bold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
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
            <Button type="submit" disabled={isPending} className="font-semibold shadow-xs cursor-pointer">
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
