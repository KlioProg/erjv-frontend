import { useState, type FormEvent } from 'react'
import { UserPlus, UserCheck, Calendar, Mail, Phone, MapPin, User as UserIcon } from 'lucide-react'
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
  useUsers,
} from '@/features/staffing/staffing.hooks'
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
  const { data: users = [] } = useUsers()

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!firstName.trim() || !lastName.trim()) {
      setErrorMsg('First and last names are required.')
      return
    }

    if (!hireDate) {
      setErrorMsg('Hire date is required.')
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

  const isPending = createMutation.isPending || updateMutation.isPending

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

      {errorMsg && (
        <Alert variant="destructive">
          <AlertDescription>{errorMsg}</AlertDescription>
        </Alert>
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
                onChange={(e) => setFirstName(e.target.value)}
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
              onChange={(e) => setLastName(e.target.value)}
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
                onChange={(e) => setEmail(e.target.value)}
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

        <DialogFooter className="gap-2 mt-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? (
              <>
                <Spinner data-icon="inline-start" />
                {isEditing ? 'Updating...' : 'Registering...'}
              </>
            ) : (
              <>{isEditing ? 'Update Employee' : 'Register Employee'}</>
            )}
          </Button>
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
