import { apiClient, extractArray, type FetchParams } from '@/lib/api-client'
import type { CursorParams } from '@/lib/cursor-pagination'
import type { LookupPage } from '@/lib/use-cursor-lookup'
import type { UserRole } from '../auth/auth.types'
import type {
  CreateEmployeePayload,
  CreateJobPayload,
  Employee,
  EmployeeJobResponseDto,
  EmployeeJobWithEmployee,
  EmployeeJobWithJob,
  Job,
  UpdateEmployeeProfilePayload,
  UpdateJobPayload,
  UserAccount,
} from './staffing.types'

// ===================== EMPLOYEES =====================

export async function fetchEmployeesApi(params?: FetchParams): Promise<Employee[]> {
  const response = await apiClient.get('/employees', { params })
  return extractArray<Employee>(response.data)
}

export type EmployeeFilter = FetchParams & CursorParams & {
  q?: string
  canDrive?: 'true' | 'false'
  available?: 'true'
}

export async function fetchAvailableDriversApi(params: EmployeeFilter = {}): Promise<LookupPage<Employee>> {
  const { data } = await apiClient.get<LookupPage<Employee>>('/employees', {
    params: { ...params, canDrive: 'true', available: 'true', includeInactive: 'false', limit: params.limit ?? 50 },
  })
  if (!Array.isArray(data?.items) || !(data.nextCursor === null || typeof data.nextCursor === 'string'))
    throw new Error('The server returned an invalid driver page. Reload before continuing.')
  return data
}

export async function updateEmployeeDrivingEligibilityApi(id: number, canDrive: boolean): Promise<Employee> {
  if (typeof canDrive !== 'boolean') throw new Error('Choose explicit driving eligibility.')
  const { data } = await apiClient.patch<Employee>(`/employees/${id}/driving-eligibility`, { canDrive })
  return data
}

export async function fetchEmployeeByIdApi(id: number): Promise<Employee | null> {
  const { data } = await apiClient.get<Employee>(`/employees/${id}`)
  return data
}

export async function fetchEmployeeByEmailApi(email: string): Promise<Employee | null> {
  const { data } = await apiClient.get<Employee>(
    `/employees/email/${encodeURIComponent(email.trim())}`,
  )
  return data
}

export async function createEmployeeApi(payload: CreateEmployeePayload): Promise<Employee> {
  const cleanPayload = {
    ...(payload.canDrive !== undefined ? { canDrive: payload.canDrive } : {}),
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    hireDate: payload.hireDate
      ? new Date(payload.hireDate).toISOString()
      : new Date().toISOString(),
    ...(payload.phone?.trim() ? { phone: payload.phone.trim() } : {}),
    ...(payload.email?.trim() ? { email: payload.email.trim() } : {}),
    ...(payload.address?.trim() ? { address: payload.address.trim() } : {}),
    ...(payload.userId ? { userId: Number(payload.userId) } : {}),
  }

  const { data } = await apiClient.post<Employee>('/employees', cleanPayload)
  return data
}

export async function updateEmployeeProfileApi(
  id: number,
  payload: UpdateEmployeeProfilePayload,
): Promise<Employee> {
  const cleanPayload = {
    ...(payload.firstName ? { firstName: payload.firstName.trim() } : {}),
    ...(payload.lastName ? { lastName: payload.lastName.trim() } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
    ...(payload.email !== undefined ? { email: payload.email?.trim() || null } : {}),
    ...(payload.address !== undefined ? { address: payload.address?.trim() || null } : {}),
    ...(payload.hireDate ? { hireDate: payload.hireDate } : {}),
  }

  const { data } = await apiClient.patch<Employee>(`/employees/${id}/profile`, cleanPayload)
  return data
}

export async function linkEmployeeUserApi(id: number, userId: number): Promise<Employee> {
  const { data } = await apiClient.patch<Employee>(`/employees/${id}/user`, {
    userId: Number(userId),
  })
  return data
}

export async function unlinkEmployeeUserApi(id: number): Promise<Employee> {
  const { data } = await apiClient.delete<Employee>(`/employees/${id}/user`)
  return data
}

export async function deactivateEmployeeApi(id: number): Promise<Employee> {
  const { data } = await apiClient.delete<Employee>(`/employees/${id}`)
  return data
}

export async function reactivateEmployeeApi(id: number): Promise<Employee> {
  const { data } = await apiClient.patch<Employee>(`/employees/${id}/reactivate`)
  return data
}

// ===================== JOBS =====================

export async function fetchJobsApi(params?: FetchParams): Promise<Job[]> {
  const response = await apiClient.get('/jobs', { params })
  return extractArray<Job>(response.data)
}

export async function fetchJobByIdApi(id: number): Promise<Job | null> {
  const { data } = await apiClient.get<Job>(`/jobs/${id}`)
  return data
}

export async function fetchJobByNameApi(name: string): Promise<Job | null> {
  const { data } = await apiClient.get<Job>(`/jobs/name/${encodeURIComponent(name.trim())}`)
  return data
}

export async function createJobApi(payload: CreateJobPayload): Promise<Job> {
  const cleanPayload = {
    name: payload.name.trim(),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
  }

  const { data } = await apiClient.post<Job>('/jobs', cleanPayload)
  return data
}

export async function updateJobDetailsApi(id: number, payload: UpdateJobPayload): Promise<Job> {
  const cleanPayload = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.description !== undefined
      ? { description: payload.description?.trim() || null }
      : {}),
  }

  const { data } = await apiClient.patch<Job>(`/jobs/${id}/details`, cleanPayload)
  return data
}

export async function deactivateJobApi(id: number): Promise<Job> {
  const { data } = await apiClient.delete<Job>(`/jobs/${id}`)
  return data
}

export async function reactivateJobApi(id: number): Promise<Job> {
  const { data } = await apiClient.patch<Job>(`/jobs/${id}/reactivate`)
  return data
}

// ===================== EMPLOYEE JOBS (ASSIGNMENTS) =====================

export async function assignEmployeeJobApi(
  employeeId: number,
  jobId: number,
): Promise<EmployeeJobResponseDto> {
  const { data } = await apiClient.post<EmployeeJobResponseDto>('/employee-jobs', {
    employeeId: Number(employeeId),
    jobId: Number(jobId),
  })
  return data
}

export async function fetchEmployeeJobsByEmployeeApi(
  employeeId: number,
): Promise<EmployeeJobWithJob[]> {
  const { data } = await apiClient.get<EmployeeJobWithJob[]>(
    `/employee-jobs/employees/${employeeId}/jobs`,
  )
  return extractArray<EmployeeJobWithJob>(data)
}

export async function fetchEmployeeJobsByJobApi(jobId: number): Promise<EmployeeJobWithEmployee[]> {
  const { data } = await apiClient.get<EmployeeJobWithEmployee[]>(
    `/employee-jobs/jobs/${jobId}/employees`,
  )
  return extractArray<EmployeeJobWithEmployee>(data)
}

export async function fetchEmployeeJobApi(
  employeeId: number,
  jobId: number,
): Promise<EmployeeJobResponseDto | null> {
  const { data } = await apiClient.get<EmployeeJobResponseDto>(
    `/employee-jobs/employees/${employeeId}/jobs/${jobId}`,
  )
  return data
}

export async function unassignEmployeeJobApi(
  employeeId: number,
  jobId: number,
): Promise<EmployeeJobResponseDto> {
  const { data } = await apiClient.delete<EmployeeJobResponseDto>(
    `/employee-jobs/employees/${employeeId}/jobs/${jobId}`,
  )
  return data
}

export async function replaceEmployeeJobsApi(employeeId: number, jobIds: number[]): Promise<void> {
  if (jobIds.length === 0) {
    const assignments = await fetchEmployeeJobsByEmployeeApi(employeeId)
    for (const assignment of assignments) await unassignEmployeeJobApi(employeeId, assignment.jobId)
    return
  }
  await apiClient.put(`/employee-jobs/employees/${employeeId}/jobs`, { jobIds })
}

// ===================== USERS =====================

export async function fetchUsersApi(params?: FetchParams): Promise<UserAccount[]> {
  const response = await apiClient.get('/users', { params })
  const users = extractArray<UserAccount>(response.data)
  return users
}

export async function updateUserRoleApi(id: number, role: UserRole): Promise<UserAccount> {
  const { data } = await apiClient.patch<UserAccount>(`/users/${id}/role`, { role })
  return data
}

export async function deactivateUserApi(id: number): Promise<UserAccount> {
  const { data } = await apiClient.delete<UserAccount>(`/users/${id}`)
  return data
}

export async function reactivateUserApi(id: number): Promise<UserAccount> {
  const { data } = await apiClient.patch<UserAccount>(`/users/${id}/reactivate`)
  return data
}

export async function fetchUserByEmailApi(email: string): Promise<UserAccount | null> {
  const { data } = await apiClient.get<UserAccount>(
    `/users/email/${encodeURIComponent(email.trim())}`,
  )
  if (!data || typeof data !== 'object' || !('id' in data)) return null
  return data
}

export async function fetchUserByIdApi(id: number): Promise<UserAccount | null> {
  const { data } = await apiClient.get<UserAccount>(`/users/${id}`)
  if (!data || typeof data !== 'object' || !('id' in data)) return null
  return data
}

export async function updateUserEmailApi(id: number, email: string): Promise<UserAccount> {
  const { data } = await apiClient.patch<UserAccount>(`/users/${id}/email`, { email: email.trim() })
  return data
}

export async function updateUserPasswordApi(id: number, password: string): Promise<UserAccount> {
  const { data } = await apiClient.patch<UserAccount>(`/users/${id}/password`, { password })
  return data
}

// Hook alias exports
export const fetchEmployeesForJobApi = fetchEmployeeJobsByJobApi
export const fetchJobsForEmployeeApi = fetchEmployeeJobsByEmployeeApi
export const removeEmployeeJobApi = unassignEmployeeJobApi
export const replaceJobsForEmployeeApi = replaceEmployeeJobsApi
