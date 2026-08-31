import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/api-client'
import type { UserRole } from '../auth/auth.types'
import {
  assignEmployeeJobApi,
  createEmployeeApi,
  createJobApi,
  deactivateEmployeeApi,
  deactivateJobApi,
  fetchEmployeesApi,
  fetchEmployeesForJobApi,
  fetchJobsApi,
  fetchJobsForEmployeeApi,
  fetchUsersApi,
  linkEmployeeUserApi,
  reactivateJobApi,
  removeEmployeeJobApi,
  replaceJobsForEmployeeApi,
  unlinkEmployeeUserApi,
  updateEmployeeProfileApi,
  updateJobDetailsApi,
  updateUserRoleApi,
} from './staffing.api'
import type {
  CreateEmployeePayload,
  CreateJobPayload,
  Employee,
  Job,
  UpdateEmployeeProfilePayload,
  UpdateJobPayload,
} from './staffing.types'

export const staffingKeys = {
  all: ['staffing'] as const,
  employees: () => [...staffingKeys.all, 'employees'] as const,
  employeeDetail: (id: number) => [...staffingKeys.employees(), id] as const,
  jobs: () => [...staffingKeys.all, 'jobs'] as const,
  jobDetail: (id: number) => [...staffingKeys.jobs(), id] as const,
  employeeJobs: (employeeId: number) =>
    [...staffingKeys.all, 'employee-jobs', employeeId] as const,
  jobEmployees: (jobId: number) =>
    [...staffingKeys.all, 'job-employees', jobId] as const,
  users: () => [...staffingKeys.all, 'users'] as const,
}

const ARCHIVED_EMPLOYEES_KEY = 'erjv_archived_employees'
const ARCHIVED_JOBS_KEY = 'erjv_archived_jobs'

// ===================== ARCHIVE STORAGE HELPERS =====================

export function getArchivedEmployees(): Employee[] {
  try {
    const raw = localStorage.getItem(ARCHIVED_EMPLOYEES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveArchivedEmployee(emp: Employee) {
  const current = getArchivedEmployees().filter(
    (e) => e.id !== emp.id && (emp.email ? e.email?.toLowerCase().trim() !== emp.email.toLowerCase().trim() : true)
  )
  current.push({ ...emp, isActive: false })
  localStorage.setItem(ARCHIVED_EMPLOYEES_KEY, JSON.stringify(current))
}

export function removeArchivedEmployee(idOrEmail: number | string) {
  const current = getArchivedEmployees().filter(
    (e) => e.id !== idOrEmail && e.email?.toLowerCase().trim() !== String(idOrEmail).toLowerCase().trim()
  )
  localStorage.setItem(ARCHIVED_EMPLOYEES_KEY, JSON.stringify(current))
}

export function getArchivedJobs(): Job[] {
  try {
    const raw = localStorage.getItem(ARCHIVED_JOBS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveArchivedJob(job: Job) {
  const current = getArchivedJobs().filter(
    (j) => j.id !== job.id && j.name.toUpperCase().trim() !== job.name.toUpperCase().trim()
  )
  current.push({ ...job, isActive: false })
  localStorage.setItem(ARCHIVED_JOBS_KEY, JSON.stringify(current))
}

export function removeArchivedJob(idOrName: number | string) {
  const current = getArchivedJobs().filter(
    (j) => j.id !== idOrName && j.name.toUpperCase().trim() !== String(idOrName).toUpperCase().trim()
  )
  localStorage.setItem(ARCHIVED_JOBS_KEY, JSON.stringify(current))
}

// ===================== EMPLOYEE HOOKS =====================

export function useEmployees() {
  return useQuery({
    queryKey: staffingKeys.employees(),
    queryFn: fetchEmployeesApi,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => createEmployeeApi(payload),
    onSuccess: (newEmp) => {
      if (newEmp.email) removeArchivedEmployee(newEmp.email)
      removeArchivedEmployee(newEmp.id)
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
      toast.success(`Employee "${newEmp.firstName} ${newEmp.lastName}" registered successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateEmployeeProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateEmployeeProfilePayload }) =>
      updateEmployeeProfileApi(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
      queryClient.invalidateQueries({ queryKey: staffingKeys.employeeDetail(variables.id) })
      toast.success('Employee profile updated')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useLinkEmployeeUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, userId }: { id: number; userId: number }) =>
      linkEmployeeUserApi(id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
      queryClient.invalidateQueries({ queryKey: staffingKeys.users() })
      toast.success('Employee successfully linked to user account')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUnlinkEmployeeUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => unlinkEmployeeUserApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
      queryClient.invalidateQueries({ queryKey: staffingKeys.users() })
      toast.success('Employee unlinked from user account')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (empOrId: Employee | number) => {
      const id = typeof empOrId === 'number' ? empOrId : empOrId.id
      const res = await deactivateEmployeeApi(id)
      if (typeof empOrId !== 'number') {
        saveArchivedEmployee(empOrId)
      } else if (res) {
        saveArchivedEmployee(res)
      }
      return res
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
      toast.success(`Employee profile "${data?.firstName || ''} ${data?.lastName || ''}" deactivated and moved to archive`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useReactivateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (emp: Employee) => {
      removeArchivedEmployee(emp.id)
      if (emp.email) removeArchivedEmployee(emp.email)
      // If employee can be re-registered or restored:
      const res = await createEmployeeApi({
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email || undefined,
        phone: emp.phone || undefined,
        address: emp.address || undefined,
        hireDate: emp.hireDate || new Date().toISOString(),
        userId: emp.userId || undefined,
      })
      return res
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
      toast.success(`Employee "${data.firstName} ${data.lastName}" reactivated and restored to staff directory`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

// ===================== JOB HOOKS =====================

export function useJobs() {
  return useQuery({
    queryKey: staffingKeys.jobs(),
    queryFn: fetchJobsApi,
  })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateJobPayload) => createJobApi(payload),
    onSuccess: (newJob) => {
      removeArchivedJob(newJob.name)
      queryClient.invalidateQueries({ queryKey: staffingKeys.jobs() })
      toast.success(`Job position "${newJob.name}" created successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateJobDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateJobPayload }) =>
      updateJobDetailsApi(id, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.jobs() })
      queryClient.invalidateQueries({ queryKey: staffingKeys.jobDetail(variables.id) })
      toast.success('Job position details updated')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeactivateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (jobOrId: Job | number) => {
      const id = typeof jobOrId === 'number' ? jobOrId : jobOrId.id
      const res = await deactivateJobApi(id)
      if (typeof jobOrId !== 'number') {
        saveArchivedJob(jobOrId)
      } else if (res) {
        saveArchivedJob(res)
      }
      return res
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.jobs() })
      toast.success(`Job position "${data?.name || 'Role'}" deactivated and moved to archive`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useReactivateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await reactivateJobApi(id)
      removeArchivedJob(id)
      if (res?.name) removeArchivedJob(res.name)
      return res
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.jobs() })
      toast.success(`Job position "${data?.name || 'Role'}" reactivated and restored to active roles`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

// ===================== EMPLOYEE-JOB ASSIGNMENT HOOKS =====================

export function useEmployeeJobs(employeeId: number) {
  return useQuery({
    queryKey: staffingKeys.employeeJobs(employeeId),
    queryFn: () => fetchJobsForEmployeeApi(employeeId),
    enabled: employeeId > 0,
  })
}

export function useJobEmployees(jobId: number) {
  return useQuery({
    queryKey: staffingKeys.jobEmployees(jobId),
    queryFn: () => fetchEmployeesForJobApi(jobId),
    enabled: jobId > 0,
  })
}

export function useAssignEmployeeJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, jobId }: { employeeId: number; jobId: number }) =>
      assignEmployeeJobApi(employeeId, jobId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: staffingKeys.employeeJobs(variables.employeeId),
      })
      queryClient.invalidateQueries({
        queryKey: staffingKeys.jobEmployees(variables.jobId),
      })
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
    },
  })
}

export function useRemoveEmployeeJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, jobId }: { employeeId: number; jobId: number }) =>
      removeEmployeeJobApi(employeeId, jobId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: staffingKeys.employeeJobs(variables.employeeId),
      })
      queryClient.invalidateQueries({
        queryKey: staffingKeys.jobEmployees(variables.jobId),
      })
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
    },
  })
}

export function useReplaceEmployeeJobs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, jobIds }: { employeeId: number; jobIds: number[] }) =>
      replaceJobsForEmployeeApi(employeeId, jobIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: staffingKeys.employeeJobs(variables.employeeId),
      })
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
      queryClient.invalidateQueries({ queryKey: staffingKeys.jobs() })
    },
  })
}

// ===================== USER HOOKS =====================

export function useUsers() {
  return useQuery({
    queryKey: staffingKeys.users(),
    queryFn: fetchUsersApi,
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: UserRole }) =>
      updateUserRoleApi(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.users() })
    },
  })
}
