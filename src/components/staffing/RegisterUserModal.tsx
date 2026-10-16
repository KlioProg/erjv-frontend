import { useState, type FormEvent } from 'react'
import { UserPlus, Mail, Lock, Eye, EyeOff, Shield, UserCheck } from 'lucide-react'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { useRegisterUser, useEmployees, useUsers } from '@/features/staffing/staffing.hooks'
import { USER_ROLES, type UserRole } from '@/features/auth/roles'
import { getErrorMessage } from '@/lib/api-client'

type RegisterUserModalProps = {
  open: boolean
  onClose: () => void
}

export function RegisterUserModal({ open, onClose }: RegisterUserModalProps) {
  const registerMutation = useRegisterUser()
  const { data: employees = [] } = useEmployees()
  const { data: existingUsers = [] } = useUsers({ includeInactive: 'true' })

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [role, setRole] = useState<UserRole>(USER_ROLES.STAFF)
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('none')

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Filter employees who do not yet have a linked user account
  const unlinkedEmployees = employees.filter((e) => !e.userId && e.isActive)

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register User Account</DialogTitle>
          <DialogDescription>
            Provision a new user account and set initial access permissions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {errorMsg && (
            <Alert variant="destructive" className="py-2.5 px-3">
              <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Work Email */}
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
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
                className="h-auto min-h-16 py-3 [&>span]:line-clamp-none [&>span]:w-full [&>span]:text-left [&>span]:whitespace-normal"
              >
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="p-1">
                <SelectItem value={USER_ROLES.STAFF} className="py-3">
                  <div className="flex min-w-0 flex-col gap-1 text-left">
                    <span className="font-medium text-ui text-foreground leading-tight">
                      STAFF (Restricted)
                    </span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      Standard POS sales and restricted operational access
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value={USER_ROLES.MANAGER} className="py-3">
                  <div className="flex min-w-0 flex-col gap-1 text-left">
                    <span className="font-medium text-ui text-foreground leading-tight">
                      MANAGER (Operations)
                    </span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      Warehouse, inventory, logistics and team management
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value={USER_ROLES.ADMIN} className="py-3">
                  <div className="flex min-w-0 flex-col gap-1 text-left">
                    <span className="font-medium text-ui text-foreground leading-tight">
                      ADMIN (Administrator)
                    </span>
                    <span className="text-xs text-muted-foreground leading-tight">
                      Full administrative authority, user registration, and system configuration
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Link to Existing Employee (Optional) */}
          {unlinkedEmployees.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="link-employee" className="text-ui font-medium text-foreground">
                  Link to Staff Profile (Optional)
                </Label>
                <span className="text-xs text-muted-foreground">
                  {unlinkedEmployees.length} unlinked profile
                  {unlinkedEmployees.length === 1 ? '' : 's'}
                </span>
              </div>
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
                disabled={registerMutation.isPending}
              >
                <SelectTrigger id="link-employee">
                  <SelectValue placeholder="Select staff profile (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="py-2">
                    <span className="text-muted-foreground italic">None (Standalone Account)</span>
                  </SelectItem>
                  {unlinkedEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)} className="py-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="size-3.5 text-status-success-foreground shrink-0" />
                        <span>
                          {emp.firstName} {emp.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">(Staff #{emp.id})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Password */}
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
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
          <div className="mt-1 flex items-start gap-3 rounded-lg bg-secondary p-4 text-xs leading-5 text-muted-foreground">
            <Shield className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
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
