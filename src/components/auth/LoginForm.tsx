import { useState, type FormEvent } from 'react'
import { Mail, Lock, Eye, EyeOff, LogIn } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import useFormValidation from './useFormValidation'

type LoginFormProps = {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onForgotPasswordClick: () => void
  isSubmitting: boolean
  errorMessage: string
  successMessage: string
}

export default function LoginForm({
  onSubmit,
  onForgotPasswordClick,
  isSubmitting,
  errorMessage,
  successMessage,
}: LoginFormProps) {
  const emailVal = useFormValidation()
  const passVal = useFormValidation()
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget
    const emailInput = form.elements.namedItem('email') as HTMLInputElement | null
    const passInput = form.elements.namedItem('password') as HTMLInputElement | null

    const email = emailInput?.value.trim() ?? ''
    const password = passInput?.value ?? ''

    emailVal.setMessage('')
    passVal.setMessage('')

    let invalid = false
    const emailInvalid = !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    const passInvalid = !password || password.length < 8

    if (!email) {
      emailVal.setMessage('Please enter your work email.')
      invalid = true
    } else if (emailInvalid) {
      emailVal.setMessage('Please enter a valid work email address.')
      invalid = true
    }

    if (!password) {
      passVal.setMessage('Please enter your password.')
      invalid = true
    } else if (passInvalid) {
      passVal.setMessage('Password must be at least 8 characters.')
      invalid = true
    }

    if (invalid) {
      e.preventDefault()
      if (emailInvalid) emailInput?.focus()
      else if (passInvalid) passInput?.focus()
      return
    }

    onSubmit(e)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
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

      <div className="flex flex-col gap-1.5" data-invalid={emailVal.message ? true : undefined}>
        <Label htmlFor="login-email" className="text-xs font-semibold text-foreground/90">
          Email address
        </Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="login-email"
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

      <div className="flex flex-col gap-1.5" data-invalid={passVal.message ? true : undefined}>
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password" className="text-xs font-semibold text-foreground/90">
            Password
          </Label>
        </div>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
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

      <div className="flex items-center justify-between gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          <Checkbox
            id="rememberMe"
            name="rememberMe"
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(!!checked)}
            disabled={isSubmitting}
          />
          <Label
            htmlFor="rememberMe"
            className="text-xs font-normal text-muted-foreground cursor-pointer"
          >
            Remember me
          </Label>
        </div>
        <button
          type="button"
          onClick={onForgotPasswordClick}
          className="text-xs font-semibold text-primary transition-colors hover:underline hover:text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        >
          Forgot password?
        </button>
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
            Connecting...
          </>
        ) : (
          <>
            <LogIn data-icon="inline-start" className="size-4" />
            Sign in
          </>
        )}
      </Button>
    </form>
  )
}
