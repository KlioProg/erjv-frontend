import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { AppRoutes } from './AppRoutes'

const auth = vi.hoisted(() => ({
  isAdmin: true,
  isManager: false,
  isStaff: false,
  logout: vi.fn(),
  user: { fullName: 'Test Admin', role: 'ADMIN' },
}))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))

const warehouse = {
  id: 42,
  name: 'Stable ID Warehouse',
  address: 'Davao',
  contactNumber: null,
  isActive: true,
  createdAt: '2026-10-01',
  updatedAt: '2026-10-01',
}
const originalAdapter = apiClient.defaults.adapter
let failWarehouse: boolean
let archived: boolean
let requests: string[]

beforeEach(() => {
  failWarehouse = false
  archived = false
  requests = []
  auth.isAdmin = true
  auth.isStaff = false
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    requests.push(`${config.method} ${url}`)
    if (url.startsWith('/warehouses/') && (failWarehouse || url !== '/warehouses/42')) {
      throw new Error('Warehouse is unavailable')
    }
    return {
      config,
      headers: {},
      status: 200,
      statusText: 'OK',
      data:
        url === '/warehouses/42'
          ? { ...warehouse, isActive: !archived }
          : url === '/warehouses'
            ? [{ ...warehouse, isActive: !archived }]
            : [],
    }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function mount(path: string) {
  function HistoryControls() {
    const location = useLocation()
    const navigate = useNavigate()
    return (
      <>
        <output data-testid="path">{location.pathname}</output>
        <button onClick={() => navigate(-1)}>Browser back</button>
        <button onClick={() => navigate(1)}>Browser forward</button>
        <button onClick={() => navigate('?filter=all')}>Update query</button>
      </>
    )
  }
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
        <HistoryControls />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const destinations = [
  ['/customers', 'Customers'],
  ['/sales-orders', 'Sales Orders'],
  ['/inventory', 'Inventory'],
  ['/warehouses', 'Warehouses'],
  ['/deliveries/incoming', 'Incoming'],
  ['/deliveries/outgoing', 'Outgoing'],
  ['/deliveries/history', 'History'],
  ['/vehicles', 'Vehicles'],
  ['/suppliers', 'Suppliers'],
  ['/purchase-orders', 'Purchase Orders'],
] as const

it.each(destinations)('opens %s directly with its sidebar link active', async (path, label) => {
  mount(path)
  const link = screen.getByRole('link', { name: label })
  expect(link.getAttribute('href')).toBe(path)
  expect(link.getAttribute('aria-current')).toBe('page')
  expect(screen.queryByText('Page not found')).toBeNull()
  if (path.startsWith('/deliveries/')) {
    expect(screen.getByRole('button', { name: 'Deliveries' }).getAttribute('aria-expanded')).toBe(
      'true',
    )
  }
})

it('navigates list → stable warehouse ID → list and supports Back/Forward in the same shell', async () => {
  const user = userEvent.setup()
  mount('/warehouses')
  const sidebar = screen.getByRole('link', { name: 'Warehouses' })
  await user.click(await screen.findByRole('button', { name: warehouse.name }))
  await screen.findByRole('heading', { name: warehouse.name })
  expect(screen.getByTestId('path').textContent).toBe('/warehouses/42')
  expect(sidebar.getAttribute('aria-current')).toBe('page')
  expect(requests).toContain('get /warehouses/42')
  await user.click(screen.getByRole('button', { name: 'Back to Warehouses' }))
  await screen.findByRole('heading', { name: 'Warehouses' })
  expect(screen.getByTestId('path').textContent).toBe('/warehouses')
  await user.click(screen.getByRole('button', { name: 'Browser back' }))
  await screen.findByRole('heading', { name: warehouse.name })
  await user.click(screen.getByRole('button', { name: 'Browser forward' }))
  await screen.findByRole('heading', { name: 'Warehouses' })
  expect(screen.getByRole('link', { name: 'Warehouses' })).toBe(sidebar)
  expect(requests.every((request) => request.startsWith('get '))).toBe(true)
})

it('loads a direct warehouse URL again after a fresh mount with no selection or query cache', async () => {
  const first = mount('/warehouses/42')
  await screen.findByRole('heading', { name: warehouse.name })
  first.unmount()
  mount('/warehouses/42')
  await screen.findByRole('heading', { name: warehouse.name })
  expect(requests.filter((request) => request === 'get /warehouses/42')).toHaveLength(2)
})

it.each(['abc', '0', '-1', '1.5', '9007199254740992'])(
  'rejects invalid warehouse ID %s without fetching it',
  async (id) => {
    mount(`/warehouses/${id}`)
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      expect.stringContaining('Invalid warehouse'),
    )
    expect(screen.getByRole('link', { name: 'Back to Warehouses' }).getAttribute('href')).toBe(
      '/warehouses',
    )
    expect(requests).not.toContain(`get /warehouses/${id}`)
  },
)

it('offers retry and a way back for inaccessible or missing warehouses', async () => {
  failWarehouse = true
  mount('/warehouses/42')
  expect((await screen.findByRole('alert')).textContent).toContain('Warehouse is unavailable')
  expect(screen.getByRole('link', { name: 'Back to Warehouses' })).toBeTruthy()
  failWarehouse = false
  await userEvent.setup().click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByRole('heading', { name: warehouse.name })
})

it('preserves archived warehouse view-only details', async () => {
  archived = true
  mount('/warehouses/42')
  await screen.findByRole('heading', { name: warehouse.name })
  expect(screen.getByText(/Archived.*View only/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
})

it('keeps delivery disclosure behavior while navigating children, vehicles, inventory and history', async () => {
  const user = userEvent.setup()
  mount('/deliveries/incoming')
  const group = screen.getByRole('button', { name: 'Deliveries' })
  for (const [label, title] of [
    ['Outgoing', 'Outgoing Deliveries'],
    ['History', 'Delivery History'],
  ]) {
    await user.click(screen.getByRole('link', { name: label }))
    await screen.findByRole('heading', { name: title })
    expect(group.getAttribute('aria-expanded')).toBe('true')
  }
  await user.click(group)
  expect(group.getAttribute('aria-expanded')).toBe('false')
  await user.click(screen.getByRole('link', { name: 'Vehicles' }))
  await user.click(screen.getByRole('link', { name: 'Inventory' }))
  expect(screen.getByTestId('path').textContent).toBe('/inventory')
  await user.click(screen.getByRole('button', { name: 'Browser back' }))
  expect(screen.getByTestId('path').textContent).toBe('/vehicles')
  await user.click(screen.getByRole('button', { name: 'Browser back' }))
  await screen.findByRole('heading', { name: 'Delivery History' })
  expect(group.getAttribute('aria-expanded')).toBe('true')
  expect(requests.every((request) => request.startsWith('get '))).toBe(true)
})

it.each([
  ['inventory', '/inventory'],
  ['warehouses', '/warehouses'],
  ['fleet', '/vehicles'],
  ['deliveries', '/deliveries/outgoing'],
  ['incoming-deliveries', '/deliveries/incoming'],
  ['outgoing-deliveries', '/deliveries/outgoing'],
  ['delivery-history', '/deliveries/history'],
  ['suppliers', '/suppliers'],
  ['purchases', '/purchase-orders'],
  ['clients', '/customers'],
  ['orders', '/sales-orders'],
])('redirects legacy %s bookmarks', async (key, path) => {
  mount(`/legacy/${key}`)
  await waitFor(() => expect(screen.getByTestId('path').textContent).toBe(path))
})

it('retains staff permissions on the warehouse list', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  mount('/warehouses')
  const table = await screen.findByRole('table')
  await within(table).findByText(warehouse.name)
  expect(screen.queryByRole('button', { name: 'Register Warehouse' })).toBeNull()
  expect(within(table).queryByRole('button', { name: 'Edit' })).toBeNull()
})

it('uses the application breadcrumb for client-side section navigation', async () => {
  mount('/vehicles')
  const sidebar = screen.getByRole('navigation', { name: 'Main navigation' })
  const breadcrumb = screen.getByRole('navigation', { name: 'Application breadcrumb' })
  const link = within(breadcrumb).getByRole('link', { name: 'Logistics' })
  expect(link.getAttribute('href')).toBe('/inventory')
  await userEvent.setup().click(link)
  await screen.findByRole('heading', { name: 'Inventory' })
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBe(sidebar)
  expect(breadcrumb.isConnected).toBe(true)
})

it('keeps warehouse summaries below status navigation and outside the shared heading', async () => {
  mount('/warehouses')
  await screen.findByRole('heading', { name: 'Warehouses' })
  const summary = screen.getByText('Warehouse Locations')
  const activeTab = screen.getByRole('button', { name: /Active Warehouses/ })
  expect(summary.closest('header')).toBeNull()
  expect(activeTab.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(
    summary.compareDocumentPosition(screen.getByRole('textbox', { name: 'Search warehouses' })) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
})

it('starts new management routes at the top without resetting local tabs, query updates, or history', async () => {
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  try {
    const user = userEvent.setup()
    mount('/suppliers')
    expect(scrollTo).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: 'Purchase Orders' }))
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 0, left: 0, behavior: 'instant' })
    scrollTo.mockClear()
    await user.click(screen.getByRole('button', { name: /Received Orders/ }))
    await user.click(screen.getByRole('button', { name: 'Update query' }))
    expect(scrollTo).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Browser back' }))
    await user.click(screen.getByRole('button', { name: 'Browser back' }))
    await screen.findByRole('heading', { name: 'Suppliers' })
    await user.click(screen.getByRole('button', { name: 'Browser forward' }))
    await screen.findByRole('heading', { name: 'Purchase Orders' })
    expect(scrollTo).not.toHaveBeenCalled()
  } finally {
    scrollTo.mockRestore()
  }
})

it('navigates between purchasing pages with Back/Forward while keeping the shell and existing controls', async () => {
  const user = userEvent.setup()
  mount('/suppliers')
  const navigation = screen.getByRole('navigation', { name: 'Main navigation' })
  await screen.findByRole('heading', { name: 'Suppliers' })
  expect(screen.getByRole('textbox', { name: 'Search suppliers' })).toBeTruthy()
  await user.click(screen.getByRole('link', { name: 'Purchase Orders' }))
  await screen.findByRole('heading', { name: 'Purchase Orders' })
  expect(screen.getByTestId('path').textContent).toBe('/purchase-orders')
  expect(screen.getByRole('textbox', { name: 'Search purchase orders' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: /Received Orders/ }))
  expect(await screen.findByText('No completed purchase orders found')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Browser back' }))
  await screen.findByRole('heading', { name: 'Suppliers' })
  expect(screen.getByRole('link', { name: 'Suppliers' }).getAttribute('aria-current')).toBe('page')
  await user.click(screen.getByRole('button', { name: /Archived Suppliers/ }))
  expect(await screen.findByText('No archived suppliers found')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Browser forward' }))
  await screen.findByRole('heading', { name: 'Purchase Orders' })
  expect(screen.getByRole('link', { name: 'Purchase Orders' }).getAttribute('aria-current')).toBe(
    'page',
  )
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBe(navigation)
  expect(requests.every((request) => request.startsWith('get '))).toBe(true)
})
