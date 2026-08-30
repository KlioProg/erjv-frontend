export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF'

export type AuthMode = 'login' | 'signup' | 'forgot-password'

export type LoginRequest = {
  email: string
  password: string
}

export type RegisterRequest = {
  email: string
  password: string
  role?: UserRole
}

// Extended signup request for UI form
export type SignupRequest = {
  fullName?: string
  email: string
  password: string
  role?: UserRole
}

export type ForgotPasswordRequest = {
  email: string
}

export type AuthTokensResponse = {
  accessToken: string
}

export type SafeUserResponse = {
  id: number
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type AuthRequest = LoginRequest | RegisterRequest | ForgotPasswordRequest
