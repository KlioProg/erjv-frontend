import { loginApi, registerApi } from '@/features/auth/auth.api'
import type { LoginRequest, RegisterRequest } from '@/features/auth/auth.types'

export async function submitLogin(formData: FormData) {
  const email = String(formData.get('email')).trim()
  const password = String(formData.get('password'))

  const payload: LoginRequest = {
    email,
    password,
  }

  const { accessToken } = await loginApi(payload)
  localStorage.setItem('erjv_access_token', accessToken)
  localStorage.removeItem('erjv_demo_user')
  return 'Signed in successfully.'
}

export async function submitSignup(formData: FormData) {
  const email = String(formData.get('email')).trim()
  const password = String(formData.get('password'))
  const role = (String(formData.get('role')) || 'STAFF') as 'OWNER' | 'ADMIN' | 'STAFF'

  const payload: RegisterRequest = {
    email,
    password,
    role,
  }

  const user = await registerApi(payload)
  return `Account created successfully for ${user.email} (${user.role}). You can now sign in.`
}

export async function submitForgotPassword(email: string) {
  // Simulating reset flow or endpoint
  await new Promise((resolve) => setTimeout(resolve, 800))
  return `Password reset link has been dispatched to ${email}.`
}
