import { useState, useRef, useEffect, type FormEvent } from 'react'

type ForgotPasswordModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (email: string) => Promise<string>
}

const inputClasses = 'w-full rounded-lg border border-[#e0e3e7] bg-[#f5f5f5] px-3 py-2.5 text-xs outline-0 transition duration-200 placeholder:text-[#999] focus-visible:border-[#c2474c] focus-visible:bg-white focus-visible:shadow-[0_0_0_3px_rgba(194,71,76,.1)] focus:outline-none'

export default function ForgotPasswordModal({ open, onClose, onSubmit }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [emailMessage, setEmailMsg] = useState('')

  const handleClose = () => {
    setEmail('');
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(false);
    onClose();
  };

  useEffect(() => {
    if (!open) return

    const modal = inputRef.current?.closest('[role="dialog"]') as HTMLElement | null
    const focusableSelector = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    const focusable = modal ? Array.from(modal.querySelectorAll(focusableSelector)) as HTMLElement[] : []
    const first: HTMLElement | null = (focusable[0] ?? inputRef.current) ?? null
    const last: HTMLElement | null = (focusable[focusable.length - 1] ?? inputRef.current) ?? null

    // Focus the first focusable element (or the input) on open
    first?.focus()

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        handleClose()
        return
      }

      if (event.key === 'Tab') {
        if (focusable.length === 0) {
          event.preventDefault()
          return
        }

        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  if (!open) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSuccessMessage('')
    setEmailMsg('')

    const emailTrim = email.trim()
    const emailInvalid = !emailTrim
    if (emailInvalid) {
      setEmailMsg("Please enter your work email so we can send a verification code.");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,18,22,.42)] px-4 py-6 backdrop-blur-[2px] animate-[auth-modal-backdrop-in_160ms_ease-out]" onClick={handleClose} role="presentation">
      <div className="relative w-full max-w-95 rounded-2xl border border-[#dfe3e8] bg-white p-5 shadow-[0_24px_60px_rgba(17,24,39,.18)] animate-[auth-modal-panel-in_180ms_ease-out]" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="forgot-password-title" aria-describedby="forgot-password-description">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-[-.03em]" id="forgot-password-title">Reset password</h2>
            <p className="mt-1 text-xs text-muted" id="forgot-password-description">Enter your email address and we&apos;ll send a verification code to continue.</p>
          </div>
          <button className="absolute -top-3 -right-3 inline-flex h-8 w-8 p-0 items-center justify-center rounded-full border border-transparent bg-white text-sm text-muted transition hover:bg-[#f5f5f5] hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2474c] focus-visible:ring-offset-2 shadow-[0_6px_14px_rgba(0,0,0,.08)]" type="button" onClick={handleClose} aria-label="Close reset password dialog">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="sr-only">Close reset password dialog</span>
          </button>
        </div>

        <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <label className="flex flex-col gap-1.5 text-[10px] relative">
            <span>Email address</span>
            <input ref={inputRef} className={inputClasses} name="email" type="email" autoComplete="email" placeholder="you@business.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            {emailMessage && <div className="mt-1 text-[11px] text-[#a33b31]">{emailMessage}</div>}
          </label>

          {errorMessage && <p className="-mt-1 text-xs text-[#a33b31]" role="alert">{errorMessage}</p>}
          {successMessage && <p className="-mt-1 text-xs text-[#477443]" role="status">{successMessage}</p>}

          <div className="flex gap-3">
            <button className="flex-1 rounded-lg bg-[#c2474c] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#ad3d42] disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2474c] focus-visible:ring-offset-2" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}