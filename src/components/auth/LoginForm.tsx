import { useState, type FormEvent } from 'react'
import { Mail, Lock, Eye, EyeOff, LogIn, Sparkles } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/features/auth/AuthContext'
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
  const { setDemoUser } = useAuth()
  const emailVal = useFormValidation()
  const passVal = useFormValidation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  const handleFillAdmin = () => {
    setEmail('owner@example.com')
    setPassword('plain-password')
    emailVal.setMessage('')
    passVal.setMessage('')
  }

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

  return (
    <form className="flex flex-col gap-3.5" onSubmit={handleSubmit} noValidate>
      {errorMessage && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-col gap-1">
            <span>{errorMessage}</span>
            <button
              type="button"
              onClick={() => setDemoUser('OWNER')}
              className="text-left font-semibold underline hover:opacity-80 pt-1"
            >
              Click here to enter with Demo Admin session instead →
            </button>
          </AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}

      {/* Email input */}
      <div className="flex flex-col gap-1.5" data-invalid={emailVal.message ? true : undefined}>
        <div className="flex items-center justify-between">
          <Label htmlFor="login-email" className="text-xs font-semibold text-foreground/90">
            Email address
          </Label>
          <button
            type="button"
            onClick={handleFillAdmin}
            className="text-[11px] font-medium text-primary hover:underline"
          >
            Autofill admin
          </button>
        </div>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="owner@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (emailVal.message) emailVal.setMessage('')
            }}
            className="pl-9"
            aria-invalid={emailVal.message ? true : undefined}
            disabled={isSubmitting}
          />
        </div>
        {emailVal.message && (
          <p className="text-[11px] font-medium text-destructive">{emailVal.message}</p>
        )}
      </div>

      {/* Password input */}
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
            placeholder="plain-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (passVal.message) passVal.setMessage('')
            }}
            className="pl-9 pr-10"
            minLength={8}
            aria-invalid={passVal.message ? true : undefined}
            disabled={isSubmitting}
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
        className="mt-1 w-full font-semibold shadow-md"
        size="lg"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>
            <Spinner data-icon="inline-start" />
            Connecting to server...
          </>
        ) : (
          <>
            <LogIn data-icon="inline-start" className="size-4" />
            Sign in
          </>
        )}
      </Button>

      {/* 1-Click Instant Demo Login Option */}
      <div className="mt-1 pt-2 border-t text-center">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setDemoUser('OWNER')}
          className="w-full text-xs font-medium gap-1.5 h-8.5"
        >
          <Sparkles className="size-3.5 text-primary" />
          Instant Admin Preview (Bypass Auth)
        </Button>
      </div>
    </form>
  )
}
