import { requirePassword } from './session'
import { apiClient } from '@/lib/api-client'
import {
  type AuthTokensResponse,
  type LoginRequest,
  type RegisterRequest,
  type SafeUserResponse,
} from './auth.types'

export async function loginApi(payload: LoginRequest): Promise<AuthTokensResponse> {
  requirePassword(payload.password)
  const { data } = await apiClient.post<AuthTokensResponse>('/auth/login', payload)
  return data
}

export async function registerApi(payload: RegisterRequest): Promise<SafeUserResponse> {
  requirePassword(payload.password)
  const { data } = await apiClient.post<SafeUserResponse>('/auth/register', payload)
  return data
}

export async function getProfileApi(): Promise<SafeUserResponse> {
  const { data } = await apiClient.get<SafeUserResponse>('/auth/profile')
  return data
}
