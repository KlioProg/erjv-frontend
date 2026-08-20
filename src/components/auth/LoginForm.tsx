import type { SubmitEvent } from 'react'
import useFormValidation from './useFormValidation'

type LoginFormProps = {
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
  onForgotPasswordClick: () => void
  isSubmitting: boolean
  errorMessage: string
  successMessage: string
}

const inputClasses = 'w-full rounded-lg border border-[#e0e3e7] bg-[#f5f5f5] px-3 py-2.5 text-xs outline-0 transition duration-200 placeholder:text-[#999] focus:border-[#c2474c] focus:bg-white focus:shadow-[0_0_0_3px_rgba(194,71,76,.1)] focus:outline-none focus:ring-2 focus:ring-[#c2474c] focus:ring-offset-2'
const linkButtonClasses = 'border-0 bg-transparent p-0 text-xs font-semibold text-orange-dark hover:underline focus:outline-none focus:shadow-none focus-visible:shadow-[0_0_0_8px_rgba(194,71,76,.12)]'

export default function LoginForm({ onSubmit, onForgotPasswordClick, isSubmitting, errorMessage, successMessage }: LoginFormProps) {
  const emailVal = useFormValidation()
  const passVal = useFormValidation()

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    const form = e.currentTarget as HTMLFormElement
    const email = (form.elements.namedItem('email') as HTMLInputElement)?.value.trim() ?? ''
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? ''

    // reset messages
    emailVal.setMessage('')
    passVal.setMessage('')

    let invalid = false
    const emailInvalid = !email
    const passInvalid = !password || password.length < 8

    if (emailInvalid) {
      emailVal.setMessage('Please enter your work email (you@business.com).')
      invalid = true
    }
    if (passInvalid) {
      passVal.setMessage('Please enter your password (minimum 8 characters).')
      invalid = true
    }

    if (invalid) {
      e.preventDefault()
      // focus first invalid field deterministically
      if (emailInvalid) (form.elements.namedItem('email') as HTMLInputElement)?.focus()
      else if (passInvalid) (form.elements.namedItem('password') as HTMLInputElement)?.focus()
      return
    }

    onSubmit(e)
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
      <label className="flex flex-col gap-1.5 text-[10px] relative">
        <span>Email address</span>
        <input className={`${inputClasses} peer`} name="email" type="email" autoComplete="email" placeholder="you@business.com" />
        {emailVal.message && <div className="mt-1 text-[11px] text-[#a33b31]">{emailVal.message}</div>}
      </label>

      <label className="flex flex-col gap-1.5 text-[10px] relative">
        <span>Password</span>
        <input className={`${inputClasses} peer`} name="password" type="password" autoComplete="current-password" placeholder="Enter your password" minLength={8} />
        {passVal.message && <div className="mt-1 text-[11px] text-[#a33b31]">{passVal.message}</div>}
      </label>

      <div className="-mt-0.5 flex items-center justify-between text-[10px]">
        <label className="inline-flex items-center gap-2 text-xs text-muted">
          <input className="accent-orange" name="rememberMe" type="checkbox" />
          <span>Remember me</span>
        </label>
        <button className={linkButtonClasses} type="button" onClick={onForgotPasswordClick}>Forgot Password?</button>
      </div>

      {errorMessage && <p className="-mt-1 text-xs text-[#a33b31]" role="alert">{errorMessage}</p>}
      {successMessage && <p className="-mt-1 text-xs text-[#477443]" role="status">{successMessage}</p>}

      <button className="mt-1 flex items-center justify-center rounded-lg bg-[#c2474c] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#ad3d42] disabled:cursor-wait disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c2474c] focus-visible:ring-offset-2" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Connecting...' : 'Log in'}
      </button>
    </form>
  )
}
