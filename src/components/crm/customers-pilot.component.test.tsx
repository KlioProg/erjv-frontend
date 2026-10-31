import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ClientList } from './ClientList'
import { apiClient } from '@/lib/api-client'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false }),
}))

const originalAdapter = apiClient.defaults.adapter
let failRead = false
let failArchive = false
let archivedMatch = false

beforeEach(() => {
  failRead = false
  failArchive = false
  archivedMatch = false
  apiClient.defaults.adapter = async (config) => {
    if (
      failRead ||
      (failArchive && config.method === 'delete') ||
      config.url?.endsWith('/reactivate')
    ) {
      throw new Error('Network Error')
    }
    const records = config.params?.q && config.params?.includeInactive === 'true'
      ? archivedMatch
        ? [{ id: 2, name: 'Archived Buyer', address: 'Davao City', isActive: false }]
        : []
      : [
          {
            id: 1,
            name: 'Davao Trading',
            address: 'Davao City',
            contactPerson: 'Juan Cruz',
            phone: null,
            email: null,
            isActive: true,
          },
        ]
    const data =
      config.method === 'get' && config.url === '/clients'
        ? {
            items: records.filter(
              (record) =>
                !config.params?.q ||
                record.name.toLowerCase().includes(config.params.q.toLowerCase()),
            ),
            nextCursor: null,
          }
        : records
    return { config, headers: {}, status: 200, statusText: 'OK', data }
  }
})

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function mount() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
        })
      }
    >
      <ClientList />
    </QueryClientProvider>,
  )
}

it('offers recovery for a failed directory request instead of reporting an empty directory', async () => {
  failRead = true
  const user = userEvent.setup()
  mount()
  expect(await screen.findByText('Could not load customers')).toBeTruthy()
  expect(screen.queryByText('No active customers found')).toBeNull()
  failRead = false
  await user.click(screen.getByRole('button', { name: 'Try again' }))
  expect(await screen.findByText('Davao Trading')).toBeTruthy()
})

it('places invalid phone feedback next to the field and associates it with the input', async () => {
  const user = userEvent.setup()
  mount()
  await screen.findByText('Davao Trading')
  await user.click(screen.getByRole('button', { name: 'Edit' }))
  const dialog = within(screen.getByRole('dialog'))
  const phone = dialog.getByRole('textbox', { name: 'Phone Number' })
  await user.type(phone, '0917')
  await user.click(dialog.getByRole('button', { name: 'Save Changes' }))
  expect(phone.getAttribute('aria-invalid')).toBe('true')
  const feedback = document.getElementById(phone.getAttribute('aria-describedby')!)
  expect(feedback?.textContent).toContain('must be exactly 11 digits')
})

it('keeps archive confirmation open with recoverable error feedback when the request fails', async () => {
  failArchive = true
  const user = userEvent.setup()
  mount()
  await screen.findByText('Davao Trading')
  await user.click(screen.getByRole('button', { name: 'Archive' }))
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive Customer' }),
  )
  await waitFor(() =>
    expect(within(screen.getByRole('dialog')).getByRole('alert').textContent).toContain(
      'Unable to connect',
    ),
  )
})

it('clears a search from the no-results state without changing the selected archive filter', async () => {
  const user = userEvent.setup()
  mount()
  await screen.findByText('Davao Trading')
  await user.type(screen.getByRole('textbox', { name: 'Search customers' }), 'missing')
  await user.click(screen.getByRole('button', { name: 'Clear search' }))
  expect(await screen.findByText('Davao Trading')).toBeTruthy()
  expect(screen.getByRole('textbox', { name: 'Search customers' }).getAttribute('value')).toBe('')
})

it('keeps an archived duplicate available when reactivation fails', async () => {
  archivedMatch = true
  const user = userEvent.setup()
  mount()
  await screen.findByText('Davao Trading')
  await user.click(screen.getByRole('button', { name: 'Register New Customer' }))
  const dialog = within(screen.getByRole('dialog'))
  await user.type(
    dialog.getByRole('textbox', { name: /Business \/ Customer Name/ }),
    'Archived Buyer',
  )
  await user.type(
    dialog.getByRole('textbox', { name: /Delivery \/ Billing Address/ }),
    'Davao City',
  )
  await user.click(dialog.getByRole('button', { name: 'Register Customer Profile' }))
  await user.click(await dialog.findByRole('button', { name: 'Reactivate Customer Profile' }))
  await waitFor(() => expect(dialog.getByRole('alert').textContent).toContain('Unable to connect'))
  expect(
    dialog.getByRole('textbox', { name: /Business \/ Customer Name/ }).getAttribute('value'),
  ).toBe('Archived Buyer')
})

it('returns keyboard focus to the customer row action after closing the dialog', async () => {
  const user = userEvent.setup()
  mount()
  await screen.findByText('Davao Trading')
  const edit = screen.getByRole('button', { name: 'Edit' })
  await user.click(edit)
  await screen.findByRole('dialog')
  await user.keyboard('{Escape}')
  await waitFor(() => expect(document.activeElement).toBe(edit))
})
