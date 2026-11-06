import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { InventoryItemModal } from './InventoryItemModal'
import type { InventoryItemResponse } from '@/features/products/products.types'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false }),
}))
const original = apiClient.defaults.adapter
let writes: { url: string; body: Record<string, unknown> }[]
beforeEach(() => {
  writes = []
  apiClient.defaults.adapter = async (config) => {
    let data: unknown = config.url?.includes('/name/') ? null : { items: [], nextCursor: null }
    if (config.method !== 'get') {
      const body = JSON.parse(config.data)
      writes.push({ url: config.url!, body })
      data = { id: 1, isActive: true, ...body }
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount(item: InventoryItemResponse | null = null) {
  const close = vi.fn()
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <InventoryItemModal open item={item} onClose={close} />
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), close }
}
async function unit(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('combobox', { name: /^Unit/ }))
  await user.click(screen.getByRole('option', { name: label }))
}
function fields(price = '85.50') {
  fireEvent.change(screen.getByLabelText(/Product Name/), { target: { value: 'Rice' } })
  fireEvent.change(screen.getByLabelText(/Wholesale Unit Price/), { target: { value: price } })
}

it.each([
  ['Kilogram (kg)', 'kg'],
  ['Piece (pieces)', 'pieces'],
  ['Liter (L)', 'L'],
  ['Sack', 'sacks'],
  ['Box', 'boxes'],
])('registers %s with its exact configured unit value', async (label, value) => {
  const { user, close } = mount()
  expect(screen.getByRole('combobox', { name: /^Unit/ }).textContent).toContain('Select unit')
  expect(
    (screen.getByRole('textbox', { name: /Wholesale Unit Price/ }) as HTMLInputElement).value,
  ).toBe('')
  await unit(user, label)
  fields('9999999999.99')
  fireEvent.change(screen.getByLabelText(/Variety/), { target: { value: 'Premium' } })
  fireEvent.change(screen.getByLabelText(/Handling Notes/), { target: { value: 'Keep dry' } })
  await user.click(screen.getByRole('button', { name: 'Register Product' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toEqual([
    {
      url: '/inventory-items',
      body: {
        name: 'Rice',
        unit: value,
        unitPrice: '9999999999.99',
        variety: 'Premium',
        description: 'Keep dry',
        isActive: true,
      },
    },
  ])
})

it('shows custom input only when selected and submits its exact value', async () => {
  const { user, close } = mount()
  expect(screen.queryByLabelText('Custom Unit')).toBeNull()
  await unit(user, 'Other / Custom Unit')
  await user.type(screen.getByLabelText('Custom Unit'), 'Crate/12')
  fields()
  await user.click(screen.getByRole('button', { name: 'Register Product' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes[0].body.unit).toBe('Crate/12')
  expect(writes[0].body.unitPrice).toBe('85.50')
})

it.each(['pcs', 'Kg', 'Crate/12'])(
  'preserves existing unit %s and price when editing details',
  async (value) => {
    const { user, close } = mount({
      id: 7,
      name: 'Existing',
      unit: value,
      unitPrice: '1234567890.50',
      variety: null,
      description: null,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    })
    expect(screen.getByRole('combobox', { name: /^Unit/ }).hasAttribute('disabled')).toBe(true)
    expect((screen.getByLabelText('Custom Unit') as HTMLInputElement).value).toBe(value)
    expect(
      (screen.getByRole('textbox', { name: /Wholesale Unit Price/ }) as HTMLInputElement).value,
    ).toBe('1234567890.50')
    await user.click(screen.getByRole('button', { name: 'Save Product Changes' }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(writes).toEqual([
      {
        url: '/inventory-items/7/details',
        body: { name: 'Existing', variety: null, description: null },
      },
    ])
  },
)

it.each(['', '-1', '1.234', '1e3', '10000000000.00'])(
  'rejects invalid price %j without writing',
  async (price) => {
    const { user } = mount()
    await unit(user, 'Kilogram (kg)')
    fields(price)
    fireEvent.submit(screen.getByRole('button', { name: 'Register Product' }).closest('form')!)
    await screen.findByRole('alert')
    expect(writes).toHaveLength(0)
  },
)

it('keeps price updates separate from product details without changing the stored unit', async () => {
  const { user, close } = mount({
    id: 7,
    name: 'Rice',
    unit: 'kg',
    unitPrice: '85.50',
    description: null,
    isActive: true,
    createdAt: '',
    updatedAt: '',
  })
  expect(screen.getByRole('combobox', { name: /^Unit/ }).textContent).toContain('Kilogram (kg)')
  expect(screen.queryByLabelText('Custom Unit')).toBeNull()
  fireEvent.change(screen.getByLabelText(/Wholesale Unit Price/), { target: { value: '123.40' } })
  await user.click(screen.getByRole('button', { name: 'Save Product Changes' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toEqual([
    { url: '/inventory-items/7/details', body: { name: 'Rice', variety: null, description: null } },
    { url: '/inventory-items/7/unit-price', body: { unitPrice: '123.40' } },
  ])
})

it.each([false, true])('requires an explicit nonblank unit (custom: %s)', async (custom) => {
  const { user } = mount()
  if (custom) {
    await unit(user, 'Other / Custom Unit')
    fireEvent.change(screen.getByLabelText('Custom Unit'), { target: { value: '   ' } })
  }
  fields()
  fireEvent.submit(screen.getByRole('button', { name: 'Register Product' }).closest('form')!)
  expect((await screen.findByRole('alert')).textContent).toContain('stock unit')
  expect(writes).toHaveLength(0)
})
