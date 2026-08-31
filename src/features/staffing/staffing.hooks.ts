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

// ===================== EMPLOYEE HOOKS =====================

export function useEmployees() {
  return useQuery({
    queryKey: staffingKeys.employees(),
    queryFn: fetchEmployeesApi,
  })
}

export function useDeactivatedEmployees() {
  return useQuery<Employee[]>({
    queryKey: ['staffing', 'deactivated-employees'],
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateEmployeePayload) => createEmployeeApi(payload),
    onSuccess: (newEmp) => {
      queryClient.setQueryData<Employee[]>(['staffing', 'deactivated-employees'], (old = []) =>
        old.filter((e) => e.id !== newEmp.id && e.email !== newEmp.email)
      )
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
      return res
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData<Employee[]>(['staffing', 'deactivated-employees'], (old = []) => [
          ...old.filter((e) => e.id !== data.id),
          { ...data, isActive: false },
        ])
      }
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
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
      const res = await updateEmployeeProfileApi(emp.id, {
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email || null,
        phone: emp.phone || null,
        address: emp.address || null,
        hireDate: emp.hireDate || new Date().toISOString(),
      })
      return res
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Employee[]>(['staffing', 'deactivated-employees'], (old = []) =>
        old.filter((e) => e.id !== data.id)
      )
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
      toast.success(`Employee "${data.firstName} ${data.lastName}" profile restored in staff directory`)
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

export function useDeactivatedJobs() {
  return useQuery<Job[]>({
    queryKey: ['staffing', 'deactivated-jobs'],
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
  })
}

export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateJobPayload) => createJobApi(payload),
    onSuccess: (newJob) => {
      queryClient.setQueryData<Job[]>(['staffing', 'deactivated-jobs'], (old = []) =>
        old.filter((j) => j.id !== newJob.id && j.name.toLowerCase() !== newJob.name.toLowerCase())
      )
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
      return await deactivateJobApi(id)
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData<Job[]>(['staffing', 'deactivated-jobs'], (old = []) => [
          ...old.filter((j) => j.id !== data.id),
          { ...data, isActive: false },
        ])
      }
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
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
      return await reactivateJobApi(id)
    },
    onSuccess: (data) => {
      queryClient.setQueryData<Job[]>(['staffing', 'deactivated-jobs'], (old = []) =>
        old.filter((j) => j.id !== data.id)
      )
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
      void queryClient.invalidateQueries({ queryKey: staffingKeys.all })
    },
  })
}
