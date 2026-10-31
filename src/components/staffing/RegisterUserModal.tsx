import { CursorLookup } from '@/components/ui/CursorLookup'
import type { Employee } from '@/features/staffing/staffing.types'
import { useState, type FormEvent } from 'react'
import { UserPlus, Mail, Lock, Eye, EyeOff, Shield } from 'lucide-react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { useRegisterUser, useUsers } from '@/features/staffing/staffing.hooks'
import { USER_ROLES, type UserRole } from '@/features/auth/roles'
import { getErrorMessage } from '@/lib/api-client'

const registrationRoles = [
  {
    value: USER_ROLES.STAFF,
    label: 'STAFF (Restricted)',
    description: 'Standard POS sales and restricted operational access',
  },
  {
    value: USER_ROLES.MANAGER,
    label: 'MANAGER (Operations)',
    description: 'Warehouse, inventory, logistics and team management',
  },
  {
    value: USER_ROLES.ADMIN,
    label: 'ADMIN (Administrator)',
    description: 'Full administrative authority, user registration, and system configuration',
  },
]

const dropdownLayout =
  'w-[var(--radix-select-trigger-width)] max-w-[var(--radix-select-content-available-width)] max-h-[min(24rem,var(--radix-select-content-available-height))] [&_[data-radix-select-viewport]]:min-w-0'

type RegisterUserModalProps = {
  open: boolean
  onClose: () => void
}

export function RegisterUserModal({ open, onClose }: RegisterUserModalProps) {
  const registerMutation = useRegisterUser()
  const { data: existingUsers = [] } = useUsers({ includeInactive: 'true' })

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>(USER_ROLES.STAFF)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('none')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const selectedRole = registrationRoles.find((option) => option.value === role)

  const handleClose = () => {
    if (registerMutation.isPending) return
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setRole(USER_ROLES.STAFF)
    setSelectedEmployeeId('none')
    setShowPassword(false)
    setShowConfirmPassword(false)
    setErrorMsg('')
    onClose()
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    const cleanEmail = email.trim().toLowerCase()

    if (!cleanEmail) {
      setErrorMsg('Please enter a work email address.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('Please enter a valid email address (e.g., name@business.com).')
      return
    }

    // Client-side pre-validation: check for duplicate email
    const duplicateUser = existingUsers.find((u) => u.email.toLowerCase() === cleanEmail)
    if (duplicateUser) {
      setErrorMsg(
        duplicateUser.isActive
          ? 'An account with this email address already exists in the system.'
          : 'An archived account with this email address already exists. You can reactivate it from Archived Accounts.',
      )
      return
    }

    if (!password) {
      setErrorMsg('Please enter an initial password.')
      return
    }

    if (password.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify and try again.')
      return
    }

    try {
      await registerMutation.mutateAsync({
        email: cleanEmail,
        password,
        role,
        employeeId: selectedEmployeeId !== 'none' ? Number(selectedEmployeeId) : undefined,
      })

      handleClose()
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="min-w-0 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register User Account</DialogTitle>
          <DialogDescription>
            Provision a new user account and set initial access permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
          {errorMsg && (
            <Alert variant="destructive" className="py-2.5 px-3">
              <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Work Email */}
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="register-email" className="text-ui font-medium text-foreground">
              Work Email Address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="register-email"
                type="email"
                placeholder="staff@business.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                className="pl-9"
                disabled={registerMutation.isPending}
                autoFocus
              />
            </div>
          </div>

          {/* System Role Selector */}
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="register-role" className="text-ui font-medium text-foreground">
              System Role & Permissions
            </Label>
            <Select
              value={role}
              onValueChange={(val) => setRole(val as UserRole)}
              disabled={registerMutation.isPending}
            >
              <SelectTrigger
                id="register-role"
                aria-describedby="register-role-description"
                className="min-w-0 gap-2 text-left [&>span]:font-medium [&>svg]:shrink-0"
              >
                <SelectValue placeholder="Select role">{selectedRole?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent className={dropdownLayout} collisionPadding={16}>
                <SelectGroup>
                  {registrationRoles.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      textValue={option.label}
                      className="min-w-0 py-3 [&>span:last-child]:min-w-0"
                    >
                      <span className="flex min-w-0 flex-col gap-1 whitespace-normal text-left wrap-anywhere">
                        <span className="font-medium text-ui text-foreground leading-5">
                          {option.label}
                        </span>
                        <span className="text-xs text-muted-foreground leading-4">
                          {option.description}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p
              id="register-role-description"
              className="text-xs leading-4 text-muted-foreground wrap-anywhere"
            >
              {selectedRole?.description}
            </p>
          </div>

          {/* Link to Existing Employee (Optional) */}
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="link-employee">Link to Staff Profile (Optional)</Label>
            <CursorLookup<Employee> id="link-employee" path="/employees" filter={{ includeInactive: 'false' }} value={selectedEmployeeId === 'none' ? '' : selectedEmployeeId} onChange={id => setSelectedEmployeeId(id)} label="Staff profile" getLabel={employee => `${employee.firstName} ${employee.lastName}`} accept={employee => employee.isActive && !employee.userId} disabled={registerMutation.isPending} />
            {selectedEmployeeId !== 'none' && <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedEmployeeId('none')}>Do not link a staff profile</Button>}
          </div>

          {/* Password */}
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="register-password" className="text-ui font-medium text-foreground">
              Initial Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="register-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                className="pl-9 pr-10"
                disabled={registerMutation.isPending}
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className="flex min-w-0 flex-col gap-2">
            <Label htmlFor="register-confirm" className="text-ui font-medium text-foreground">
              Confirm Password
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                id="register-confirm"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (errorMsg) setErrorMsg('')
                }}
                className="pl-9 pr-10"
                disabled={registerMutation.isPending}
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Admin Notice Callout */}
          <div className="flex min-w-0 items-start gap-3 rounded-lg bg-secondary p-4 text-xs leading-5 text-muted-foreground">
            <Shield className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 wrap-anywhere">
              <span className="font-semibold text-foreground">Admin Provisioning: </span>
              This account will be created immediately. The user can sign in right away using these
              credentials. You can modify their role or archive the account anytime.
            </div>
          </div>

          <DialogFooter className="mt-2 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={registerMutation.isPending}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={registerMutation.isPending} className="gap-2">
              {registerMutation.isPending ? (
                <>
                  <Spinner className="size-3.5" />
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="size-3.5" />
                  Register Account
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
