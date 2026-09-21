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

// Attach JWT access token to outgoing requests if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('erjv_access_token')
  if (token === 'demo-token') {
    localStorage.removeItem('erjv_access_token')
    return config
  }
  if (token && config.headers) {
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

// Helper to transform any raw error string, status code or message into clean, human-friendly text
export function humanizeErrorMessage(raw: string, status?: number): string {
  if (!raw || typeof raw !== 'string') {
    return 'Unable to complete your request. Please check your connection and try again.'
  }

  const lower = raw.toLowerCase()

  // 1. Gateway & Proxy connection issues (502, 503, 504, Bad Gateway, Service Unavailable)
  if (
    status === 502 ||
    status === 503 ||
    status === 504 ||
    lower.includes('502') ||
    lower.includes('503') ||
    lower.includes('504') ||
    lower.includes('bad gateway') ||
    lower.includes('service unavailable') ||
    lower.includes('gateway timeout')
  ) {
    return "The service is temporarily offline. We're working to get it back online right away. Please try again in a moment."
  }

  // 2. Network connectivity / Offline / Timeout / Refused
  if (
    lower.includes('network error') ||
    lower.includes('econnrefused') ||
    lower.includes('err_network') ||
    lower.includes('econnaborted') ||
    lower.includes('timed out') ||
    lower.includes('timeout') ||
    lower.includes('failed to fetch')
  ) {
    return 'Unable to connect to the server. Please check your network connection and try again.'
  }

  // 3. Permission / Forbidden (403)
  if (status === 403 || lower.includes('forbidden') || lower.includes('403') || lower.includes('access denied')) {
    return 'Access denied. Your account does not have permission to perform this action.'
  }

  // 4. Authentication / Unauthorized (401)
  if (status === 401 || lower.includes('unauthorized') || lower.includes('401') || lower.includes('jwt') || lower.includes('token')) {
    return 'Your session has expired or authentication failed. Please sign in again to continue.'
  }

  // 5. Not Found (404)
  if (status === 404 || lower.includes('404') || lower.includes('not found')) {
    return 'The requested record or resource could not be found.'
  }

  // Specific logistics & workflow domain conflict errors
  if (lower.includes('vehicle is not available') || lower.includes('vehicle not available')) {
    return 'The selected vehicle is currently not available for delivery. Please select an available vehicle from the fleet.'
  }
  if (lower.includes('driver is not active') || lower.includes('driver not active')) {
    return 'The assigned driver is currently marked inactive. Please assign an active driver.'
  }
  if (lower.includes('only a draft delivery can be scheduled')) {
    return 'Only a delivery in Draft status can be scheduled.'
  }
  if (lower.includes('only a scheduled delivery can be dispatched')) {
    return 'Only a delivery in Scheduled status can be dispatched.'
  }
  if (lower.includes('only a dispatched delivery can be completed')) {
    return 'Only a delivery currently in transit (Dispatched) can be recorded as completed.'
  }
  if (lower.includes('delivery quantity exceeds remaining allocation')) {
    return 'Delivery quantity exceeds the remaining unfulfilled allocation for this sales order.'
  }
  if (lower.includes('insufficient available stock') || lower.includes('insufficient physical or reserved stock')) {
    return 'Insufficient warehouse stock available to fulfill this allocation.'
  }
  if (lower.includes('sales order is not deliverable')) {
    return 'This sales order is not in a deliverable status (must be Confirmed or Partially Delivered).'
  }
  if (lower.includes('outgoing delivery cannot be cancelled')) {
    return 'This delivery cannot be cancelled because it has already progressed or has recorded stock movements.'
  }

  // 6. Generic Conflict (409) / Database constraint
  if (
    lower.includes('database constraint conflict') ||
    lower.includes('unique constraint') ||
    raw === '409' ||
    lower === 'conflict' ||
    lower.includes('request failed with status code 409')
  ) {
    return 'This record conflicts with an existing entry. Please check for duplicate details and try again.'
  }

  // 7. Rate Limiting (429)
  if (status === 429 || lower.includes('429') || lower.includes('too many requests')) {
    return 'Too many requests. Please wait a moment before trying again.'
  }

  // 8. Server Error 500
  if (status === 500 || lower.includes('500') || lower.includes('internal server error')) {
    return 'An internal server error occurred while processing your request. Please try again in a few moments.'
  }

  // 9. Catch any remaining "Request failed with status code ..." pattern
  if (/request failed with status code \d+/i.test(raw)) {
    if (status && status >= 500) {
      return "The service is temporarily offline. We're working to get it back online right away. Please try again in a moment."
    }
    if (status === 400) {
      return 'The submitted information was invalid. Please review your input and try again.'
    }
    return 'Unable to complete your request. Please check your connection and try again.'
  }

  // 10. Clean up raw validation messages (capitalize first letter, ensure period at end)
  const trimmed = raw.trim()
  if (trimmed.length > 0) {
    const formatted = trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
    return formatted.endsWith('.') ? formatted : `${formatted}.`
  }

  return 'Unable to complete your request. Please try again.'
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
        serverMessage = resData.message.join('. ')
      } else if (typeof resData.message === 'string' && resData.message.trim()) {
        serverMessage = resData.message
      } else if (typeof resData.error === 'string' && resData.error.trim()) {
        serverMessage = resData.error
      }
    }

    const url = axiosErr.config?.url || ''
    const lower = serverMessage.toLowerCase()

    // 0. Gateway and Network availability check (502, 503, 504, Network Error)
    if (
      status === 502 ||
      status === 503 ||
      status === 504 ||
      lower.includes('bad gateway') ||
      lower.includes('service unavailable') ||
      lower.includes('gateway timeout') ||
      axiosErr.code === 'ERR_NETWORK' ||
      axiosErr.code === 'ECONNABORTED' ||
      !axiosErr.response
    ) {
      return humanizeErrorMessage(axiosErr.message, status)
    }

    // 1. Login failures (/auth/login)
    if (url.includes('/auth/login')) {
      if (
        status === 401 ||
        lower.includes('invalid credentials') ||
        lower.includes('unauthorized') ||
        lower.includes('password')
      ) {
        return 'Incorrect email or password. Please verify your credentials and try again.'
      }
      if (status === 403 || lower.includes('deactivated') || lower.includes('inactive')) {
        return 'Your account has been deactivated. Please contact an enterprise administrator.'
      }
    }

    // 2. User Registration conflicts (/auth/register)
    if (
      url.includes('/auth/register') &&
      (status === 500 ||
        status === 409 ||
        status === 400 ||
        lower.includes('unique') ||
        lower.includes('duplicate'))
    ) {
      return 'An account with this email address is already registered. Please use a different email address.'
    }

    // 3. Prisma P2002 Unique Constraint / Duplicate Keys
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

    // 4. Prisma P2003 Foreign Key Constraint Failures
    if (
      lower.includes('p2003') ||
      lower.includes('foreign key') ||
      lower.includes('violates foreign key')
    ) {
      return 'Cannot complete operation: one of the related records (e.g. warehouse, job position, user, or product) does not exist or is currently in use.'
    }

    // 5. Prisma P2025 Record Not Found / Already Deleted
    if (
      lower.includes('p2025') ||
      lower.includes('record to update not found') ||
      lower.includes('record to delete not found')
    ) {
      return 'The requested record was not found or has already been removed from the database.'
    }

    // 6. Role & Auth Guard Responses
    if (status === 403 || lower.includes('forbidden')) {
      return 'Access denied. Your account role does not have permission to perform this action.'
    }

    if (status === 401 || lower.includes('unauthorized')) {
      return 'Your session has expired or authentication failed. Please sign in again.'
    }

    // 7. Clean validation or domain message if available from server
    if (serverMessage && !lower.includes('internal server error') && !lower.includes('status code')) {
      return humanizeErrorMessage(serverMessage, status)
    }

    if (status === 404) {
      return 'The requested item could not be found.'
    }

    if (status === 409) {
      return 'This record conflicts with an existing entry. Please check for duplicate details and try again.'
    }

    if (status === 429) {
      return 'Too many requests. Please wait a moment before trying again.'
    }

    // 8. Generic 500 fallback
    if (status === 500) {
      return 'An internal server error occurred while processing your request. Please try again in a few moments.'
    }

    return humanizeErrorMessage(axiosErr.message, status)
  }

  if (error instanceof Error) {
    return humanizeErrorMessage(error.message)
  }

  if (typeof error === 'string') {
    return humanizeErrorMessage(error)
  }

  return 'An unexpected error occurred. Please try again.'
}
