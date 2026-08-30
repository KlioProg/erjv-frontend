export type UserRole = 'OWNER' | 'ADMIN' | 'STAFF'

export type AuthMode = 'login' | 'signup' | 'forgot-password'

export type LoginRequest = {
  email: string
  password: string
}

export type RegisterRequest = {
  fullName?: string
  email: string
  password: string
  role?: UserRole
  phone?: string
  avatarUrl?: string
  jobTitle?: string
  bio?: string
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
  fullName?: string | null
  phone?: string | null
  avatarUrl?: string | null
  jobTitle?: string | null
  bio?: string | null
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type UpdateUserProfilePayload = {
  fullName?: string
  phone?: string | null
  avatarUrl?: string | null
  jobTitle?: string | null
  bio?: string | null
}

export type AuthRequest = LoginRequest | RegisterRequest | ForgotPasswordRequest
