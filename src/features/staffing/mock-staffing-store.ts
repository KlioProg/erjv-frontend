import type { UserRole } from '../auth/auth.types'
import type {
  CreateEmployeePayload,
  CreateJobPayload,
  Employee,
  EmployeeJobWithEmployee,
  EmployeeJobWithJob,
  Job,
  UpdateEmployeeProfilePayload,
  UpdateJobPayload,
  UserAccount,
} from './staffing.types'

const DEFAULT_JOBS: Job[] = [
  {
    id: 1,
    name: 'Store Manager',
    description: 'Oversees daily store operations, staff shifts, and POS transactions.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Head Cashier',
    description: 'Operates POS registers, processes customer checkouts, and handles daily cash audits.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Inventory & Stock Clerk',
    description: 'Manages warehouse receipt, stock adjustments, and SKU shelf counts.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: 'Delivery Driver',
    description: 'Coordinates customer order dispatches and vehicle fleet deliveries.',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    id: 1,
    firstName: 'Karl Lawrence',
    lastName: 'Magno',
    phone: '09605150024',
    email: 'kMagno@gmail.com',
    address: 'Davao City, Philippines',
    hireDate: '2026-06-16T00:00:00.000Z',
    isActive: true,
    userId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    firstName: 'Ada',
    lastName: 'Santos',
    phone: '09171234567',
    email: 'ada@example.com',
    address: 'Davao City, Philippines',
    hireDate: '2026-01-15T00:00:00.000Z',
    isActive: true,
    userId: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    firstName: 'Marco',
    lastName: 'Reyes',
    phone: '09228889999',
    email: 'marco@example.com',
    address: 'Panabo City, Philippines',
    hireDate: '2026-03-01T00:00:00.000Z',
    isActive: true,
    userId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

type Assignment = {
  employeeId: number
  jobId: number
  assignedAt: string
}

const DEFAULT_ASSIGNMENTS: Assignment[] = [
  { employeeId: 1, jobId: 1, assignedAt: new Date().toISOString() },
  { employeeId: 2, jobId: 2, assignedAt: new Date().toISOString() },
  { employeeId: 3, jobId: 4, assignedAt: new Date().toISOString() },
]

const DEFAULT_USERS: UserAccount[] = [
  {
    id: 1,
    email: 'owner@example.com',
    role: 'OWNER',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    email: 'admin@erjvpos.com',
    role: 'ADMIN',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    email: 'staff@erjvpos.com',
    role: 'STAFF',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function getStorage<T>(key: string, defaultVal: T): T {
  const item = localStorage.getItem(`erjv_mock_${key}`)
  if (!item) {
    localStorage.setItem(`erjv_mock_${key}`, JSON.stringify(defaultVal))
    return defaultVal
  }
  return JSON.parse(item)
}

function setStorage<T>(key: string, val: T): void {
  localStorage.setItem(`erjv_mock_${key}`, JSON.stringify(val))
}

export const mockStaffingStore = {
  getEmployees: (): Employee[] => getStorage('employees', DEFAULT_EMPLOYEES).filter((e) => e.isActive),
  
  createEmployee: (payload: CreateEmployeePayload): Employee => {
    const list = getStorage('employees', DEFAULT_EMPLOYEES)
    const newEmp: Employee = {
      id: list.length > 0 ? Math.max(...list.map((e) => e.id)) + 1 : 1,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone || null,
      email: payload.email || null,
      address: payload.address || null,
      hireDate: payload.hireDate,
      isActive: true,
      userId: payload.userId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setStorage('employees', [...list, newEmp])
    return newEmp
  },

  updateEmployee: (id: number, payload: UpdateEmployeeProfilePayload): Employee => {
    const list = getStorage('employees', DEFAULT_EMPLOYEES)
    const index = list.findIndex((e) => e.id === id)
    if (index === -1) throw new Error('Employee not found')
    const updated = {
      ...list[index],
      ...payload,
      updatedAt: new Date().toISOString(),
    }
    list[index] = updated
    setStorage('employees', list)
    return updated
  },

  deactivateEmployee: (id: number): Employee => {
    const list = getStorage('employees', DEFAULT_EMPLOYEES)
    const index = list.findIndex((e) => e.id === id)
    if (index === -1) throw new Error('Employee not found')
    list[index].isActive = false
    list[index].updatedAt = new Date().toISOString()
    setStorage('employees', list)
    return list[index]
  },

  getJobs: (): Job[] => getStorage('jobs', DEFAULT_JOBS),

  createJob: (payload: CreateJobPayload): Job => {
    const list = getStorage('jobs', DEFAULT_JOBS)
    const newJob: Job = {
      id: list.length > 0 ? Math.max(...list.map((j) => j.id)) + 1 : 1,
      name: payload.name,
      description: payload.description || null,
      isActive: payload.isActive !== false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    setStorage('jobs', [...list, newJob])
    return newJob
  },

  updateJob: (id: number, payload: UpdateJobPayload): Job => {
    const list = getStorage('jobs', DEFAULT_JOBS)
    const index = list.findIndex((j) => j.id === id)
    if (index === -1) throw new Error('Job not found')
    const updated = {
      ...list[index],
      ...payload,
      updatedAt: new Date().toISOString(),
    }
    list[index] = updated
    setStorage('jobs', list)
    return updated
  },

  deactivateJob: (id: number): Job => {
    const list = getStorage('jobs', DEFAULT_JOBS)
    const index = list.findIndex((j) => j.id === id)
    if (index === -1) throw new Error('Job not found')
    list[index].isActive = false
    list[index].updatedAt = new Date().toISOString()
    setStorage('jobs', list)
    return list[index]
  },

  reactivateJob: (id: number): Job => {
    const list = getStorage('jobs', DEFAULT_JOBS)
    const index = list.findIndex((j) => j.id === id)
    if (index === -1) throw new Error('Job not found')
    list[index].isActive = true
    list[index].updatedAt = new Date().toISOString()
    setStorage('jobs', list)
    return list[index]
  },

  getJobsForEmployee: (empId: number): EmployeeJobWithJob[] => {
    const assignments = getStorage('assignments', DEFAULT_ASSIGNMENTS)
    const jobs = getStorage('jobs', DEFAULT_JOBS)
    return assignments
      .filter((a) => a.employeeId === empId)
      .map((a) => {
        const j = jobs.find((job) => job.id === a.jobId) || { id: a.jobId, name: 'Unknown Position' }
        return {
          employeeId: a.employeeId,
          jobId: a.jobId,
          assignedAt: a.assignedAt,
          job: { id: j.id, name: j.name },
        }
      })
  },

  getEmployeesForJob: (jobId: number): EmployeeJobWithEmployee[] => {
    const assignments = getStorage('assignments', DEFAULT_ASSIGNMENTS)
    const employees = getStorage('employees', DEFAULT_EMPLOYEES)
    return assignments
      .filter((a) => a.jobId === jobId)
      .map((a) => {
        const emp = employees.find((e) => e.id === a.employeeId) || {
          id: a.employeeId,
          firstName: 'Staff',
          lastName: `#${a.employeeId}`,
        }
        return {
          employeeId: a.employeeId,
          jobId: a.jobId,
          assignedAt: a.assignedAt,
          employee: { id: emp.id, firstName: emp.firstName, lastName: emp.lastName },
        }
      })
  },

  assignJob: (employeeId: number, jobId: number) => {
    const assignments = getStorage('assignments', DEFAULT_ASSIGNMENTS)
    if (!assignments.some((a) => a.employeeId === employeeId && a.jobId === jobId)) {
      setStorage('assignments', [...assignments, { employeeId, jobId, assignedAt: new Date().toISOString() }])
    }
  },

  removeJob: (employeeId: number, jobId: number) => {
    const assignments = getStorage('assignments', DEFAULT_ASSIGNMENTS)
    setStorage(
      'assignments',
      assignments.filter((a) => !(a.employeeId === employeeId && a.jobId === jobId))
    )
  },

  replaceJobs: (employeeId: number, jobIds: number[]) => {
    const assignments = getStorage('assignments', DEFAULT_ASSIGNMENTS)
    const otherAssignments = assignments.filter((a) => a.employeeId !== employeeId)
    const newAssignments = jobIds.map((jobId) => ({
      employeeId,
      jobId,
      assignedAt: new Date().toISOString(),
    }))
    setStorage('assignments', [...otherAssignments, ...newAssignments])
  },

  getUsers: (): UserAccount[] => getStorage('users', DEFAULT_USERS),

  updateUserRole: (id: number, role: UserRole): UserAccount => {
    const list = getStorage('users', DEFAULT_USERS)
    const index = list.findIndex((u) => u.id === id)
    if (index === -1) throw new Error('User not found')
    list[index].role = role
    list[index].updatedAt = new Date().toISOString()
    setStorage('users', list)
    return list[index]
  },
}
