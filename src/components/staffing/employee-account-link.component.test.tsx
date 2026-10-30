import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { EmployeeModal } from './EmployeeModal'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
it.each([null, 7])(
  'edits the user-account link for an existing employee (current %s)',
  async (userId) => {
    const employee = {
      id: 3,
      firstName: 'Alex',
      lastName: 'Cruz',
      email: null,
      phone: null,
      address: null,
      hireDate: '2026-10-01',
      userId,
      canDrive: false,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    }
    const writes: string[] = []
    apiClient.defaults.adapter = async (config) => {
      if (config.method !== 'get') writes.push(`${config.method} ${config.url}`)
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data:
          config.url === '/users'
            ? { items: [{ id: 7, email: 'staff@example.test', role: 'STAFF', isActive: true }], nextCursor: null }
            : employee,
      }
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    const close = vi.fn()
    render(
      <QueryClientProvider client={client}>
        <EmployeeModal open employee={employee} onClose={close} />
      </QueryClientProvider>,
    )
    const user = userEvent.setup()
    if (userId) await user.click(screen.getByRole('button', { name: 'No linked account' }))
    else {
      await user.click(screen.getByRole('button', { name: 'Choose user account' }))
      await user.click(await screen.findByRole('menuitem', { name: /staff@example.test/ }))
    }
    await user.click(screen.getByRole('button', { name: 'Update Employee' }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(writes).toEqual([
      'patch /employees/3/profile',
      `${userId ? 'delete' : 'patch'} /employees/3/user`,
    ])
  },
)
