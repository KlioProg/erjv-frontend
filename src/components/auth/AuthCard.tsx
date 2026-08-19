import { useState, type FormEvent } from 'react'
import { ErjvPosLogo } from '../ui/ErjvPosLogo'
import { submitAuthRequest } from '../../features/auth/auth.api'
import type { AuthMode, LoginRequest, SignupRequest } from '../../features/auth/auth.types'

type AuthCardProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
}

const inputClasses = 'w-full rounded-lg border border-[#e0e3e7] bg-[#f5f5f5] px-3 py-2.5 text-xs outline-0 transition duration-200 placeholder:text-[#999] focus:border-[#c2474c] focus:bg-white focus:shadow-[0_0_0_3px_rgba(194,71,76,.1)]'
const tabClasses = 'relative z-10 w-1/2 rounded-lg border-0 bg-transparent py-1.5 text-xs transition-colors duration-200'
const linkButtonClasses = 'border-0 bg-transparent p-0 text-xs font-semibold text-orange-dark hover:underline'

export function AuthCard({ mode, onModeChange }: AuthCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    const formData = new FormData(event.currentTarget)
    const payload: LoginRequest | SignupRequest =
      mode === 'login'
        ? {
            email: String(formData.get('email')),
            password: String(formData.get('password')),
            rememberMe: formData.get('rememberMe') === 'on',
          }
        : {
            fullName: String(formData.get('fullName')),
            email: String(formData.get('email')),
            password: String(formData.get('password')),
          }

    try {
      await submitAuthRequest(mode, payload)
      setSuccessMessage(mode === 'login' ? 'Signed in successfully.' : 'Account created successfully.')
    } catch {
      setErrorMessage('We could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <section className="w-full rounded-xl border border-[#dfe3e8] bg-white px-4 pb-4 pt-6 shadow-[0_4px_18px_rgba(37,47,58,.06)] sm:px-5 sm:pb-5 sm:pt-7" aria-labelledby="auth-title">
      <ErjvPosLogo />
      <h1 className="mt-5 text-center text-[22px] font-medium tracking-[-.04em]" id="auth-title">{isLogin ? 'Welcome back!' : 'Create an account'}</h1>
      <p className="text-center text-xs text-muted">Sign up to your ERJVPOS account!</p>

      <div className="relative my-5 flex rounded-xl bg-[#f1f4f8] p-1" role="tablist" aria-label="Authentication options">
        <span className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-white shadow-sm transition-transform duration-200 ease-out ${isLogin ? 'translate-x-0' : 'translate-x-full'}`} aria-hidden="true" />
        <button className={`${tabClasses} ${isLogin ? 'font-medium text-ink' : 'text-muted'}`} type="button" role="tab" aria-selected={isLogin} onClick={() => onModeChange('login')}>Login</button>
        <button className={`${tabClasses} ${!isLogin ? 'font-medium text-ink' : 'text-muted'}`} type="button" role="tab" aria-selected={!isLogin} onClick={() => onModeChange('signup')}>Sign up</button>
      </div>

      <div key={mode} className="animate-[auth-panel-in_240ms_ease-out] rounded-lg border border-[#dfe3e8] p-3.5 sm:p-4">
        <h2 className="text-center text-sm font-medium">{isLogin ? 'Log in back!' : 'Create an Account'}</h2>
        <p className="mb-5 text-center text-[8px] text-muted">{isLogin ? 'Login to start and check!' : 'Sign up to start and check!'}</p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {!isLogin && (
            <label className="flex flex-col gap-1.5 text-[10px]">
              <span>Full name</span>
              <input className={inputClasses} name="fullName" type="text" autoComplete="name" placeholder="Alex Morgan" required />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-[10px]">
            <span>Email address</span>
            <input className={inputClasses} name="email" type="email" autoComplete="email" placeholder="you@business.com" required />
          </label>
          <label className="flex flex-col gap-1.5 text-[10px]">
            <span>Password</span>
            <input className={inputClasses} name="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} placeholder="Enter your password" minLength={8} required />
          </label>

          {isLogin && (
            <div className="-mt-0.5 flex items-center justify-between text-[10px]">
              <label className="inline-flex items-center gap-2 text-xs text-muted">
                <input className="accent-orange" name="rememberMe" type="checkbox" />
                <span>Remember me</span>
              </label>
              <button className={linkButtonClasses} type="button">Forgot Password?</button>
            </div>
          )}

          {errorMessage && <p className="-mt-1 text-xs text-[#a33b31]" role="alert">{errorMessage}</p>}
          {successMessage && <p className="-mt-1 text-xs text-[#477443]" role="status">{successMessage}</p>}

          <button className="mt-1 flex items-center justify-center rounded-lg bg-[#c2474c] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#ad3d42] disabled:cursor-wait disabled:opacity-70" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Connecting...' : isLogin ? 'Log in' : 'Sign up'}
          </button>
        </form>
      </div>
    </section>
  )
}
