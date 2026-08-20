import type { SubmitEvent } from 'react'

type SignupFormProps = {
  onSubmit: (event: SubmitEvent<HTMLFormElement>) => void
  isSubmitting: boolean
  errorMessage: string
  successMessage: string
}

const inputClasses = 'w-full rounded-lg border border-[#e0e3e7] bg-[#f5f5f5] px-3 py-2.5 text-xs outline-0 transition duration-200 placeholder:text-[#999] focus:border-[#c2474c] focus:bg-white focus:shadow-[0_0_0_3px_rgba(194,71,76,.1)]'

export default function SignupForm({ onSubmit, isSubmitting, errorMessage, successMessage }: SignupFormProps) {
  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Full name</span>
        <input className={inputClasses} name="fullName" type="text" autoComplete="name" placeholder="Alex Morgan" required />
      </label>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Email address</span>
        <input className={inputClasses} name="email" type="email" autoComplete="email" placeholder="you@business.com" required />
      </label>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Password</span>
        <input className={inputClasses} name="password" type="password" autoComplete="new-password" placeholder="Enter your password" minLength={8} required />
      </label>
      <label className="flex flex-col gap-1.5 text-[10px]">
        <span>Confirm Password</span>
        <input className={inputClasses} name="confirmPassword" type="password" autoComplete="new-password" placeholder="Confirm your password" minLength={8} required />
      </label>

      {errorMessage && <p className="-mt-1 text-xs text-[#a33b31]" role="alert">{errorMessage}</p>}
      {successMessage && <p className="-mt-1 text-xs text-[#477443]" role="status">{successMessage}</p>}

      <button className="mt-1 flex items-center justify-center rounded-lg bg-[#c2474c] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#ad3d42] disabled:cursor-wait disabled:opacity-70" type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Connecting...' : 'Sign up'}
      </button>
    </form>
  )
}
