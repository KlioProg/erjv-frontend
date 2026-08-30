import { apiClient } from '@/lib/api-client'
import type {
  AuthTokensResponse,
  LoginRequest,
  RegisterRequest,
  SafeUserResponse,
} from './auth.types'

export async function loginApi(payload: LoginRequest): Promise<AuthTokensResponse> {
  const { data } = await apiClient.post<AuthTokensResponse>('/auth/login', {
    email: payload.email,
    password: payload.password,
  })
  return data
}

export async function registerApi(payload: RegisterRequest): Promise<SafeUserResponse> {
  const { data } = await apiClient.post<SafeUserResponse>('/auth/register', payload)
  return data
}

export async function getProfileApi(): Promise<SafeUserResponse> {
  const { data } = await apiClient.get<SafeUserResponse>('/auth/profile')
  return data
}

export async function updateProfileApi(payload: {
  fullName?: string
  phone?: string | null
  avatarUrl?: string | null
  jobTitle?: string | null
  bio?: string | null
}): Promise<SafeUserResponse> {
  const { data } = await apiClient.patch<SafeUserResponse>('/auth/profile', payload)
  return data
}
