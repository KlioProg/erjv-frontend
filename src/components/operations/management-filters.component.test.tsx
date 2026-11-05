import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { EmployeeList } from '@/components/staffing/EmployeeList'
import { VehicleList } from './VehicleList'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false, isManager: false }),
}))
const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

it('keeps filtered staff visible during refresh and reveals the full address on focus', async () => {
  let hold = false
  let release!: () => void
  let refreshStarted = false
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/employees' && hold) {
      refreshStarted = true
      await gate
    }
    const data =
      config.url === '/employees'
        ? {
            items: [
              {
                id: 7,
                firstName: 'Alex',
                lastName: 'Cruz',
                isActive: true,
                address: 'Full warehouse address',
                email: 'alex@example.com',
                phone: '09171234567',
              },
            ],
            nextCursor: null,
          }
        : config.url === '/jobs'
          ? { items: [], nextCursor: null }
          : []
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <EmployeeList />
    </QueryClientProvider>,
  )
  const name = await screen.findByText('Alex Cruz')
  act(() => name.focus())
  expect(screen.getByRole('tooltip').textContent).toContain('Full warehouse address')
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  await user.click(screen.getByRole('combobox', { name: 'Driving eligibility' }))
  await user.click(screen.getByRole('option', { name: 'Can drive' }))
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await screen.findByText('Alex Cruz')
  hold = true
  let refresh!: Promise<void>
  act(() => {
    refresh = client.invalidateQueries({ queryKey: ['staffing', 'employees'] })
  })
  await waitFor(() => expect(refreshStarted).toBe(true))
  expect(screen.getByText('Alex Cruz')).toBeTruthy()
  expect(screen.queryByText('Loading employee directory...')).toBeNull()
  expect(screen.getByRole('button', { name: 'Clear driving eligibility' })).toBeTruthy()
  await act(async () => {
    release()
    await refresh
  })
})

it.each([
  {
    name: 'staff',
    ui: <EmployeeList />,
    path: '/employees',
    label: 'Driving eligibility',
    option: 'Can drive',
    param: 'canDrive',
    value: 'true',
    clear: 'Clear driving eligibility',
  },
  {
    name: 'vehicles',
    ui: <VehicleList />,
    path: '/delivery-vehicles',
    label: 'Availability',
    option: 'Available for trip',
    param: '',
    value: '',
    clear: 'Clear availability',
  },
])(
  'resets $name paging for server filters and retains search when cleared',
  async ({ ui, path, label, option, param, value, clear }) => {
    const reads: { url: string; params: Record<string, unknown> }[] = []
    apiClient.defaults.adapter = async (config) => {
      reads.push({ url: config.url!, params: config.params ?? {} })
      return {
        config,
        status: 200,
        statusText: 'OK',
        headers: {},
        data: { items: [], nextCursor: config.params?.cursor ? null : 'page-2' },
      }
    }
    render(
      <MemoryRouter>
        <QueryClientProvider
          client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
        >
          {ui}
        </QueryClientProvider>
      </MemoryRouter>,
    )
    const user = userEvent.setup()
    const expectedPath = param ? path : `${path}/available`
    await waitFor(() => expect(reads.some((read) => read.url === path)).toBe(true))
    await user.type(screen.getByRole('textbox', { name: /Search (staff|vehicles)/ }), 'Harbor')
    await waitFor(() => expect(reads.at(-1)?.params.q).toBe('Harbor'))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(reads.at(-1)?.params.cursor).toBe('page-2'))
    await user.click(screen.getByRole('button', { name: 'Filters' }))
    await user.click(screen.getByRole('combobox', { name: label }))
    await user.click(screen.getByRole('option', { name: option }))
    await waitFor(() => expect(reads.at(-1)?.url).toBe(expectedPath))
    if (param) await waitFor(() => expect(reads.at(-1)?.params[param]).toBe(value))
    expect(reads.at(-1)?.params.cursor).toBeUndefined()
    expect(reads.at(-1)?.params.q).toBe('Harbor')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('button', { name: clear }))
    await waitFor(() => expect(screen.getByText(/Page 1/)).toBeTruthy())
    expect(
      reads.some(
        (read) =>
          read.url === expectedPath &&
          read.params.cursor === 'page-2' &&
          (param ? read.params[param] === value : true),
      ),
    ).toBe(false)
  },
)
