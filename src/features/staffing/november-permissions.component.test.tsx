import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { EmployeeModal } from '@/components/staffing/EmployeeModal'
import { JobList } from '@/components/staffing/JobList'
import { createJobApi, updateJobDetailsApi } from './staffing.api'
import { jobNameError } from './job-validation'
import {
  useCreateEmployee,
  useCreateJob,
  useUpdateJobDetails,
  useDeactivateJob,
  useReactivateJob,
  useLinkEmployeeUser,
  useUnlinkEmployeeUser,
  useAssignEmployeeJob,
  useRemoveEmployeeJob,
  useReplaceEmployeeJobs,
} from './staffing.hooks'

const role = vi.hoisted(() => ({ isAdmin: false, isManager: true }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => role }))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
  role.isAdmin = false
  role.isManager = true
})
function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      {children}
    </QueryClientProvider>
  )
}
const employee = { firstName: 'Alex', lastName: 'Cruz', hireDate: '2026-11-04' }
it('lets Managers create unlinked employees but blocks non-null accounts and Staff creation', async () => {
  const request = vi.fn(async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: { id: 1, ...employee },
  }))
  apiClient.defaults.adapter = request
  const hook = renderHook(() => useCreateEmployee(), { wrapper })
  await act(async () => {
    await hook.result.current.mutateAsync(employee)
    await hook.result.current.mutateAsync({ ...employee, userId: null })
  })
  await expect(hook.result.current.mutateAsync({ ...employee, userId: 8 })).rejects.toThrow(
    /administrators/,
  )
  role.isManager = false
  hook.rerender()
  await expect(hook.result.current.mutateAsync(employee)).rejects.toThrow(/cannot create/)
  expect(request).toHaveBeenCalledTimes(2)
})
it('blocks all admin-only job, account and assignment writes before HTTP or optimistic updates', async () => {
  const request = vi.fn()
  apiClient.defaults.adapter = request
  const { result } = renderHook(
    () => ({
      create: useCreateJob(),
      update: useUpdateJobDetails(),
      deactivate: useDeactivateJob(),
      reactivate: useReactivateJob(),
      link: useLinkEmployeeUser(),
      unlink: useUnlinkEmployeeUser(),
      assign: useAssignEmployeeJob(),
      remove: useRemoveEmployeeJob(),
      replace: useReplaceEmployeeJobs(),
    }),
    { wrapper },
  )
  const operations = [
    () => result.current.create.mutateAsync({ name: 'Driver' }),
    () => result.current.update.mutateAsync({ id: 1, payload: { description: 'Changed' } }),
    () => result.current.deactivate.mutateAsync(1),
    () => result.current.reactivate.mutateAsync(1),
    () => result.current.link.mutateAsync({ id: 1, userId: 8 }),
    () => result.current.unlink.mutateAsync(1),
    () => result.current.assign.mutateAsync({ employeeId: 1, jobId: 2 }),
    () => result.current.remove.mutateAsync({ employeeId: 1, jobId: 2 }),
    () => result.current.replace.mutateAsync({ employeeId: 1, jobIds: [2] }),
  ]
  for (const operation of operations)
    await expect(operation()).rejects.toThrow(/Administrator permission/)
  expect(request).not.toHaveBeenCalled()
})
it('hides account lookup for Managers and submits employee creation without userId', async () => {
  const calls: { method?: string; url?: string; body: unknown }[] = []
  apiClient.defaults.adapter = async (config) => {
    calls.push({
      method: config.method,
      url: config.url,
      body: config.data ? JSON.parse(config.data) : null,
    })
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: config.method === 'get' ? { items: [], nextCursor: null } : { id: 1, ...employee },
    }
  }
  const close = vi.fn()
  render(<EmployeeModal open employee={null} onClose={close} />, { wrapper })
  expect(screen.queryByText('Link User Account')).toBeNull()
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/First Name/), 'Alex')
  await user.type(screen.getByLabelText(/Last Name/), 'Cruz')
  await user.click(screen.getByRole('button', { name: 'Register Employee' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(calls.some((call) => call.url === '/users')).toBe(false)
  expect(calls.find((call) => call.method === 'post')?.body).not.toHaveProperty('userId')
})
it('preserves job read access for Managers without edit, create or archive actions', async () => {
  apiClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data:
      config.url === '/jobs'
        ? {
            items: [{ id: 2, name: 'Driver', description: null, isActive: true }],
            nextCursor: null,
          }
        : { items: [], nextCursor: null },
  })
  render(<JobList />, { wrapper })
  expect(await screen.findByText('Driver')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Create Job Position' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Edit|Deactivate position/ })).toBeNull()
})
it('validates reserved whole names, allows compound titles, and preserves description-only updates', async () => {
  for (const name of [
    ' ADMIN ',
    'superadmin',
    'Administrator',
    'manager',
    'STAFF',
    '',
    'x'.repeat(101),
  ])
    expect(jobNameError(name)).toBeTruthy()
  expect(jobNameError(' Warehouse Manager ')).toBeNull()
  const bodies: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    bodies.push(JSON.parse(config.data))
    return { config, status: 200, statusText: 'OK', headers: {}, data: {} }
  }
  await expect(createJobApi({ name: ' Manager ' })).rejects.toThrow()
  await createJobApi({ name: ' Warehouse Manager ' })
  await updateJobDetailsApi(1, { description: 'Updated description' })
  expect(bodies).toEqual([{ name: 'Warehouse Manager' }, { description: 'Updated description' }])
})
