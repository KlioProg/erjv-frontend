import { createElement } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { EmployeePositionSelector } from './EmployeePositionSelector'

vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isAdmin: true }) }))
const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function setup(initial: number[]) {
  const jobs = [
    { id: 1, name: 'Driver', isActive: true },
    { id: 2, name: 'Clerk', isActive: true },
  ]
  const assignedAt = '2026-01-01T00:00:00.000Z'
  let assignments = initial.map((jobId) => ({
    employeeId: 7,
    jobId,
    assignedAt,
    job: jobs.find((job) => job.id === jobId)!,
  }))
  const writes: { method?: string; body: unknown; url?: string }[] = []
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'put') {
      const body = JSON.parse(config.data)
      writes.push({ method: config.method, body, url: config.url })
      assignments = body.jobIds.map(
        (jobId: number) =>
          assignments.find((row) => row.jobId === jobId) ?? {
            employeeId: 7,
            jobId,
            assignedAt: '2026-02-01T00:00:00.000Z',
            job: jobs.find((job) => job.id === jobId)!,
          },
      )
    }
    if (config.method === 'delete') {
      const jobId = Number(config.url?.split('/').at(-1))
      assignments = assignments.filter((row) => row.jobId !== jobId)
      writes.push({ method: config.method, body: undefined, url: config.url })
    }
    return {
      config,
      status: 200,
      statusText: '',
      headers: {},
      data: config.url === '/jobs' ? { items: jobs, nextCursor: null } : assignments,
    }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const view = render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(EmployeePositionSelector, {
        employeeId: 7,
        employeeName: 'Alex Cruz',
        canEdit: true,
      }),
    ),
  )
  return { writes, client, view }
}

it('adds and removes jobs with nonempty replacement sets, retaining the other selected job', async () => {
  const { writes, client, view } = setup([1])
  const user = userEvent.setup()
  const trigger = await screen.findByRole('button', { name: /1 assigned/ })
  await waitFor(() => expect(trigger.hasAttribute('disabled')).toBe(false))
  await user.click(trigger)
  await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Clerk' }))
  await waitFor(() => {
    expect(trigger.getAttribute('aria-label')).toContain('2 assigned')
    expect(trigger.hasAttribute('disabled')).toBe(false)
  })
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Clerk' }))
  await waitFor(() => {
    expect(trigger.getAttribute('aria-label')).toContain('1 assigned')
    expect(trigger.hasAttribute('disabled')).toBe(false)
  })
  expect(writes.map((write) => write.body)).toEqual([{ jobIds: [1, 2] }, { jobIds: [1] }])
  expect(
    client
      .getQueryData<{ jobId: number; assignedAt: string }[]>(['staffing', 'employee-jobs', 7])
      ?.find((row) => row.jobId === 1)?.assignedAt,
  ).toBe('2026-01-01T00:00:00.000Z')
  view.unmount()
  client.clear()
})

it('removes the final assignment through its individual delete endpoint without an empty replacement', async () => {
  const { writes, client, view } = setup([1])
  const user = userEvent.setup()
  const trigger = await screen.findByRole('button', { name: /1 assigned/ })
  await waitFor(() => expect(trigger.hasAttribute('disabled')).toBe(false))
  await user.click(trigger)
  await user.click(await screen.findByRole('menuitemcheckbox', { name: 'Driver' }))
  await waitFor(() => {
    expect(trigger.getAttribute('aria-label')).toContain('0 assigned')
    expect(trigger.hasAttribute('disabled')).toBe(false)
  })
  expect(writes).toEqual([
    { method: 'delete', url: '/employee-jobs/employees/7/jobs/1', body: undefined },
  ])
  view.unmount()
  client.clear()
})
