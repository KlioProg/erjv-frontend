import { apiClient } from '@/lib/api-client'
import type { UserRole } from '../auth/auth.types'
import { mockStaffingStore } from './mock-staffing-store'
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

const isDemoMode = () => {
  const token = localStorage.getItem('erjv_access_token')
  return !token || token === 'demo-token'
}

// ===================== EMPLOYEES =====================

export async function fetchEmployeesApi(): Promise<Employee[]> {
  if (isDemoMode()) {
    return mockStaffingStore.getEmployees()
  }
  try {
    const { data } = await apiClient.get<Employee[]>('/employees')
    return data
  } catch {
    return mockStaffingStore.getEmployees()
  }
}

export async function fetchEmployeeByIdApi(id: number): Promise<Employee> {
  if (isDemoMode()) {
    const emp = mockStaffingStore.getEmployees().find((e) => e.id === id)
    if (!emp) throw new Error('Employee not found')
    return emp
  }
  try {
    const { data } = await apiClient.get<Employee>(`/employees/${id}`)
    return data
  } catch {
    const emp = mockStaffingStore.getEmployees().find((e) => e.id === id)
    if (!emp) throw new Error('Employee not found')
    return emp
  }
}

export async function createEmployeeApi(payload: CreateEmployeePayload): Promise<Employee> {
  if (isDemoMode()) {
    return mockStaffingStore.createEmployee(payload)
  }
  try {
    const { data } = await apiClient.post<Employee>('/employees', payload)
    return data
  } catch {
    return mockStaffingStore.createEmployee(payload)
  }
}

export async function updateEmployeeProfileApi(
  id: number,
  payload: UpdateEmployeeProfilePayload
): Promise<Employee> {
  if (isDemoMode()) {
    return mockStaffingStore.updateEmployee(id, payload)
  }
  try {
    const { data } = await apiClient.patch<Employee>(`/employees/${id}/profile`, payload)
    return data
  } catch {
    return mockStaffingStore.updateEmployee(id, payload)
  }
}

export async function linkEmployeeUserApi(id: number, userId: number): Promise<Employee> {
  if (isDemoMode()) {
    return mockStaffingStore.updateEmployee(id, {})
  }
  const { data } = await apiClient.patch<Employee>(`/employees/${id}/user`, { userId })
  return data
}

export async function unlinkEmployeeUserApi(id: number): Promise<Employee> {
  if (isDemoMode()) {
    return mockStaffingStore.updateEmployee(id, {})
  }
  const { data } = await apiClient.delete<Employee>(`/employees/${id}/user`)
  return data
}

export async function deactivateEmployeeApi(id: number): Promise<Employee> {
  if (isDemoMode()) {
    return mockStaffingStore.deactivateEmployee(id)
  }
  try {
    const { data } = await apiClient.delete<Employee>(`/employees/${id}`)
    return data
  } catch {
    return mockStaffingStore.deactivateEmployee(id)
  }
}

// ===================== JOBS =====================

export async function fetchJobsApi(): Promise<Job[]> {
  if (isDemoMode()) {
    return mockStaffingStore.getJobs()
  }
  try {
    const { data } = await apiClient.get<Job[]>('/jobs')
    return data
  } catch {
    return mockStaffingStore.getJobs()
  }
}

export async function fetchJobByIdApi(id: number): Promise<Job> {
  if (isDemoMode()) {
    const job = mockStaffingStore.getJobs().find((j) => j.id === id)
    if (!job) throw new Error('Job not found')
    return job
  }
  try {
    const { data } = await apiClient.get<Job>(`/jobs/${id}`)
    return data
  } catch {
    const job = mockStaffingStore.getJobs().find((j) => j.id === id)
    if (!job) throw new Error('Job not found')
    return job
  }
}

export async function createJobApi(payload: CreateJobPayload): Promise<Job> {
  if (isDemoMode()) {
    return mockStaffingStore.createJob(payload)
  }
  try {
    const { data } = await apiClient.post<Job>('/jobs', payload)
    return data
  } catch {
    return mockStaffingStore.createJob(payload)
  }
}

export async function updateJobDetailsApi(id: number, payload: UpdateJobPayload): Promise<Job> {
  if (isDemoMode()) {
    return mockStaffingStore.updateJob(id, payload)
  }
  try {
    const { data } = await apiClient.patch<Job>(`/jobs/${id}/details`, payload)
    return data
  } catch {
    return mockStaffingStore.updateJob(id, payload)
  }
}

export async function deactivateJobApi(id: number): Promise<Job> {
  if (isDemoMode()) {
    return mockStaffingStore.deactivateJob(id)
  }
  try {
    const { data } = await apiClient.delete<Job>(`/jobs/${id}`)
    return data
  } catch {
    return mockStaffingStore.deactivateJob(id)
  }
}

export async function reactivateJobApi(id: number): Promise<Job> {
  if (isDemoMode()) {
    return mockStaffingStore.reactivateJob(id)
  }
  try {
    const { data } = await apiClient.patch<Job>(`/jobs/${id}/reactivate`)
    return data
  } catch {
    return mockStaffingStore.reactivateJob(id)
  }
}

// ===================== EMPLOYEE-JOBS =====================

export async function assignEmployeeJobApi(
  employeeId: number,
  jobId: number
): Promise<EmployeeJobResponseDto> {
  if (isDemoMode()) {
    mockStaffingStore.assignJob(employeeId, jobId)
    return { employeeId, jobId, assignedAt: new Date().toISOString() }
  }
  try {
    const { data } = await apiClient.post<EmployeeJobResponseDto>('/employee-jobs', {
      employeeId,
      jobId,
    })
    return data
  } catch {
    mockStaffingStore.assignJob(employeeId, jobId)
    return { employeeId, jobId, assignedAt: new Date().toISOString() }
  }
}

export async function fetchJobsForEmployeeApi(employeeId: number): Promise<EmployeeJobWithJob[]> {
  if (isDemoMode()) {
    return mockStaffingStore.getJobsForEmployee(employeeId)
  }
  try {
    const { data } = await apiClient.get<EmployeeJobWithJob[]>(
      `/employee-jobs/employees/${employeeId}/jobs`
    )
    return data
  } catch {
    return mockStaffingStore.getJobsForEmployee(employeeId)
  }
}

export async function fetchEmployeesForJobApi(
  jobId: number
): Promise<EmployeeJobWithEmployee[]> {
  if (isDemoMode()) {
    return mockStaffingStore.getEmployeesForJob(jobId)
  }
  try {
    const { data } = await apiClient.get<EmployeeJobWithEmployee[]>(
      `/employee-jobs/jobs/${jobId}/employees`
    )
    return data
  } catch {
    return mockStaffingStore.getEmployeesForJob(jobId)
  }
}

export async function removeEmployeeJobApi(
  employeeId: number,
  jobId: number
): Promise<EmployeeJobResponseDto> {
  if (isDemoMode()) {
    mockStaffingStore.removeJob(employeeId, jobId)
    return { employeeId, jobId, assignedAt: new Date().toISOString() }
  }
  try {
    const { data } = await apiClient.delete<EmployeeJobResponseDto>(
      `/employee-jobs/employees/${employeeId}/jobs/${jobId}`
    )
    return data
  } catch {
    mockStaffingStore.removeJob(employeeId, jobId)
    return { employeeId, jobId, assignedAt: new Date().toISOString() }
  }
}

export async function replaceJobsForEmployeeApi(
  employeeId: number,
  jobIds: number[]
): Promise<void> {
  if (isDemoMode()) {
    mockStaffingStore.replaceJobs(employeeId, jobIds)
    return
  }
  try {
    await apiClient.put(`/employee-jobs/employees/${employeeId}/jobs`, { jobIds })
  } catch {
    mockStaffingStore.replaceJobs(employeeId, jobIds)
  }
}

// ===================== USERS =====================

export async function fetchUsersApi(): Promise<UserAccount[]> {
  if (isDemoMode()) {
    return mockStaffingStore.getUsers()
  }
  try {
    const { data } = await apiClient.get<UserAccount[]>('/users')
    return data
  } catch {
    return mockStaffingStore.getUsers()
  }
}

export async function updateUserRoleApi(id: number, role: UserRole): Promise<UserAccount> {
  if (isDemoMode()) {
    return mockStaffingStore.updateUserRole(id, role)
  }
  try {
    const { data } = await apiClient.patch<UserAccount>(`/users/${id}/role`, { role })
    return data
  } catch {
    return mockStaffingStore.updateUserRole(id, role)
  }
}
