export type AuthMode = 'login' | 'signup' | 'forgot-password'

export type LoginRequest = {
  email: string
  password: string
  rememberMe: boolean
}

export type SignupRequest = {
  fullName: string
  email: string
  password: string
}

export type ForgotPasswordRequest = {
  email: string
}

export type AuthRequest = LoginRequest | SignupRequest | ForgotPasswordRequest


