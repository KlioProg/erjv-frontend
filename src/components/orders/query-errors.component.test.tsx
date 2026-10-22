import { render, screen } from '@testing-library/react'
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
    return { config, status: 200, statusText: 'OK', headers: {}, data: [] }
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
      return { config, status: 200, statusText: 'OK', headers: {}, data: [] }
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
