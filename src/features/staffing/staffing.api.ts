import { apiClient } from '@/lib/api-client'
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

const EMPLOYEES_STORAGE_KEY = 'erjv_db_employees_v5'
const JOBS_STORAGE_KEY = 'erjv_db_jobs_v5'
const EMPLOYEE_JOBS_STORAGE_KEY = 'erjv_db_employee_jobs_v5'
const USERS_STORAGE_KEY = 'erjv_db_users_v5'

const INITIAL_JOBS: Job[] = [
  {
    id: 1,
    name: 'Operations Director',
    description: 'Executive oversight for supply chain, warehousing facilities, and distribution logistics.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Warehouse & Depot Supervisor',
    description: 'Direct management of receiving, physical inventory audits, and outbound dispatch operations.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Senior Logistics Hauler Driver',
    description: 'Operation of heavy commercial transport, highway cargo distribution, and multi-depot transfers.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: 'POS Billing & Cashier Specialist',
    description: 'Commercial invoice generation, point-of-sale customer checkout, and daily sales reconciliation.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const INITIAL_EMPLOYEES: Employee[] = []

const INITIAL_EMPLOYEE_JOBS: { employeeId: number; jobId: number }[] = []

const INITIAL_USERS: UserAccount[] = []

function getStored<T>(key: string, initial: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw) return JSON.parse(raw)
  } catch {
    // Ignore JSON error
  }
  localStorage.setItem(key, JSON.stringify(initial))
  return initial
}

function setStored<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ===================== EMPLOYEES =====================

export async function fetchEmployeesApi(): Promise<Employee[]> {
  try {
    const { data } = await apiClient.get<Employee[]>('/employees')
    if (Array.isArray(data) && data.length > 0) {
      setStored(EMPLOYEES_STORAGE_KEY, data)
      return data
    }
  } catch {
    // Graceful fallback
  }

  const emps = getStored<Employee[]>(EMPLOYEES_STORAGE_KEY, INITIAL_EMPLOYEES)

  // Auto-sync any registered users into the employees directory
  try {
    const rawDbUsers = localStorage.getItem('erjv_db_users_v5')
    const dbUsers = rawDbUsers ? JSON.parse(rawDbUsers) : []

    dbUsers.forEach((u: { id: number; email: string; fullName?: string; phone?: string | null }) => {
      const exists = emps.some(
        (e) => (e.email && e.email.toLowerCase() === u.email.toLowerCase()) || e.userId === u.id
      )
      if (!exists) {
        const nameParts = (u.fullName || u.email.split('@')[0]).trim().split(' ')
        const firstName = nameParts[0] || 'Staff'
        const lastName = nameParts.slice(1).join(' ') || 'Member'
        emps.push({
          id: u.id,
          firstName,
          lastName,
          email: u.email,
          phone: u.phone || null,
          address: null,
          hireDate: new Date().toISOString().split('T')[0],
          isActive: true,
          userId: u.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      } else {
        // Ensure name is up to date if user updated full name
        const idx = emps.findIndex(
          (e) => (e.email && e.email.toLowerCase() === u.email.toLowerCase()) || e.userId === u.id
        )
        if (idx !== -1 && u.fullName) {
          const nameParts = u.fullName.trim().split(' ')
          emps[idx].firstName = nameParts[0] || emps[idx].firstName
          emps[idx].lastName = nameParts.slice(1).join(' ') || emps[idx].lastName
          if (u.phone) emps[idx].phone = u.phone
          if (!emps[idx].userId) emps[idx].userId = u.id
        }
      }
    })
    setStored(EMPLOYEES_STORAGE_KEY, emps)
  } catch {
    // Ignore
  }

  return emps.filter((e) => e.isActive)
}

export async function fetchEmployeeByIdApi(id: number): Promise<Employee> {
  try {
    const { data } = await apiClient.get<Employee>(`/employees/${id}`)
    return data
  } catch {
    const list = getStored<Employee[]>(EMPLOYEES_STORAGE_KEY, INITIAL_EMPLOYEES)
    const found = list.find((e) => e.id === id)
    if (found) return found
    throw new Error('Employee not found')
  }
}

export async function createEmployeeApi(payload: CreateEmployeePayload): Promise<Employee> {
  const cleanPayload = {
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    hireDate: payload.hireDate || new Date().toISOString().split('T')[0],
    ...(payload.phone?.trim() ? { phone: payload.phone.trim() } : {}),
    ...(payload.email?.trim() ? { email: payload.email.trim() } : {}),
    ...(payload.address?.trim() ? { address: payload.address.trim() } : {}),
    ...(payload.userId ? { userId: payload.userId } : {}),
  }

  try {
    const { data } = await apiClient.post<Employee>('/employees', cleanPayload)
    if (data && data.id) {
      const list = getStored<Employee[]>(EMPLOYEES_STORAGE_KEY, INITIAL_EMPLOYEES)
      setStored(EMPLOYEES_STORAGE_KEY, [data, ...list.filter((e) => e.id !== data.id)])
      return data
    }
  } catch {
    // Graceful fallback
  }

  const list = getStored<Employee[]>(EMPLOYEES_STORAGE_KEY, INITIAL_EMPLOYEES)
  const newId = list.length > 0 ? Math.max(...list.map((e) => e.id)) + 1 : 1
  const newEmp: Employee = {
    id: newId,
    firstName: cleanPayload.firstName,
    lastName: cleanPayload.lastName,
    phone: cleanPayload.phone || null,
    email: cleanPayload.email || null,
    address: cleanPayload.address || null,
    hireDate: cleanPayload.hireDate,
    isActive: true,
    userId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  setStored(EMPLOYEES_STORAGE_KEY, [...list, newEmp])
  return newEmp
}

export async function updateEmployeeProfileApi(
  id: number,
  payload: UpdateEmployeeProfilePayload
): Promise<Employee> {
  const cleanPayload = {
    ...(payload.firstName ? { firstName: payload.firstName.trim() } : {}),
    ...(payload.lastName ? { lastName: payload.lastName.trim() } : {}),
    ...(payload.hireDate ? { hireDate: payload.hireDate } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
    ...(payload.email !== undefined ? { email: payload.email?.trim() || null } : {}),
    ...(payload.address !== undefined ? { address: payload.address?.trim() || null } : {}),
  }

  try {
    const { data } = await apiClient.patch<Employee>(`/employees/${id}/profile`, cleanPayload)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<Employee[]>(EMPLOYEES_STORAGE_KEY, INITIAL_EMPLOYEES)
  const index = list.findIndex((e) => e.id === id)
  if (index !== -1) {
    list[index] = {
      ...list[index],
      firstName: cleanPayload.firstName ?? list[index].firstName,
      lastName: cleanPayload.lastName ?? list[index].lastName,
      phone: cleanPayload.phone !== undefined ? cleanPayload.phone : list[index].phone,
      email: cleanPayload.email !== undefined ? cleanPayload.email : list[index].email,
      address: cleanPayload.address !== undefined ? cleanPayload.address : list[index].address,
      hireDate: cleanPayload.hireDate ?? list[index].hireDate,
      updatedAt: new Date().toISOString(),
    }
    setStored(EMPLOYEES_STORAGE_KEY, list)
    return list[index]
  }
  throw new Error('Employee not found')
}

export async function linkEmployeeUserApi(id: number, userId: number): Promise<Employee> {
  try {
    const { data } = await apiClient.patch<Employee>(`/employees/${id}/user`, { userId })
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<Employee[]>(EMPLOYEES_STORAGE_KEY, INITIAL_EMPLOYEES)
  const index = list.findIndex((e) => e.id === id)
  if (index !== -1) {
    list[index].userId = userId
    setStored(EMPLOYEES_STORAGE_KEY, list)
    return list[index]
  }
  throw new Error('Employee not found')
}

export async function unlinkEmployeeUserApi(id: number): Promise<Employee> {
  try {
    const { data } = await apiClient.delete<Employee>(`/employees/${id}/user`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<Employee[]>(EMPLOYEES_STORAGE_KEY, INITIAL_EMPLOYEES)
  const index = list.findIndex((e) => e.id === id)
  if (index !== -1) {
    list[index].userId = null
    setStored(EMPLOYEES_STORAGE_KEY, list)
    return list[index]
  }
  throw new Error('Employee not found')
}

export async function deactivateEmployeeApi(id: number): Promise<Employee> {
  try {
    const { data } = await apiClient.delete<Employee>(`/employees/${id}`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<Employee[]>(EMPLOYEES_STORAGE_KEY, INITIAL_EMPLOYEES)
  const index = list.findIndex((e) => e.id === id)
  if (index !== -1) {
    list[index].isActive = false
    setStored(EMPLOYEES_STORAGE_KEY, list)
    return list[index]
  }
  throw new Error('Employee not found')
}

// ===================== JOBS =====================

export async function fetchJobsApi(): Promise<Job[]> {
  try {
    const { data } = await apiClient.get<Job[]>('/jobs')
    if (Array.isArray(data) && data.length > 0) {
      setStored(JOBS_STORAGE_KEY, data)
      return data
    }
  } catch {
    // Graceful fallback
  }
  return getStored<Job[]>(JOBS_STORAGE_KEY, INITIAL_JOBS).filter((j) => j.isActive)
}

export async function fetchJobByIdApi(id: number): Promise<Job> {
  try {
    const { data } = await apiClient.get<Job>(`/jobs/${id}`)
    return data
  } catch {
    const list = getStored<Job[]>(JOBS_STORAGE_KEY, INITIAL_JOBS)
    const found = list.find((j) => j.id === id)
    if (found) return found
    throw new Error('Job not found')
  }
}

export async function createJobApi(payload: CreateJobPayload): Promise<Job> {
  const cleanPayload = {
    name: payload.name.trim(),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
  }

  try {
    const { data } = await apiClient.post<Job>('/jobs', cleanPayload)
    if (data && data.id) {
      const list = getStored<Job[]>(JOBS_STORAGE_KEY, INITIAL_JOBS)
      setStored(JOBS_STORAGE_KEY, [data, ...list.filter((j) => j.id !== data.id)])
      return data
    }
  } catch {
    // Graceful fallback
  }

  const list = getStored<Job[]>(JOBS_STORAGE_KEY, INITIAL_JOBS)
  const newId = list.length > 0 ? Math.max(...list.map((j) => j.id)) + 1 : 1
  const newJob: Job = {
    id: newId,
    name: cleanPayload.name,
    description: cleanPayload.description || null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  setStored(JOBS_STORAGE_KEY, [...list, newJob])
  return newJob
}

export async function updateJobDetailsApi(id: number, payload: UpdateJobPayload): Promise<Job> {
  const cleanPayload = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.description !== undefined ? { description: payload.description?.trim() || null } : {}),
  }

  try {
    const { data } = await apiClient.patch<Job>(`/jobs/${id}/details`, cleanPayload)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<Job[]>(JOBS_STORAGE_KEY, INITIAL_JOBS)
  const index = list.findIndex((j) => j.id === id)
  if (index !== -1) {
    list[index] = {
      ...list[index],
      name: cleanPayload.name ?? list[index].name,
      description: cleanPayload.description !== undefined ? cleanPayload.description : list[index].description,
      updatedAt: new Date().toISOString(),
    }
    setStored(JOBS_STORAGE_KEY, list)
    return list[index]
  }
  throw new Error('Job not found')
}

export async function deactivateJobApi(id: number): Promise<Job> {
  try {
    const { data } = await apiClient.delete<Job>(`/jobs/${id}`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<Job[]>(JOBS_STORAGE_KEY, INITIAL_JOBS)
  const index = list.findIndex((j) => j.id === id)
  if (index !== -1) {
    list[index].isActive = false
    setStored(JOBS_STORAGE_KEY, list)
    return list[index]
  }
  throw new Error('Job not found')
}

export async function reactivateJobApi(id: number): Promise<Job> {
  try {
    const { data } = await apiClient.patch<Job>(`/jobs/${id}/reactivate`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<Job[]>(JOBS_STORAGE_KEY, INITIAL_JOBS)
  const index = list.findIndex((j) => j.id === id)
  if (index !== -1) {
    list[index].isActive = true
    setStored(JOBS_STORAGE_KEY, list)
    return list[index]
  }
  throw new Error('Job not found')
}

// ===================== EMPLOYEE-JOBS =====================

export async function assignEmployeeJobApi(
  employeeId: number,
  jobId: number
): Promise<EmployeeJobResponseDto> {
  try {
    const { data } = await apiClient.post<EmployeeJobResponseDto>('/employee-jobs', {
      employeeId,
      jobId,
    })
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<{ employeeId: number; jobId: number }[]>(
    EMPLOYEE_JOBS_STORAGE_KEY,
    INITIAL_EMPLOYEE_JOBS
  )
  if (!list.some((ej) => ej.employeeId === employeeId && ej.jobId === jobId)) {
    setStored(EMPLOYEE_JOBS_STORAGE_KEY, [...list, { employeeId, jobId }])
  }
  return {
    employeeId,
    jobId,
    assignedAt: new Date().toISOString(),
  }
}

export async function fetchJobsForEmployeeApi(employeeId: number): Promise<EmployeeJobWithJob[]> {
  try {
    const { data } = await apiClient.get<EmployeeJobWithJob[]>(
      `/employee-jobs/employees/${employeeId}/jobs`
    )
    if (Array.isArray(data) && data.length > 0) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<{ employeeId: number; jobId: number }[]>(
    EMPLOYEE_JOBS_STORAGE_KEY,
    INITIAL_EMPLOYEE_JOBS
  )
  const jobs = getStored<Job[]>(JOBS_STORAGE_KEY, INITIAL_JOBS)

  return list
    .filter((ej) => ej.employeeId === employeeId)
    .map((ej) => {
      const job = jobs.find((j) => j.id === ej.jobId) || {
        id: ej.jobId,
        name: 'Assigned Position',
        description: null,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      return {
        employeeId: ej.employeeId,
        jobId: ej.jobId,
        assignedAt: new Date().toISOString(),
        job: {
          id: job.id,
          name: job.name,
        },
      }
    })
}

export async function fetchEmployeesForJobApi(
  jobId: number
): Promise<EmployeeJobWithEmployee[]> {
  try {
    const { data } = await apiClient.get<EmployeeJobWithEmployee[]>(
      `/employee-jobs/jobs/${jobId}/employees`
    )
    if (Array.isArray(data) && data.length > 0) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<{ employeeId: number; jobId: number }[]>(
    EMPLOYEE_JOBS_STORAGE_KEY,
    INITIAL_EMPLOYEE_JOBS
  )
  const emps = getStored<Employee[]>(EMPLOYEES_STORAGE_KEY, INITIAL_EMPLOYEES)

  return list
    .filter((ej) => ej.jobId === jobId)
    .map((ej) => {
      const employee = emps.find((e) => e.id === ej.employeeId) || {
        id: ej.employeeId,
        firstName: 'Assigned',
        lastName: 'Employee',
        phone: null,
        email: null,
        address: null,
        hireDate: '2023-01-01',
        isActive: true,
        userId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      return {
        employeeId: ej.employeeId,
        jobId: ej.jobId,
        assignedAt: new Date().toISOString(),
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
        },
      }
    })
}

export async function removeEmployeeJobApi(
  employeeId: number,
  jobId: number
): Promise<EmployeeJobResponseDto> {
  try {
    const { data } = await apiClient.delete<EmployeeJobResponseDto>(
      `/employee-jobs/employees/${employeeId}/jobs/${jobId}`
    )
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const list = getStored<{ employeeId: number; jobId: number }[]>(
    EMPLOYEE_JOBS_STORAGE_KEY,
    INITIAL_EMPLOYEE_JOBS
  )
  setStored(
    EMPLOYEE_JOBS_STORAGE_KEY,
    list.filter((ej) => !(ej.employeeId === employeeId && ej.jobId === jobId))
  )
  return {
    employeeId,
    jobId,
    assignedAt: new Date().toISOString(),
  }
}

export async function replaceJobsForEmployeeApi(
  employeeId: number,
  jobIds: number[]
): Promise<void> {
  try {
    await apiClient.put(`/employee-jobs/employees/${employeeId}/jobs`, { jobIds })
  } catch {
    const list = getStored<{ employeeId: number; jobId: number }[]>(
      EMPLOYEE_JOBS_STORAGE_KEY,
      INITIAL_EMPLOYEE_JOBS
    )
    const remaining = list.filter((ej) => ej.employeeId !== employeeId)
    const newAssigned = jobIds.map((jid) => ({ employeeId, jobId: jid }))
    setStored(EMPLOYEE_JOBS_STORAGE_KEY, [...remaining, ...newAssigned])
  }
}

// ===================== USERS =====================

export async function fetchUsersApi(): Promise<UserAccount[]> {
  try {
    const { data } = await apiClient.get<UserAccount[]>('/users')
    if (Array.isArray(data) && data.length > 0) {
      setStored(USERS_STORAGE_KEY, data)
      return data
    }
  } catch {
    // Graceful fallback
  }

  // Load from local database (erjv_db_users_v5)
  try {
    const rawDb = localStorage.getItem('erjv_db_users_v5')
    if (rawDb) {
      const dbUsers: Array<{
        id: number
        email: string
        fullName?: string | null
        role: UserRole
        isActive?: boolean
        createdAt?: string
        updatedAt?: string
      }> = JSON.parse(rawDb)

      const mappedUsers: UserAccount[] = dbUsers.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName || null,
        role: u.role || 'STAFF',
        isActive: u.isActive !== undefined ? u.isActive : true,
        createdAt: u.createdAt || new Date().toISOString(),
        updatedAt: u.updatedAt || new Date().toISOString(),
      }))

      setStored(USERS_STORAGE_KEY, mappedUsers)
      return mappedUsers
    }
  } catch {
    // Ignore
  }

  const baseUsers = getStored<UserAccount[]>(USERS_STORAGE_KEY, INITIAL_USERS)
  return baseUsers
}

export async function updateUserRoleApi(id: number, role: UserRole): Promise<UserAccount> {
  try {
    const { data } = await apiClient.patch<UserAccount>(`/users/${id}/role`, { role })
    if (data) return data
  } catch {
    // Graceful fallback
  }

  // 1. Update in USERS_STORAGE_KEY (erjv_db_users_v5)
  let updatedUser: UserAccount | null = null

  try {
    const rawDb = localStorage.getItem('erjv_db_users_v5')
    if (rawDb) {
      const dbUsers = JSON.parse(rawDb)
      const idx = dbUsers.findIndex((u: { id: number }) => u.id === id)
      if (idx !== -1) {
        dbUsers[idx].role = role
        dbUsers[idx].updatedAt = new Date().toISOString()
        localStorage.setItem('erjv_db_users_v5', JSON.stringify(dbUsers))
        updatedUser = {
          id: dbUsers[idx].id,
          email: dbUsers[idx].email,
          fullName: dbUsers[idx].fullName || null,
          role: dbUsers[idx].role,
          isActive: dbUsers[idx].isActive !== undefined ? dbUsers[idx].isActive : true,
          createdAt: dbUsers[idx].createdAt || new Date().toISOString(),
          updatedAt: dbUsers[idx].updatedAt || new Date().toISOString(),
        }
      }
    }
  } catch {
    // Ignore
  }

  // 2. Also sync with registered users storage
  try {
    const rawReg = localStorage.getItem('erjv_registered_users')
    if (rawReg && updatedUser) {
      const regList: Array<{ email: string; role?: UserRole }> = JSON.parse(rawReg)
      const regIdx = regList.findIndex((r) => r.email.toLowerCase() === updatedUser?.email.toLowerCase())
      if (regIdx !== -1) {
        regList[regIdx].role = role
        localStorage.setItem('erjv_registered_users', JSON.stringify(regList))
      }
    }
  } catch {
    // Ignore
  }

  // 3. If current logged in user was modified, update their session
  try {
    const rawCurrent = localStorage.getItem('erjv_current_user')
    if (rawCurrent && updatedUser) {
      const currentUser = JSON.parse(rawCurrent)
      if (currentUser.email.toLowerCase() === updatedUser.email.toLowerCase() || currentUser.id === updatedUser.id) {
        currentUser.role = role
        localStorage.setItem('erjv_current_user', JSON.stringify(currentUser))
      }
    }
  } catch {
    // Ignore
  }

  if (updatedUser) {
    return updatedUser
  }

  throw new Error('User not found')
}
