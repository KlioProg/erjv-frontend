import { useState, useRef, type FormEvent } from 'react'
import { Mail, Send, KeyRound } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'

type ForgotPasswordModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (email: string) => Promise<string>
}

export default function ForgotPasswordModal({
  open,
  onClose,
  onSubmit,
}: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [emailError, setEmailError] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setEmail('')
      setErrorMessage('')
      setSuccessMessage('')
      setEmailError('')
      setIsSubmitting(false)
      onClose()
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setEmailError('')

    const emailTrim = email.trim()
    const emailInvalid = !emailTrim || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)

    if (!emailTrim) {
      setEmailError('Please enter your work email.')
      inputRef.current?.focus()
      return
    } else if (emailInvalid) {
      setEmailError('Please enter a valid work email address.')
      inputRef.current?.focus()
      return
    }

    setIsSubmitting(true)
    try {
      const message = await onSubmit(emailTrim)
      setSuccessMessage(message)
    } catch {
      setErrorMessage('We could not send the verification code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-6">
        <DialogHeader className="gap-2 text-left">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <KeyRound className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-xl font-bold">Reset your password</DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              Enter your account email address and we&apos;ll send you a secure verification link to regain access.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form className="mt-2 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
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

          <div className="flex flex-col gap-1.5" data-invalid={emailError ? true : undefined}>
            <Label htmlFor="reset-email" className="text-xs font-semibold text-foreground/90">
              Work email address
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
              <Input
                ref={inputRef}
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@business.com"
                value={email}
                className="pl-9"
                aria-invalid={emailError ? true : undefined}
                disabled={isSubmitting}
                onChange={(event) => {
                  setEmail(event.target.value)
                  if (emailError) setEmailError('')
                }}
              />
            </div>
            {emailError && (
              <p className="text-[11px] font-medium text-destructive">{emailError}</p>
            )}
          </div>

          <div className="mt-2 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Sending code...
                </>
              ) : (
                <>
                  <Send data-icon="inline-start" className="size-4" />
                  Send reset code
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}