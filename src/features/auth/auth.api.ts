import { apiClient } from '@/lib/api-client'
import type {
  AuthTokensResponse,
  LoginRequest,
  RegisterRequest,
  SafeUserResponse,
} from './auth.types'
import { BACKEND_ROLE_MAP } from './roles'

export async function loginApi(payload: LoginRequest): Promise<AuthTokensResponse> {
  const { data } = await apiClient.post<AuthTokensResponse>('/auth/login', {
    email: payload.email,
    password: payload.password,
  })
  return data
}

export async function registerApi(payload: RegisterRequest): Promise<SafeUserResponse> {
  const backendPayload = {
    ...payload,
    role: payload.role ? BACKEND_ROLE_MAP.toBackend(payload.role) : undefined,
  }
  const { data } = await apiClient.post<SafeUserResponse>('/auth/register', backendPayload)
  return {
    ...data,
    role: BACKEND_ROLE_MAP.fromBackend(data.role),
  }
}

export async function getProfileApi(): Promise<SafeUserResponse> {
  const { data } = await apiClient.get<SafeUserResponse>('/auth/profile')
  return {
    ...data,
    role: BACKEND_ROLE_MAP.fromBackend(data.role),
  }
}

