import { useState, type FormEvent } from 'react'
import {
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Shield,
  Sparkles,
  User,
  UserCheck,
} from 'lucide-react'
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
    const duplicateUser = existingUsers.find(
      (u) => u.email.toLowerCase() === cleanEmail,
    )
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
        employeeId:
          selectedEmployeeId !== 'none' ? Number(selectedEmployeeId) : undefined,
      })

      handleClose()
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md p-6 gap-5 bg-card">
        <DialogHeader className="gap-1.5 text-left">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <UserPlus className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Register User Account
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Provision a new user account and set initial access permissions.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {errorMsg && (
            <Alert variant="destructive" className="py-2.5 px-3">
              <AlertDescription className="text-xs">{errorMsg}</AlertDescription>
            </Alert>
          )}

          {/* Work Email */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="register-email" className="text-xs font-semibold text-foreground/90">
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
                className="pl-9 text-xs h-10"
                disabled={registerMutation.isPending}
                autoFocus
              />
            </div>
          </div>

          {/* System Role Selector */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="register-role" className="text-xs font-semibold text-foreground/90">
              System Role & Permissions
            </Label>
            <Select
              value={role}
              onValueChange={(val) => setRole(val as UserRole)}
              disabled={registerMutation.isPending}
            >
              <SelectTrigger
                id="register-role"
                className="h-auto min-h-[60px] py-3 px-3.5 text-xs rounded-xl border border-input bg-background/80 shadow-2xs [&>span]:line-clamp-none [&>span]:w-full [&>span]:text-left focus:ring-primary/20 cursor-pointer"
              >
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="p-1">
                <SelectItem value={USER_ROLES.STAFF} className="text-xs cursor-pointer py-2.5 px-3 rounded-lg">
                  <div className="flex items-center gap-3 py-0.5">
                    <div className="size-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <User className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col text-left gap-0.5 min-w-0">
                      <span className="font-semibold text-xs text-foreground leading-tight">
                        STAFF (Restricted)
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-tight">
                        Standard POS sales and restricted operational access
                      </span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value={USER_ROLES.MANAGER} className="text-xs cursor-pointer py-2.5 px-3 rounded-lg">
                  <div className="flex items-center gap-3 py-0.5">
                    <div className="size-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Shield className="size-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex flex-col text-left gap-0.5 min-w-0">
                      <span className="font-semibold text-xs text-blue-600 dark:text-blue-400 leading-tight">
                        MANAGER (Operations)
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-tight">
                        Warehouse, inventory, logistics and team management
                      </span>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value={USER_ROLES.ADMIN} className="text-xs cursor-pointer py-2.5 px-3 rounded-lg">
                  <div className="flex items-center gap-3 py-0.5">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Sparkles className="size-4 text-primary" />
                    </div>
                    <div className="flex flex-col text-left gap-0.5 min-w-0">
                      <span className="font-semibold text-xs text-primary leading-tight">
                        ADMIN (Administrator)
                      </span>
                      <span className="text-[11px] text-muted-foreground leading-tight">
                        Full administrative authority, user registration, and system configuration
                      </span>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Link to Existing Employee (Optional) */}
          {unlinkedEmployees.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="link-employee" className="text-xs font-semibold text-foreground/90">
                  Link to Staff Profile (Optional)
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  {unlinkedEmployees.length} unlinked profile{unlinkedEmployees.length === 1 ? '' : 's'}
                </span>
              </div>
              <Select
                value={selectedEmployeeId}
                onValueChange={setSelectedEmployeeId}
                disabled={registerMutation.isPending}
              >
                <SelectTrigger id="link-employee" className="text-xs h-10 px-3">
                  <SelectValue placeholder="Select staff profile (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs cursor-pointer py-2">
                    <span className="text-muted-foreground italic">None (Standalone Account)</span>
                  </SelectItem>
                  {unlinkedEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)} className="text-xs cursor-pointer py-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className="size-3.5 text-emerald-600 shrink-0" />
                        <span>
                          {emp.firstName} {emp.lastName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          (Staff #{emp.id})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Password */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="register-password" className="text-xs font-semibold text-foreground/90">
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
                className="pl-9 pr-10 text-xs h-10"
                disabled={registerMutation.isPending}
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none cursor-pointer"
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
            <Label htmlFor="register-confirm" className="text-xs font-semibold text-foreground/90">
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
                className="pl-9 pr-10 text-xs h-10"
                disabled={registerMutation.isPending}
                minLength={8}
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none cursor-pointer"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                tabIndex={-1}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          {/* Owner Notice Callout */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2.5 mt-1">
            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-foreground">Owner Provisioning: </span>
              This account will be created immediately. The user can sign in right away using these credentials. You can modify their role or archive the account anytime.
            </div>
          </div>

          <DialogFooter className="mt-2 sm:justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={registerMutation.isPending}
              className="text-xs h-8.5 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={registerMutation.isPending}
              className="text-xs h-8.5 gap-1.5 font-semibold cursor-pointer shadow-xs"
            >
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
