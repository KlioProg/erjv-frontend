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

// Format error messages from NestJS ValidationPipe or exceptions
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ message?: string | string[]; error?: string }>
    const resData = axiosErr.response?.data
    if (resData) {
      if (Array.isArray(resData.message)) {
        return resData.message.join(', ')
      }
      if (typeof resData.message === 'string' && resData.message !== 'Internal server error') {
        return resData.message
      }
      if (resData.error && resData.error !== 'Internal Server Error') {
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
      return 'Backend database service error. Please check database connection.'
    }
    return axiosErr.message || 'Network error communicating with server.'
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'An unexpected error occurred.'
}
