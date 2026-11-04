import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { ClientModal } from '@/components/crm/ClientModal'
import { SupplierModal } from '@/components/purchases/SupplierModal'
import { EmployeeModal } from '@/components/staffing/EmployeeModal'
import { JobModal } from '@/components/staffing/JobModal'
import { RegisterUserModal } from '@/components/staffing/RegisterUserModal'
import { createSupplierApi } from './logistics/suppliers.api'
import { apiClient } from '@/lib/api-client'

const originalAdapter = apiClient.defaults.adapter
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false }),
}))
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.useRealTimers()
})

it.each(['customer', 'supplier', 'employee', 'job', 'account'] as const)(
  'sends one %s creation for duplicate submissions and allows retry after a failed save',
  async (kind) => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const writes: unknown[] = []
    apiClient.defaults.adapter = async (config) => {
      if (config.method === 'post') {
        writes.push(JSON.parse(config.data))
        await gate
        if (writes.length === 1) throw new Error('Save unavailable')
      }
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data:
          config.method === 'get'
            ? { items: [], nextCursor: null }
            : {
                id: 1,
                name: 'New business',
                firstName: 'Alex',
                lastName: 'Cruz',
                email: 'alex@example.test',
              },
      }
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const onClose = vi.fn()
    render(
      <QueryClientProvider client={client}>
        {kind === 'customer' ? (
          <ClientModal open client={null} onClose={onClose} />
        ) : kind === 'supplier' ? (
          <SupplierModal
            open
            onClose={onClose}
            onSubmit={async (values) => {
              await createSupplierApi(values)
            }}
          />
        ) : kind === 'employee' ? (
          <EmployeeModal open employee={null} onClose={onClose} />
        ) : kind === 'job' ? (
          <JobModal open job={null} onClose={onClose} />
        ) : (
          <RegisterUserModal open onClose={onClose} />
        )}
      </QueryClientProvider>,
    )
    const name = screen.getByLabelText(
      kind === 'customer'
        ? /Business \/ Customer Name/
        : kind === 'supplier'
          ? /Company Name/
          : kind === 'employee'
            ? /First Name/
            : kind === 'job'
              ? /Position Title/
              : /Work Email Address/,
    )
    fireEvent.change(name, {
      target: { value: kind === 'account' ? 'alex@example.test' : 'New business' },
    })
    if (kind === 'employee')
      fireEvent.change(screen.getByLabelText(/Last Name/), { target: { value: 'Cruz' } })
    if (kind === 'account')
      for (const label of ['Initial Password', 'Confirm Password'])
        fireEvent.change(screen.getByLabelText(label), { target: { value: 'Validpassword123!' } })
    if (kind === 'customer')
      fireEvent.change(screen.getByLabelText(/Delivery \/ Billing Address/), {
        target: { value: 'Davao' },
      })
    const form = name.closest('form')!
    act(() => {
      fireEvent.submit(form)
      fireEvent.submit(form)
    })
    await waitFor(() => expect(writes.length).toBeGreaterThan(0))
    await act(async () => {
      release()
      await gate
    })
    await screen.findByText(/Save unavailable/)
    expect(onClose).not.toHaveBeenCalled()
    expect(writes).toHaveLength(1)
    expect((name as HTMLInputElement).value).toBe(
      kind === 'account' ? 'alex@example.test' : 'New business',
    )
    fireEvent.submit(form)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(writes).toHaveLength(2)
    client.clear()
  },
)

it('defaults the employee hire date to today in Manila after local midnight', () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-03T16:30:00Z'))
  const client = new QueryClient()
  render(
    <QueryClientProvider client={client}>
      <EmployeeModal open employee={null} onClose={vi.fn()} />
    </QueryClientProvider>,
  )
  expect((screen.getByLabelText(/Date Hired|Hire Date/) as HTMLInputElement).value).toBe(
    '2026-11-04',
  )
  client.clear()
})
