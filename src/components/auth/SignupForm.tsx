import type { SubmitEvent } from 'react'
import useFormValidation from './useFormValidation'

type SignupFormProps = {
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  errorMessage: string
  successMessage: string
}

const inputClasses = 'w-full rounded-lg border border-[#e0e3e7] bg-[#f5f5f5] px-3 py-2.5 text-xs outline-0 transition duration-200 placeholder:text-[#999] focus:border-[#c2474c] focus:bg-white focus:shadow-[0_0_0_3px_rgba(194,71,76,.1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2474c] focus-visible:ring-offset-2'

export default function SignupForm({ onSubmit, isSubmitting, errorMessage, successMessage }: SignupFormProps) {
  const fullVal = useFormValidation()
  const emailVal = useFormValidation()
  const passVal = useFormValidation()
  const confirmVal = useFormValidation()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    const form = e.currentTarget as HTMLFormElement
    const full = (form.elements.namedItem('fullName') as HTMLInputElement)?.value.trim() ?? ''
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value.trim() ?? ''
    const pass = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? ''
    const confirm = (form.elements.namedItem('confirmPassword') as HTMLInputElement)?.value ?? ''

    fullVal.setMessage('')
    emailVal.setMessage('')
    passVal.setMessage('')
    confirmVal.setMessage('')

    const fullInvalid = !full
    const emailInvalid = !email
    const passInvalid = !pass || pass.length < 8
    const confirmInvalid = confirm !== pass

    let invalid = false
    if (fullInvalid) { fullVal.setMessage('Please enter your full name.'); invalid = true }
    if (emailInvalid) { emailVal.setMessage('Please enter your business email (you@business.com).'); invalid = true }
    if (passInvalid) { passVal.setMessage('Please choose a password (minimum 8 characters).'); invalid = true }
    if (confirmInvalid) { confirmVal.setMessage('Passwords do not match.'); invalid = true }

    if (invalid) { e.preventDefault();
      if (fullInvalid) (form.elements.namedItem('fullName') as HTMLInputElement)?.focus()
      else if (emailInvalid) (form.elements.namedItem('email') as HTMLInputElement)?.focus()
      else if (passInvalid) (form.elements.namedItem('password') as HTMLInputElement)?.focus()
      else if (confirmInvalid) (form.elements.namedItem('confirmPassword') as HTMLInputElement)?.focus()
      return
    }
    onSubmit(e)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Full name</span>
        <input className={inputClasses} name="fullName" type="text" autoComplete="name" placeholder="Alex Morgan" />
        {fullVal.message && <div className="mt-1 text-[11px] text-[#a33b31]">{fullVal.message}</div>}
      </label>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Email address</span>
        <input className={inputClasses} name="email" type="email" autoComplete="email" placeholder="you@business.com" />
        {emailVal.message && <div className="mt-1 text-[11px] text-[#a33b31]">{emailVal.message}</div>}
      </label>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Password</span>
        <input className={inputClasses} name="password" type="password" autoComplete="new-password" placeholder="Enter your password" minLength={8} />
        {passVal.message && <div className="mt-1 text-[11px] text-[#a33b31]">{passVal.message}</div>}
      </label>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Confirm Password</span>
        <input className={inputClasses} name="confirmPassword" type="password" autoComplete="new-password" placeholder="Confirm your password" minLength={8} />
        {confirmVal.message && <div className="mt-1 text-[11px] text-[#a33b31]">{confirmVal.message}</div>}
      </label>

      {errorMessage && <p className="-mt-1 text-xs text-[#a33b31]" role="alert">{errorMessage}</p>}
      {successMessage && <p className="-mt-1 text-xs text-[#477443]" role="status">{successMessage}</p>}

      <button className="mt-1 flex items-center justify-center rounded-lg bg-[#c2474c] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#ad3d42] disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2474c] focus-visible:ring-offset-2" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Connecting...' : 'Sign up'}
      </button>
    </form>
  )
}
