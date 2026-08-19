export type AuthMode = 'login' | 'signup'

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

export type AuthRequest = LoginRequest | SignupRequest
