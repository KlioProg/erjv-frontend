import { useState, type FormEvent } from 'react'
import { ErjvPosLogo } from '../ui/ErjvPosLogo'
import ForgotPasswordModal from './ForgotPasswordModal'
import LoginForm from './LoginForm'
import SignupForm from './SignupForm'
import { submitForgotPassword, submitLogin, submitSignup } from './authHandlers'
import type { AuthMode } from '../../features/auth/auth.types'

type AuthCardProps = {
  mode: AuthMode
  onModeChange: (mode: AuthMode) => void
}

const tabClasses = 'relative z-10 w-1/2 rounded-lg border-0 bg-transparent py-1.5 text-xs transition-colors duration-200'

export function AuthCard({ mode, onModeChange }: AuthCardProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    const formData = new FormData(event.currentTarget)

    try {
      const msg = await submitLogin(formData)
      setSuccessMessage(msg)
    } catch {
      setErrorMessage('We could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleSignupSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    const formData = new FormData(event.currentTarget)

    const password = String(formData.get('password'))
    const confirm = String(formData.get('confirmPassword'))
    if (password !== confirm) {
      setErrorMessage('Passwords do not match.')
      setIsSubmitting(false)
      return
    }

    try {
      const msg = await submitSignup(formData)
      setSuccessMessage(msg)
    } catch {
      setErrorMessage('We could not reach the server. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleForgotPasswordSubmit(email: string) {
    return submitForgotPassword(email)
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
        {isLogin ? (
            <LoginForm
              onSubmit={handleLoginSubmit}
              onForgotPasswordClick={() => setIsForgotPasswordOpen(true)}
              isSubmitting={isSubmitting}
              errorMessage={errorMessage}
              successMessage={successMessage}
            />
        ) : (
          <SignupForm onSubmit={handleSignupSubmit} isSubmitting={isSubmitting} errorMessage={errorMessage} successMessage={successMessage} />
        )}
      </div>
      <ForgotPasswordModal
        open={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onSubmit={handleForgotPasswordSubmit}
      />
    </section>
  )
}
