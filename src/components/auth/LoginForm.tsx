import { useState, type FormEvent } from 'react'
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, CheckCircle2 } from 'lucide-react'
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
  isSuccess?: boolean
  errorMessage: string
  successMessage: string
}

export default function LoginForm({
  onSubmit,
  onForgotPasswordClick,
  isSubmitting,
  isSuccess = false,
  errorMessage,
  successMessage,
}: LoginFormProps) {
  const emailVal = useFormValidation()
  const passVal = useFormValidation()

  const [email, setEmail] = useState(() => localStorage.getItem('erjv_remembered_email') || '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(
    () => localStorage.getItem('erjv_remember_me') === 'true',
  )

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const trimmedEmail = email.trim()

    emailVal.setMessage('')
    passVal.setMessage('')

    let invalid = false
    const emailInvalid = !trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    const passInvalid = !password || password.length < 8

    if (!trimmedEmail) {
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
      return
    }

    onSubmit(e)
  }

  const isPasswordRejected =
    !!errorMessage &&
    (errorMessage.toLowerCase().includes('password') ||
      errorMessage.toLowerCase().includes('credentials') ||
      errorMessage.toLowerCase().includes('rejected'))

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
      {errorMessage && (
        <Alert
          variant="destructive"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-destructive animate-in fade-in-50 duration-200"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-xs">Incorrect Email or Password</span>
            <AlertDescription className="text-xs leading-normal opacity-90">
              {errorMessage}
            </AlertDescription>
          </div>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Email input */}
      <div
        className="flex flex-col gap-1.5"
        data-invalid={emailVal.message || isPasswordRejected ? true : undefined}
      >
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
            placeholder="you@company.com"
            value={email}
            className={`pl-9 ${
              isPasswordRejected
                ? 'border-destructive/80 ring-1 ring-destructive/30 focus-visible:ring-destructive/30'
                : ''
            }`}
            aria-invalid={emailVal.message || isPasswordRejected ? true : undefined}
            disabled={isSubmitting}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailVal.message) emailVal.setMessage('')
            }}
          />
        </div>
        {(emailVal.message || isPasswordRejected) && (
          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1.5 animate-in fade-in-50">
            <AlertCircle className="size-3 shrink-0" />
            {emailVal.message || 'Please check your email address'}
          </p>
        )}
      </div>

      {/* Password input */}
      <div
        className="flex flex-col gap-1.5"
        data-invalid={passVal.message || isPasswordRejected ? true : undefined}
      >
        <Label htmlFor="login-password" className="text-xs font-semibold text-foreground/90">
          Password
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            className={`pl-9 pr-10 ${
              isPasswordRejected
                ? 'border-destructive/80 ring-1 ring-destructive/30 focus-visible:ring-destructive/30'
                : ''
            }`}
            minLength={8}
            aria-invalid={passVal.message || isPasswordRejected ? true : undefined}
            disabled={isSubmitting}
            onChange={(e) => {
              setPassword(e.target.value)
              if (passVal.message) passVal.setMessage('')
            }}
          />
          <button
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        {(passVal.message || isPasswordRejected) && (
          <p className="text-[11px] font-semibold text-destructive flex items-center gap-1.5 animate-in fade-in-50">
            <AlertCircle className="size-3 shrink-0" />
            {passVal.message || 'Incorrect password or email address'}
          </p>
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
          className="text-xs font-semibold text-primary transition-colors hover:underline hover:text-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm cursor-pointer"
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        className={`mt-1 w-full font-bold shadow-md cursor-pointer transition-all duration-200 active:scale-[0.98] ${
          isSuccess ? 'bg-emerald-600 hover:bg-emerald-600 text-white' : ''
        }`}
        size="lg"
        disabled={isSubmitting || isSuccess}
      >
        {isSuccess ? (
          <>
            <CheckCircle2 className="size-4 text-white animate-in zoom-in-50 duration-200" />
            <span>Success! Entering dashboard...</span>
          </>
        ) : isSubmitting ? (
          <>
            <Spinner className="size-4 animate-spin text-primary-foreground" />
            <span>Verifying credentials...</span>
          </>
        ) : (
          <>
            <LogIn className="size-4" />
            <span>Sign in</span>
          </>
        )}
      </Button>
    </form>
  )
}
