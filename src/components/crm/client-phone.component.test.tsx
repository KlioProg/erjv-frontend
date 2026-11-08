import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { sanitizePhilippinePhone, validatePhilippinePhone } from '@/lib/phone-utils'
import { ClientModal } from './ClientModal'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})

function mount(phone: string | null = null) {
  const writes: { url?: string; body: Record<string, unknown> }[] = []
  apiClient.defaults.adapter = async (config) => {
    const body = config.data ? JSON.parse(config.data) : {}
    if (config.method !== 'get') writes.push({ url: config.url, body })
    return {
      config,
      data: config.method === 'get' ? { items: [], nextCursor: null } : { id: 1, ...body },
      status: 200,
      statusText: 'OK',
      headers: {},
    }
  }
  const close = vi.fn()
  const client =
    phone === null
      ? null
      : {
          id: 1,
          name: 'Buyer',
          address: 'Davao',
          phone,
          contactPerson: null,
          email: null,
          isActive: true,
          createdAt: '2026-11-07T00:00:00Z',
          updatedAt: '2026-11-07T00:00:00Z',
        }
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <ClientModal open client={client} onClose={close} />
    </QueryClientProvider>,
  )
  if (!client) {
    fireEvent.change(screen.getByLabelText(/Business \/ Customer Name/), {
      target: { value: 'Buyer' },
    })
    fireEvent.change(screen.getByLabelText(/Delivery \/ Billing Address/), {
      target: { value: 'Davao' },
    })
  }
  return { writes, close }
}

it.each([
  ['09171234567', '09171234567'],
  ['+639171234567', '09171234567'],
  ['+63 917 123 4567', '09171234567'],
  ['(02) 8123-4567', '(02) 8123-4567'],
  ['+1 202 555 0123', '+1 202 555 0123'],
])('registers customer contact %s without losing digits', async (phone, expected) => {
  const { writes, close } = mount()
  const user = userEvent.setup()
  await user.click(screen.getByLabelText('Phone Number'))
  await user.paste(phone)
  await user.click(screen.getByRole('button', { name: 'Register Customer Profile' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toEqual([{ url: '/clients', body: expect.objectContaining({ phone: expected }) }])
})

it.each([
  ['+63 917 123 4567', '09171234567'],
  ['(02) 8123-4567', '(02) 8123-4567'],
  ['+1 202 555 0123', '+1 202 555 0123'],
])('loads and saves existing customer contact %s consistently', async (phone, expected) => {
  const { writes, close } = mount(phone)
  expect((screen.getByLabelText('Phone Number') as HTMLInputElement).value).toBe(phone)
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toEqual([
    { url: '/clients/1/details', body: expect.objectContaining({ phone: expected }) },
  ])
})

it('rejects an overlong mobile without silently truncating or saving it', async () => {
  const { writes } = mount()
  await userEvent.type(screen.getByLabelText('Phone Number'), '091712345678')
  expect((screen.getByLabelText('Phone Number') as HTMLInputElement).value).toBe('091712345678')
  await userEvent.click(screen.getByRole('button', { name: 'Register Customer Profile' }))
  await screen.findByRole('alert')
  expect(writes).toHaveLength(0)
})

it('keeps overlong mobile digits visible to shared validation', () => {
  expect(sanitizePhilippinePhone('+63 917 123 45678')).toBe('091712345678')
  expect(validatePhilippinePhone('091712345678')).not.toBeNull()
  expect(validatePhilippinePhone('+63 917 123 4567')).toBeNull()
  expect(validatePhilippinePhone('08171234567')).not.toBeNull()
  expect(validatePhilippinePhone('0917123456')).not.toBeNull()
})
