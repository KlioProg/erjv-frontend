import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { ClientModal } from './ClientModal'

const original = apiClient.defaults.adapter
let writes: { method?: string; body: Record<string, unknown> }[]
beforeEach(() => {
  writes = []
  apiClient.defaults.adapter = async (config) => {
    if (config.method !== 'get')
      writes.push({ method: config.method, body: JSON.parse(config.data) })
    return {
      config,
      headers: {},
      status: 200,
      statusText: 'OK',
      data: config.method === 'get' ? { items: [], nextCursor: null } : { id: 1 },
    }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})

async function mount(editing: boolean, savedPhone = '') {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <ClientModal
        open
        onClose={() => {}}
        client={
          editing
            ? {
                id: 1,
                name: 'Buyer',
                address: 'Davao',
                phone: savedPhone,
                contactPerson: null,
                email: null,
                isActive: true,
                createdAt: '',
                updatedAt: '',
              }
            : null
        }
      />
    </QueryClientProvider>,
  )
  if (!editing) {
    fireEvent.change(screen.getByLabelText(/Business \/ Customer Name/), {
      target: { value: 'Buyer' },
    })
    fireEvent.change(screen.getByLabelText(/Delivery \/ Billing Address/), {
      target: { value: 'Davao' },
    })
  }
  return screen.getByRole('button', {
    name: editing ? 'Save Changes' : 'Register Customer Profile',
  })
}

it.each([false, true])(
  'normalizes equivalent Philippine mobiles on save (editing=%s)',
  async (editing) => {
    const save = await mount(editing)
    const input = screen.getByLabelText('Phone Number')
    const user = userEvent.setup()
    for (const phone of ['09171234567', '+639171234567', '+63 917 123 4567', '639171234567']) {
      await user.clear(input)
      await user.paste(phone)
      await user.click(save)
      await waitFor(() => expect(writes.at(-1)?.body.phone).toBe('09171234567'))
      expect((input as HTMLInputElement).value).toBe('9171234567')
      writes = []
    }
  },
)

it.each(['(02) 8123 4567', '+63 2 8123 4567', '+1 202 555 0123'])(
  'preserves supported telephone number %s during editing',
  async (phone) => {
    const save = await mount(true, phone)
    await userEvent.click(save)
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0].body.phone).toBe(phone.replace(/[\s().-]/g, ''))
  },
)

it.each(['091712345678', '+6391712345678', '0917abc1234567'])(
  'rejects %s without silently changing the intended number',
  async (phone) => {
    const save = await mount(true)
    fireEvent.change(screen.getByLabelText('Phone Number'), { target: { value: phone } })
    await userEvent.click(save)
    expect(screen.getByLabelText('Phone Number').getAttribute('aria-invalid')).toBe('true')
    expect(writes).toHaveLength(0)
  },
)
