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

// Format error messages from NestJS ValidationPipe, Prisma constraints, or HTTP exceptions
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const axiosErr = error as AxiosError<{ message?: string | string[]; error?: string; statusCode?: number }>
    const status = axiosErr.response?.status
    const resData = axiosErr.response?.data
    let serverMessage = ''

    if (resData) {
      if (Array.isArray(resData.message)) {
        serverMessage = resData.message.join(', ')
      } else if (typeof resData.message === 'string' && resData.message.trim()) {
        serverMessage = resData.message
      } else if (typeof resData.error === 'string' && resData.error.trim()) {
        serverMessage = resData.error
      }
    }

    const lower = serverMessage.toLowerCase()

    // Handle database unique constraint / duplicate collisions
    if (lower.includes('unique') || lower.includes('duplicate') || lower.includes('already exists') || lower.includes('p2002')) {
      if (lower.includes('email')) {
        return 'This email address is already registered in the database.'
      }
      if (lower.includes('name')) {
        return 'A record with this name already exists in the database.'
      }
      if (lower.includes('plate') || lower.includes('platenumber')) {
        return 'A vehicle with this plate number already exists in the database.'
      }
      return 'A record with duplicate unique details already exists in the database.'
    }

    if (status === 403 || lower.includes('forbidden')) {
      return 'Access Denied (403): Your account role does not have permission to perform this action. Only Owners and Administrators can create, edit, or delete records.'
    }

    if (status === 401 || lower.includes('unauthorized')) {
      return 'Account not found or invalid credentials. Please check your email and password or register a new account.'
    }

    if (status === 404) {
      return 'Requested resource was not found in the database.'
    }

    if (serverMessage && !serverMessage.toLowerCase().includes('internal server error')) {
      return serverMessage
    }

    if (status === 500) {
      return 'Database service error (500). Please ensure PostgreSQL is running.'
    }

    return axiosErr.message || 'Network communication error.'
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase()
    if (lower.includes('forbidden') || lower.includes('403')) {
      return 'Access Denied (403): Your account role does not have permission to perform this action.'
    }
    return error.message
  }

  return 'An unexpected error occurred.'
}
