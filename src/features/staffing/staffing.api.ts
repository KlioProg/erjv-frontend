import { apiClient, extractArray, type FetchParams } from '@/lib/api-client'
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

export async function fetchEmployeeByIdApi(id: number): Promise<Employee> {
  const { data } = await apiClient.get<Employee>(`/employees/${id}`)
  return data
}

export async function fetchEmployeeByEmailApi(email: string): Promise<Employee | null> {
  try {
    const { data } = await apiClient.get<Employee>(`/employees/email/${encodeURIComponent(email.trim())}`)
    return data
  } catch {
    return null
  }
}

export async function createEmployeeApi(payload: CreateEmployeePayload): Promise<Employee> {
  const cleanPayload = {
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    hireDate: payload.hireDate ? new Date(payload.hireDate).toISOString() : new Date().toISOString(),
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
  payload: UpdateEmployeeProfilePayload
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
  const { data } = await apiClient.patch<Employee>(`/employees/${id}/user`, { userId: Number(userId) })
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

export async function fetchJobByIdApi(id: number): Promise<Job> {
  const { data } = await apiClient.get<Job>(`/jobs/${id}`)
  return data
}

export async function fetchJobByNameApi(name: string): Promise<Job | null> {
  try {
    const { data } = await apiClient.get<Job>(`/jobs/name/${encodeURIComponent(name.trim())}`)
    return data
  } catch {
    return null
  }
}

export async function createJobApi(payload: CreateJobPayload): Promise<Job> {
  const cleanPayload = {
    name: payload.name.trim(),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
  }

  const { data } = await apiClient.post<Job>('/jobs', cleanPayload)
  return data
}

export async function updateJobDetailsApi(
  id: number,
  payload: UpdateJobPayload
): Promise<Job> {
  const cleanPayload = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.description !== undefined ? { description: payload.description?.trim() || null } : {}),
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
  jobId: number
): Promise<EmployeeJobResponseDto> {
  const { data } = await apiClient.post<EmployeeJobResponseDto>('/employee-jobs', {
    employeeId: Number(employeeId),
    jobId: Number(jobId),
  })
  return data
}

export async function fetchEmployeeJobsByEmployeeApi(
  employeeId: number
): Promise<EmployeeJobWithJob[]> {
  const { data } = await apiClient.get<EmployeeJobWithJob[]>(
    `/employee-jobs/employees/${employeeId}/jobs`
  )
  return extractArray<EmployeeJobWithJob>(data)
}

export async function fetchEmployeeJobsByJobApi(
  jobId: number
): Promise<EmployeeJobWithEmployee[]> {
  const { data } = await apiClient.get<EmployeeJobWithEmployee[]>(
    `/employee-jobs/jobs/${jobId}/employees`
  )
  return extractArray<EmployeeJobWithEmployee>(data)
}

export async function unassignEmployeeJobApi(
  employeeId: number,
  jobId: number
): Promise<EmployeeJobResponseDto> {
  const { data } = await apiClient.delete<EmployeeJobResponseDto>(
    `/employee-jobs/employees/${employeeId}/jobs/${jobId}`
  )
  return data
}

export async function replaceEmployeeJobsApi(
  employeeId: number,
  jobIds: number[]
): Promise<void> {
  await apiClient.put(`/employee-jobs/employees/${employeeId}/jobs`, { jobIds })
}

// ===================== USERS =====================

export async function fetchUsersApi(params?: FetchParams): Promise<UserAccount[]> {
  const response = await apiClient.get('/users', { params })
  return extractArray<UserAccount>(response.data)
}

export async function updateUserRoleApi(
  id: number,
  role: UserRole
): Promise<UserAccount> {
  const { data } = await apiClient.patch<UserAccount>(`/users/${id}/role`, { role })
  return data
}

export async function deactivateUserApi(id: number): Promise<UserAccount> {
  const { data } = await apiClient.delete<UserAccount>(`/users/${id}`)
  return data
}

// Hook alias exports
export const fetchEmployeesForJobApi = fetchEmployeeJobsByJobApi
export const fetchJobsForEmployeeApi = fetchEmployeeJobsByEmployeeApi
export const removeEmployeeJobApi = unassignEmployeeJobApi
export const replaceJobsForEmployeeApi = replaceEmployeeJobsApi

