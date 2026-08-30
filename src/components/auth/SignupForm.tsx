import { useState, type FormEvent } from 'react'
import { User, Mail, Lock, Eye, EyeOff, UserPlus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import useFormValidation from './useFormValidation'

type SignupFormProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  errorMessage: string
  successMessage: string
}

export default function SignupForm({
  onSubmit,
  isSubmitting,
  errorMessage,
  successMessage,
}: SignupFormProps) {
  const fullVal = useFormValidation()
  const emailVal = useFormValidation()
  const passVal = useFormValidation()
  const confirmVal = useFormValidation()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const nameInput = form.elements.namedItem('fullName') as HTMLInputElement | null
    const emailInput = form.elements.namedItem('email') as HTMLInputElement | null
    const passInput = form.elements.namedItem('password') as HTMLInputElement | null
    const confirmInput = form.elements.namedItem('confirmPassword') as HTMLInputElement | null

    const full = nameInput?.value.trim() ?? ''
    const email = emailInput?.value.trim() ?? ''
    const pass = passInput?.value ?? ''
    const confirm = confirmInput?.value ?? ''

    fullVal.setMessage('')
    emailVal.setMessage('')
    passVal.setMessage('')
    confirmVal.setMessage('')

    const fullInvalid = !full
    const emailInvalid = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const passInvalid = !pass || pass.length < 8
    const confirmInvalid = confirm !== pass

    let invalid = false
    if (fullInvalid) {
      fullVal.setMessage('Please enter your full name.')
      invalid = true
    }
    if (!email) {
      emailVal.setMessage('Please enter your work email.')
      invalid = true
    } else if (emailInvalid) {
      emailVal.setMessage('Please enter a valid work email (you@business.com).')
      invalid = true
    }
    if (!pass) {
      passVal.setMessage('Please enter a password.')
      invalid = true
    } else if (passInvalid) {
      passVal.setMessage('Password must be at least 8 characters.')
      invalid = true
    }
    if (!confirm) {
      confirmVal.setMessage('Please confirm your password.')
      invalid = true
    } else if (confirmInvalid) {
      confirmVal.setMessage('Passwords do not match.')
      invalid = true
    }

    if (invalid) {
      e.preventDefault()
      if (fullInvalid) nameInput?.focus()
      else if (emailInvalid) emailInput?.focus()
      else if (passInvalid) passInput?.focus()
      else if (confirmInvalid) confirmInput?.focus()
      return
    }

    onSubmit(e)
  }

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5" data-invalid={fullVal.message ? true : undefined}>
        <Label htmlFor="signup-name" className="text-xs font-semibold text-foreground/90">
          Full name
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="signup-name"
            name="fullName"
            type="text"
            autoComplete="name"
            placeholder="Alex Morgan"
            className="pl-9"
            aria-invalid={fullVal.message ? true : undefined}
            disabled={isSubmitting}
            onChange={() => fullVal.message && fullVal.setMessage('')}
          />
        </div>
        {fullVal.message && (
          <p className="text-[11px] font-medium text-destructive">{fullVal.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5" data-invalid={emailVal.message ? true : undefined}>
        <Label htmlFor="signup-email" className="text-xs font-semibold text-foreground/90">
          Work email address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="signup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@business.com"
            className="pl-9"
            aria-invalid={emailVal.message ? true : undefined}
            disabled={isSubmitting}
            onChange={() => emailVal.message && emailVal.setMessage('')}
          />
        </div>
        {emailVal.message && (
          <p className="text-[11px] font-medium text-destructive">{emailVal.message}</p>
        )}
      </div>

      <input type="hidden" name="role" value="STAFF" />

      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-[11px] text-muted-foreground leading-relaxed">
        <span className="font-bold text-foreground">Standard Staff Access:</span> New accounts are registered as staff members. Administrative and managerial permissions are granted by the Super Admin / Owner in Staffing Management.
      </div>

      <div className="flex flex-col gap-1.5" data-invalid={passVal.message ? true : undefined}>
        <Label htmlFor="signup-password" className="text-xs font-semibold text-foreground/90">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="signup-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
            className="pl-9 pr-10"
            minLength={8}
            aria-invalid={passVal.message ? true : undefined}
            disabled={isSubmitting}
            onChange={() => passVal.message && passVal.setMessage('')}
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {passVal.message && (
          <p className="text-[11px] font-medium text-destructive">{passVal.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5" data-invalid={confirmVal.message ? true : undefined}>
        <Label htmlFor="signup-confirm" className="text-xs font-semibold text-foreground/90">
          Confirm password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="signup-confirm"
            name="confirmPassword"
            type={showConfirm ? 'text' : 'password'}
            autoComplete="new-password"
            placeholder="Re-enter your password"
            className="pl-9 pr-10"
            minLength={8}
            aria-invalid={confirmVal.message ? true : undefined}
            disabled={isSubmitting}
            onChange={() => confirmVal.message && confirmVal.setMessage('')}
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setShowConfirm(!showConfirm)}
            aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
            tabIndex={-1}
          >
            {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {confirmVal.message && (
          <p className="text-[11px] font-medium text-destructive">{confirmVal.message}</p>
        )}
      </div>

      <Button
        type="submit"
        className="mt-2 w-full font-semibold shadow-md"
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner data-icon="inline-start" />
            Creating account...
          </>
        ) : (
          <>
            <UserPlus data-icon="inline-start" className="size-4" />
            Create Account
          </>
        )}
      </Button>
    </form>
  )
}
