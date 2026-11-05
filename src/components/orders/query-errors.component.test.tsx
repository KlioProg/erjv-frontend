import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { apiClient } from '@/lib/api-client'
import { OrdersView } from './OrdersView'
import { PurchasesView } from '@/components/purchases/PurchasesView'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1, fullName: 'Admin' }, isAdmin: true, isManager: false }),
}))
const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

it.each([
  { endpoint: '/sales-orders', lookup: '/clients', party: 'Customer', key: 'clientId', ui: <OrdersView /> },
  { endpoint: '/purchase-orders', lookup: '/suppliers', party: 'Supplier', key: 'supplierId', ui: <PurchasesView section="orders" /> },
])('pages $endpoint by party and Manila order dates without mixing query contexts', async ({ endpoint, lookup, party, key, ui }) => {
  const reads: Record<string, unknown>[] = []
  apiClient.defaults.adapter = async (config) => {
    if (config.url === endpoint) reads.push(config.params ?? {})
    const data = config.url === lookup ? { items: [{ id: 7, name: 'Harbor', isActive: true }], nextCursor: null }
      : { items: [], nextCursor: config.url === endpoint && !config.params?.cursor ? 'page-2' : null }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)
  const user = userEvent.setup()
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(reads.at(-1)?.cursor).toBe('page-2'))
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  await user.click(screen.getByRole('button', { name: `Choose ${party.toLowerCase()}` }))
  await user.click(await screen.findByRole('menuitem', { name: 'Harbor' }))
  fireEvent.change(screen.getByLabelText('Order date from', { selector: 'input' }), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('Order date through', { selector: 'input' }), { target: { value: '2026-11-05' } })
  await waitFor(() => expect(reads.at(-1)).toMatchObject({ [key]: 7, orderedFrom: '2026-10-31T16:00:00.000Z', orderedBefore: '2026-11-05T16:00:00.000Z' }))
  expect(reads.at(-1)?.cursor).toBeUndefined()
  const validReads = reads.length
  fireEvent.change(screen.getByLabelText('Order date through', { selector: 'input' }), { target: { value: '2026-10-01' } })
  expect(screen.getByRole('alert').textContent).toContain('Choose an end date')
  expect(reads).toHaveLength(validReads)
  fireEvent.change(screen.getByLabelText('Order date through', { selector: 'input' }), { target: { value: '2026-11-05' } })
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await user.click(screen.getByRole('button', { name: `Clear ${party.toLowerCase()}` }))
  await waitFor(() => expect(reads.at(-1)?.[key]).toBeUndefined())
  expect(reads.at(-1)?.orderedFrom).toBe('2026-10-31T16:00:00.000Z')
  await user.click(screen.getByRole('button', { name: 'Clear All' }))
  await waitFor(() => expect(reads.at(-1)?.orderedFrom).toBeUndefined())
  expect(reads.at(-1)?.orderedBefore).toBeUndefined()
})

it.each([
  { endpoint: '/sales-orders', ui: <OrdersView />, searchName: 'Search orders' },
  { endpoint: '/purchase-orders', ui: <PurchasesView section="orders" />, searchName: 'Search purchase orders' },
])('combines $endpoint status filters with server search and clears only the selected filter', async ({ endpoint, ui, searchName }) => {
  const reads: Record<string, unknown>[] = []
  apiClient.defaults.adapter = async (config) => {
    if (config.url === endpoint) reads.push(config.params ?? {})
    return { config, status: 200, statusText: 'OK', headers: {}, data: { items: [], nextCursor: null } }
  }
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>)
  const user = userEvent.setup()
  await user.type(screen.getByRole('textbox', { name: searchName }), 'rice')
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  await user.click(screen.getByRole('combobox', { name: 'Order status' }))
  await user.click(screen.getByRole('option', { name: 'Draft' }))
  await waitFor(() => expect(reads.at(-1)).toMatchObject({ q: 'rice', statuses: ['DRAFT'] }))
  expect(reads.at(-1)?.cursor).toBeUndefined()
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await user.click(screen.getByRole('button', { name: 'Clear order status' }))
  await waitFor(() => expect((reads.at(-1)?.statuses as string[]).length).toBe(3))
  expect(reads.at(-1)?.q).toBe('rice')
})

it.each([
  {
    name: 'sales orders',
    endpoint: '/sales-orders',
    searchName: 'Search orders',
    actionName: 'Create Sales Order',
    ui: <OrdersView />,
  },
  {
    name: 'purchase orders',
    endpoint: '/purchase-orders',
    searchName: 'Search purchase orders',
    actionName: 'Create Purchase Order',
    ui: <PurchasesView section="orders" />,
  },
])('preserves the $name toolbar while its table skeleton is loading', async ({
  endpoint,
  searchName,
  actionName,
  ui,
}) => {
  let releaseRequest: (() => void) | undefined
  const requestGate = new Promise<void>((resolve) => {
    releaseRequest = resolve
  })
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.split('?')[0] === endpoint) {
      await requestGate
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data: /^\/(sales-orders|purchase-orders|incoming-deliveries|outgoing-deliveries|suppliers)$/.test(config.url ?? '') ? { items: [], nextCursor: null } : [] }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      {ui}
    </QueryClientProvider>,
  )
  expect((await screen.findByRole('status')).textContent).toMatch(/Loading .* orders/)
  expect(screen.getByRole('textbox', { name: searchName })).toBeTruthy()
  expect(screen.getByRole('button', { name: actionName })).toBeTruthy()
  releaseRequest?.()
  expect(await screen.findByText(/No active .* found/)).toBeTruthy()
  expect(screen.queryByRole('status')).toBeNull()
})

it.each([
  { name: 'sales orders', endpoint: '/sales-orders', ui: <OrdersView /> },
  { name: 'purchase orders', endpoint: '/purchase-orders', ui: <PurchasesView section="orders" /> },
  { name: 'suppliers', endpoint: '/suppliers', ui: <PurchasesView section="suppliers" /> },
])(
  'distinguishes failed $name from an empty list and provides recovery',
  async ({ endpoint, ui }) => {
    const user = userEvent.setup()
    let attempts = 0
    apiClient.defaults.adapter = async (config) => {
      if (config.url?.split('?')[0] === endpoint) {
        attempts++
        if (attempts === 1) throw new AxiosError('Service unavailable', 'ERR_NETWORK', config)
      }
      return { config, status: 200, statusText: 'OK', headers: {}, data: /^\/(sales-orders|purchase-orders|incoming-deliveries|outgoing-deliveries|suppliers)$/.test(config.url ?? '') ? { items: [], nextCursor: null } : [] }
    }
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
    expect(await screen.findByRole('alert')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(attempts).toBe(2)
    expect(await screen.findByText(/No active .* found/)).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  },
)
