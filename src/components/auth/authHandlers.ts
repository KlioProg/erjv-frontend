import { submitAuthRequest } from '../../features/auth/auth.api'
import type { LoginRequest, SignupRequest } from '../../features/auth/auth.types'

export async function submitLogin(formData: FormData) {
  const payload: LoginRequest = {
    email: String(formData.get('email')),
    password: String(formData.get('password')),
    rememberMe: formData.get('rememberMe') === 'on',
  }

  await submitAuthRequest('login', payload)
  return 'Signed in successfully.'
}

export async function submitSignup(formData: FormData) {
  const payload: SignupRequest = {
    fullName: String(formData.get('fullName')),
    email: String(formData.get('email')),
    password: String(formData.get('password')),
  }

  await submitAuthRequest('signup', payload)
  return 'Account created successfully.'
}

export async function submitForgotPassword(email: string) {
  await submitAuthRequest('forgot-password', { email })
  return 'Verification code sent to your email.'
}

