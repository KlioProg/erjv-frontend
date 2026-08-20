import { useState, type FormEvent } from 'react'

type ForgotPasswordModalProps = {
  open: boolean
  onClose: () => void
  onSubmit: (email: string) => Promise<string>
}

const inputClasses = 'w-full rounded-lg border border-[#e0e3e7] bg-[#f5f5f5] px-3 py-2.5 text-xs outline-0 transition duration-200 placeholder:text-[#999] focus:border-[#c2474c] focus:bg-white focus:shadow-[0_0_0_3px_rgba(194,71,76,.1)]'

export default function ForgotPasswordModal({ open, onClose, onSubmit }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const handleClose = () => {
    setEmail('');
    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(false);
    onClose();
  };

  if (!open) {
    return null
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const message = await onSubmit(email)
      setSuccessMessage(message)
    } catch {
      setErrorMessage('We could not send the verification code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,18,22,.42)] px-4 py-6 backdrop-blur-[2px] animate-[auth-modal-backdrop-in_160ms_ease-out]" onClick={onClose} role="presentation">
      <div className="w-full max-w-95 rounded-2xl border border-[#dfe3e8] bg-white p-5 shadow-[0_24px_60px_rgba(17,24,39,.18)] animate-[auth-modal-panel-in_180ms_ease-out]" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="forgot-password-title" aria-describedby="forgot-password-description">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-medium tracking-[-.03em]" id="forgot-password-title">Reset password</h2>
            <p className="mt-1 text-xs text-muted" id="forgot-password-description">Enter your email address and we&apos;ll send a verification code to continue.</p>
          </div>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#e0e3e7] text-sm text-muted transition hover:bg-[#f5f5f5] hover:text-ink" type="button" onClick={onClose} aria-label="Close reset password dialog">×</button>
        </div>

        <form className="mt-5 flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1.5 text-[10px]">
            <span>Email address</span>
            <input className={inputClasses} name="email" type="email" autoComplete="email" placeholder="you@business.com" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          {errorMessage && <p className="-mt-1 text-xs text-[#a33b31]" role="alert">{errorMessage}</p>}
          {successMessage && <p className="-mt-1 text-xs text-[#477443]" role="status">{successMessage}</p>}

          <div className="flex gap-3">
            <button className="flex-1 rounded-lg border border-[#dfe3e8] px-4 py-2.5 text-xs font-medium text-ink transition hover:bg-[#f5f5f5]" type="button" onClick={handleClose}>
              Close
            </button>
            <button className="flex-1 rounded-lg bg-[#c2474c] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#ad3d42] disabled:cursor-wait disabled:opacity-70" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send code'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}