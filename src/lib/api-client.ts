import axios, { type AxiosError } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
})

// Attach JWT access token to outgoing requests if present (and not demo-token)
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('erjv_access_token')
  if (token && token !== 'demo-token' && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})
// Universal response unwrapper for array endpoints
export function extractArray<T = Record<string, unknown>>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data as T[]
    if (Array.isArray(obj.users)) return obj.users as T[]
    if (Array.isArray(obj.items)) return obj.items as T[]
    if (Array.isArray(obj.results)) return obj.results as T[]
    if (Array.isArray(obj.employees)) return obj.employees as T[]
    if (Array.isArray(obj.jobs)) return obj.jobs as T[]
    if (Array.isArray(obj.warehouses)) return obj.warehouses as T[]
    if (Array.isArray(obj.vehicles)) return obj.vehicles as T[]
    if (Array.isArray(obj.clients)) return obj.clients as T[]
    if (Array.isArray(obj.products)) return obj.products as T[]
  }
  return []
}

// Format error messages from NestJS ValidationPipe or exceptions
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ message?: string | string[]; error?: string }>
    const resData = axiosErr.response?.data
    if (resData) {
      if (Array.isArray(resData.message)) {
        return resData.message.join(', ')
      }
      if (typeof resData.message === 'string' && resData.message.trim()) {
        return resData.message
      }
      if (typeof resData.error === 'string' && resData.error.trim()) {
        return resData.error
      }
    }
    if (axiosErr.response?.status === 401) {
      return 'Unauthorized. Please log in with a valid account.'
    }
    if (axiosErr.response?.status === 403) {
      return 'You do not have permission to perform this action.'
    }
    if (axiosErr.response?.status === 500) {
      return 'Backend database service error (500). Please check backend terminal logs.'
    }
    return axiosErr.message || 'Network error communicating with server.'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred.'
}
