import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage, type FetchParams } from '@/lib/api-client'
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
  reactivateEmployeeApi,
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
  employees: (includeInactive = 'false') =>
    [...staffingKeys.all, 'employees', includeInactive] as const,
  employeeDetail: (id: number) => [...staffingKeys.employees(), id] as const,
  jobs: (includeInactive = 'false') =>
    [...staffingKeys.all, 'jobs', includeInactive] as const,
  jobDetail: (id: number) => [...staffingKeys.jobs(), id] as const,
  employeeJobs: (employeeId: number) => [...staffingKeys.all, 'employee-jobs', employeeId] as const,
  jobEmployees: (jobId: number) => [...staffingKeys.all, 'job-employees', jobId] as const,
  users: (includeInactive = 'false') =>
    [...staffingKeys.all, 'users', includeInactive] as const,
}

// ===================== EMPLOYEE HOOKS =====================

export function useEmployees(params?: FetchParams) {
  return useQuery({
    queryKey: staffingKeys.employees(params?.includeInactive ?? 'false'),
    queryFn: () => fetchEmployeesApi(params),
  })
}

export function useAllEmployees() {
  return useEmployees({ includeInactive: 'true' })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => createEmployeeApi(payload),
    onSuccess: (newEmp) => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
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
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
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
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
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
      return { res, inputEmployee: typeof empOrId === 'object' ? empOrId : null, id }
    },
    onSuccess: ({ res, inputEmployee }) => {
      const name = res ? `${res.firstName} ${res.lastName}` : inputEmployee ? `${inputEmployee.firstName} ${inputEmployee.lastName}` : 'Employee'
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
      toast.success(`Employee profile "${name}" deactivated and moved to archive`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useReactivateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (empOrId: Employee | number) => {
      const id = typeof empOrId === 'number' ? empOrId : empOrId.id
      const res = await reactivateEmployeeApi(id)
      return { res, inputEmployee: typeof empOrId === 'object' ? empOrId : null, id }
    },
    onSuccess: ({ res, inputEmployee }) => {
      const name = res ? `${res.firstName} ${res.lastName}` : inputEmployee ? `${inputEmployee.firstName} ${inputEmployee.lastName}` : 'Employee'
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
      toast.success(`Employee profile "${name}" reactivated`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

// ===================== JOB HOOKS =====================

export function useJobs(params?: FetchParams) {
  return useQuery({
    queryKey: staffingKeys.jobs(params?.includeInactive ?? 'false'),
    queryFn: () => fetchJobsApi(params),
  })
}

export function useAllJobs() {
  return useJobs({ includeInactive: 'true' })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateJobPayload) => createJobApi(payload),
    onSuccess: (newJob) => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
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
      return { res, inputJob: typeof jobOrId === 'object' ? jobOrId : null, id }
    },
    onSuccess: ({ res, inputJob }) => {
      const name = res?.name || inputJob?.name || 'Role'
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
      toast.success(`Job position "${name}" deactivated and moved to archive`)
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
      return await reactivateJobApi(id)
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
  })
}

export function useRemoveEmployeeJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, jobId }: { employeeId: number; jobId: number }) =>
      removeEmployeeJobApi(employeeId, jobId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
  })
}

export function useReplaceEmployeeJobs() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ employeeId, jobIds }: { employeeId: number; jobIds: number[] }) =>
      replaceJobsForEmployeeApi(employeeId, jobIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
  })
}

// ===================== USER HOOKS =====================

export function useUsers(params?: FetchParams) {
  return useQuery({
    queryKey: staffingKeys.users(params?.includeInactive ?? 'false'),
    queryFn: () => fetchUsersApi(params),
  })
}

export function useAllUsers() {
  return useUsers({ includeInactive: 'true' })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, role }: { id: number; role: UserRole }) =>
      updateUserRoleApi(id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
  })
}
