import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
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
    },
  })
}

export function useDeactivateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deactivateEmployeeApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.employees() })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.jobs() })
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
    },
  })
}

export function useDeactivateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deactivateJobApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.jobs() })
    },
  })
}

export function useReactivateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => reactivateJobApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: staffingKeys.jobs() })
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
