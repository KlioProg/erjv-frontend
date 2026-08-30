import type { UserRole } from '../auth/auth.types'

export type Employee = {
  id: number
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  address: string | null
  hireDate: string
  isActive: boolean
  userId: number | null
  createdAt: string
  updatedAt: string
}

export type CreateEmployeePayload = {
  firstName: string
  lastName: string
  phone?: string | null
  email?: string | null
  address?: string | null
  hireDate: string
  userId?: number | null
}

export type UpdateEmployeeProfilePayload = {
  firstName?: string
  lastName?: string
  phone?: string | null
  email?: string | null
  address?: string | null
  hireDate?: string
}

export type Job = {
  id: number
  name: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateJobPayload = {
  name: string
  description?: string | null
  isActive?: boolean
}

export type UpdateJobPayload = {
  name?: string
  description?: string | null
}

export type EmployeeJob = {
  employeeId: number
  jobId: number
  assignedAt: string
}

export type EmployeeJobResponseDto = EmployeeJob

export type EmployeeJobWithJob = EmployeeJob & {
  job: {
    id: number
    name: string
  }
}

export type EmployeeJobWithEmployee = EmployeeJob & {
  employee: {
    id: number
    firstName: string
    lastName: string
  }
}

export type UserAccount = {
  id: number
  email: string
  role: UserRole
  isActive: boolean
  createdAt: string
  updatedAt: string
}
