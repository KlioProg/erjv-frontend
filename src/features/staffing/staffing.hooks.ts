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
  deactivateUserApi,
  fetchEmployeesApi,
  fetchEmployeesForJobApi,
  fetchJobsApi,
  fetchJobsForEmployeeApi,
  fetchUsersApi,
  linkEmployeeUserApi,
  reactivateEmployeeApi,
  reactivateJobApi,
  reactivateUserApi,
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
  UserAccount,
} from './staffing.types'

export const staffingKeys = {
  all: ['staffing'] as const,
  employees: (includeInactive = 'false') =>
    [...staffingKeys.all, 'employees', includeInactive] as const,
  employeeDetail: (id: number) => [...staffingKeys.employees(), id] as const,
  jobs: (includeInactive = 'false') => [...staffingKeys.all, 'jobs', includeInactive] as const,
  jobDetail: (id: number) => [...staffingKeys.jobs(), id] as const,
  employeeJobs: (employeeId: number) => [...staffingKeys.all, 'employee-jobs', employeeId] as const,
  jobEmployees: (jobId: number) => [...staffingKeys.all, 'job-employees', jobId] as const,
  users: (includeInactive = 'false') => [...staffingKeys.all, 'users', includeInactive] as const,
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
    mutationFn: ({ id, userId }: { id: number; userId: number }) => linkEmployeeUserApi(id, userId),
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

export function useDeactivateEmployee(options?: { onViewArchive?: () => void }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (empOrId: Employee | number) => {
      const id = typeof empOrId === 'number' ? empOrId : empOrId.id
      const res = await deactivateEmployeeApi(id)
      return { res, inputEmployee: typeof empOrId === 'object' ? empOrId : null, id }
    },
    onMutate: async (empOrId) => {
      await queryClient.cancelQueries({ queryKey: staffingKeys.employees('true') })
      const previousEmployees = queryClient.getQueryData<Employee[]>(staffingKeys.employees('true'))
      const targetId = typeof empOrId === 'number' ? empOrId : empOrId.id

      queryClient.setQueryData<Employee[]>(staffingKeys.employees('true'), (old) => {
        if (!old) return []
        return old.map((e) => (e.id === targetId ? { ...e, isActive: false } : e))
      })

      return { previousEmployees }
    },
    onError: (err, _, context) => {
      if (context?.previousEmployees) {
        queryClient.setQueryData(staffingKeys.employees('true'), context.previousEmployees)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
    onSuccess: ({ res, inputEmployee }) => {
      const name = res
        ? `${res.firstName} ${res.lastName}`
        : inputEmployee
          ? `${inputEmployee.firstName} ${inputEmployee.lastName}`
          : 'Employee'
      toast.success(`Employee profile "${name}" archived`, {
        description: 'Profile moved to the Archived Staff tab.',
        action: options?.onViewArchive
          ? {
              label: 'View in Archive',
              onClick: options.onViewArchive,
            }
          : undefined,
      })
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
    onMutate: async (empOrId) => {
      await queryClient.cancelQueries({ queryKey: staffingKeys.employees('true') })
      const previousEmployees = queryClient.getQueryData<Employee[]>(staffingKeys.employees('true'))
      const targetId = typeof empOrId === 'number' ? empOrId : empOrId.id

      queryClient.setQueryData<Employee[]>(staffingKeys.employees('true'), (old) => {
        if (!old) return []
        return old.map((e) => (e.id === targetId ? { ...e, isActive: true } : e))
      })

      return { previousEmployees }
    },
    onError: (err, _, context) => {
      if (context?.previousEmployees) {
        queryClient.setQueryData(staffingKeys.employees('true'), context.previousEmployees)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
    onSuccess: ({ res, inputEmployee }) => {
      const name = res
        ? `${res.firstName} ${res.lastName}`
        : inputEmployee
          ? `${inputEmployee.firstName} ${inputEmployee.lastName}`
          : 'Employee'
      toast.success(`Employee profile "${name}" reactivated`)
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

export function useDeactivateJob(options?: { onViewArchive?: () => void }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (jobOrId: Job | number) => {
      const id = typeof jobOrId === 'number' ? jobOrId : jobOrId.id
      const res = await deactivateJobApi(id)
      return { res, inputJob: typeof jobOrId === 'object' ? jobOrId : null, id }
    },
    onMutate: async (jobOrId) => {
      await queryClient.cancelQueries({ queryKey: staffingKeys.jobs('true') })
      const previousJobs = queryClient.getQueryData<Job[]>(staffingKeys.jobs('true'))
      const targetId = typeof jobOrId === 'number' ? jobOrId : jobOrId.id

      queryClient.setQueryData<Job[]>(staffingKeys.jobs('true'), (old) => {
        if (!old) return []
        return old.map((j) => (j.id === targetId ? { ...j, isActive: false } : j))
      })

      return { previousJobs }
    },
    onError: (err, _, context) => {
      if (context?.previousJobs) {
        queryClient.setQueryData(staffingKeys.jobs('true'), context.previousJobs)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
    onSuccess: ({ res, inputJob }) => {
      const name = res?.name || inputJob?.name || 'Role'
      toast.success(`Job position "${name}" archived`, {
        description: 'Position moved to the Archived Positions tab.',
        action: options?.onViewArchive
          ? {
              label: 'View in Archive',
              onClick: options.onViewArchive,
            }
          : undefined,
      })
    },
  })
}

export function useReactivateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (idOrJob: number | Job) => {
      const id = typeof idOrJob === 'number' ? idOrJob : idOrJob.id
      const res = await reactivateJobApi(id)
      return { res, id }
    },
    onMutate: async (idOrJob) => {
      await queryClient.cancelQueries({ queryKey: staffingKeys.jobs('true') })
      const previousJobs = queryClient.getQueryData<Job[]>(staffingKeys.jobs('true'))
      const targetId = typeof idOrJob === 'number' ? idOrJob : idOrJob.id

      queryClient.setQueryData<Job[]>(staffingKeys.jobs('true'), (old) => {
        if (!old) return []
        return old.map((j) => (j.id === targetId ? { ...j, isActive: true } : j))
      })

      return { previousJobs }
    },
    onError: (err, _, context) => {
      if (context?.previousJobs) {
        queryClient.setQueryData(staffingKeys.jobs('true'), context.previousJobs)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
    onSuccess: ({ res }) => {
      toast.success(
        `Job position "${res?.name || 'Role'}" reactivated and restored to active roles`,
      )
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

export const useEmployeesForJob = useJobEmployees

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
    mutationFn: ({ id, role }: { id: number; role: UserRole }) => updateUserRoleApi(id, role),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
  })
}

export function useDeactivateUser(options?: { onViewArchive?: () => void }) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userOrId: UserAccount | number) => {
      const id = typeof userOrId === 'number' ? userOrId : userOrId.id
      const res = await deactivateUserApi(id)

      return {
        res,
        inputUser: typeof userOrId === 'object' ? userOrId : null,
        id,
      }
    },
    onMutate: async (userOrId) => {
      await queryClient.cancelQueries({ queryKey: staffingKeys.users('true') })
      const previousUsers = queryClient.getQueryData<UserAccount[]>(staffingKeys.users('true'))

      const targetId = typeof userOrId === 'number' ? userOrId : userOrId.id

      queryClient.setQueryData<UserAccount[]>(staffingKeys.users('true'), (old) => {
        if (!old) return []
        return old.map((u) => (u.id === targetId ? { ...u, isActive: false } : u))
      })

      return { previousUsers }
    },
    onError: (err, _, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(staffingKeys.users('true'), context.previousUsers)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: staffingKeys.all,
      })
    },
    onSuccess: ({ res, inputUser }) => {
      const name =
        res?.fullName ??
        inputUser?.fullName ??
        inputUser?.email ??
        'User'

      toast.success(`User account "${name}" archived`, {
        description: 'Account moved to the Archived Accounts tab.',
        action: options?.onViewArchive
          ? {
              label: 'View in Archive',
              onClick: options.onViewArchive,
            }
          : undefined,
      })
    },
  })
}

export function useReactivateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userOrId: UserAccount | number) => {
      const id = typeof userOrId === 'number' ? userOrId : userOrId.id
      const res = await reactivateUserApi(id)

      return {
        res,
        inputUser: typeof userOrId === 'object' ? userOrId : null,
        id,
      }
    },
    onMutate: async (userOrId) => {
      await queryClient.cancelQueries({ queryKey: staffingKeys.users('true') })
      const previousUsers = queryClient.getQueryData<UserAccount[]>(staffingKeys.users('true'))

      const targetId = typeof userOrId === 'number' ? userOrId : userOrId.id

      queryClient.setQueryData<UserAccount[]>(staffingKeys.users('true'), (old) => {
        if (!old) return []
        return old.map((u) => (u.id === targetId ? { ...u, isActive: true } : u))
      })

      return { previousUsers }
    },
    onError: (err, _, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(staffingKeys.users('true'), context.previousUsers)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({
        queryKey: staffingKeys.all,
      })
    },
    onSuccess: ({ res, inputUser }) => {
      const name =
        res?.fullName ??
        inputUser?.fullName ??
        inputUser?.email ??
        'User'

      toast.success(`User "${name}" reactivated`)
    },
  })
}

