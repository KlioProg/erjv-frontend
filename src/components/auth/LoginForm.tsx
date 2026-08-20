import type { SubmitEvent } from 'react'

type LoginFormProps = {
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
  onForgotPasswordClick: () => void
  isSubmitting: boolean
  errorMessage: string
  successMessage: string
}

const inputClasses = 'w-full rounded-lg border border-[#e0e3e7] bg-[#f5f5f5] px-3 py-2.5 text-xs outline-0 transition duration-200 placeholder:text-[#999] focus:border-[#c2474c] focus:bg-white focus:shadow-[0_0_0_3px_rgba(194,71,76,.1)]'
const linkButtonClasses = 'border-0 bg-transparent p-0 text-xs font-semibold text-orange-dark hover:underline'

export default function LoginForm({ onSubmit, onForgotPasswordClick, isSubmitting, errorMessage, successMessage }: LoginFormProps) {
  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Email address</span>
        <input className={inputClasses} name="email" type="email" autoComplete="email" placeholder="you@business.com" required />
      </label>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Password</span>
        <input className={inputClasses} name="password" type="password" autoComplete="current-password" placeholder="Enter your password" minLength={8} required />
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

      <button className="mt-1 flex items-center justify-center rounded-lg bg-[#c2474c] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#ad3d42] disabled:cursor-wait disabled:opacity-70" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Connecting...' : 'Log in'}
      </button>
    </form>
  )
}
