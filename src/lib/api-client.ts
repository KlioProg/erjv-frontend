import axios, { type AxiosError } from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export type IncludeInactive = 'true' | 'false' | 'only'
export type FetchParams = {
  includeInactive?: IncludeInactive
}

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
    const axiosErr = error as AxiosError<{
      message?: string | string[]
      error?: string
      statusCode?: number
    }>
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

    const url = axiosErr.config?.url || ''
    const lower = serverMessage.toLowerCase()

    // 1. User Registration conflicts (/auth/register)
    if (
      url.includes('/auth/register') &&
      (status === 500 ||
        status === 409 ||
        status === 400 ||
        lower.includes('unique') ||
        lower.includes('duplicate'))
    ) {
      return 'An account with this email address is already registered. Please sign in instead or use a different email address.'
    }

    // 2. Prisma P2002 Unique Constraint / Duplicate Keys
    if (
      lower.includes('unique') ||
      lower.includes('duplicate') ||
      lower.includes('already exists') ||
      lower.includes('p2002') ||
      lower.includes('unique constraint')
    ) {
      if (lower.includes('email') || url.includes('/employees') || url.includes('/users')) {
        return 'This email address is already registered to an existing account or employee in the database.'
      }
      if (
        lower.includes('plate') ||
        lower.includes('platenumber') ||
        url.includes('/delivery-vehicles')
      ) {
        return 'A vehicle with this plate number is already registered in the fleet.'
      }
      if (
        lower.includes('inventoryitemid_warehouseid') ||
        (lower.includes('warehouse') && lower.includes('product')) ||
        url.includes('/stock-items')
      ) {
        return 'A stock allocation record for this product already exists in this warehouse.'
      }
      if (
        lower.includes('employeeid_jobid') ||
        (lower.includes('employee') && lower.includes('job')) ||
        url.includes('/employee-jobs')
      ) {
        return 'This employee is already assigned to this job position.'
      }
      if (lower.includes('userid') || lower.includes('user_id')) {
        return 'This user account is already linked to another employee profile.'
      }
      if (
        lower.includes('name') ||
        url.includes('/inventory-items') ||
        url.includes('/jobs') ||
        url.includes('/clients') ||
        url.includes('/warehouses')
      ) {
        return 'A record with this name already exists in the database. Please use a unique title or reactivate the existing record.'
      }
      return 'A record with duplicate unique details already exists in the database.'
    }

    // 2. Prisma P2003 Foreign Key Constraint Failures
    if (
      lower.includes('p2003') ||
      lower.includes('foreign key') ||
      lower.includes('violates foreign key')
    ) {
      return 'Cannot complete operation: one of the related records (e.g. warehouse, job position, user, or product) does not exist or is currently in use.'
    }

    // 3. Prisma P2025 Record Not Found / Already Deleted
    if (
      lower.includes('p2025') ||
      lower.includes('record to update not found') ||
      lower.includes('record to delete not found')
    ) {
      return 'The requested record was not found or has already been removed from the database.'
    }

    // 4. Role & Auth Guard Responses
    if (status === 403 || lower.includes('forbidden')) {
      return 'Access Denied (403): Your account role does not have permission to perform this action. Only Owners and Administrators can modify these records.'
    }

    if (status === 401 || lower.includes('unauthorized')) {
      return 'Invalid credentials or session expired. Please sign in again.'
    }

    if (status === 404) {
      return 'The requested item was not found.'
    }

    // 5. Clean validation message if available
    if (serverMessage && !lower.includes('internal server error')) {
      return serverMessage
    }

    // 6. Generic 500 fallback with actionable advice
    if (status === 500) {
      return 'Database constraint error (500). Please check for duplicate unique fields or related records in the database.'
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
