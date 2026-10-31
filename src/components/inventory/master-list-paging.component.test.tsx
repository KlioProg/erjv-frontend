import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { InventoryItemCatalog } from './InventoryItemCatalog'
import { WarehouseList } from '@/components/operations/WarehouseList'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false, isManager: false }),
}))
const originalAdapter = apiClient.defaults.adapter
let requests: { url: string; params: Record<string, unknown> }[]
const product = (id: number, name: string, isActive = true) => ({
  id,
  name,
  isActive,
  unit: 'kg',
  unitPrice: '20.00',
  description: null,
  createdAt: '',
  updatedAt: '',
})
beforeEach(() => {
  requests = []
  apiClient.defaults.adapter = async (config) => {
    const params = config.params ?? {}
    requests.push({ url: config.url!, params })
    let data: unknown = { items: [], nextCursor: null }
    if (config.url === '/inventory-items' || config.url === '/warehouses') {
      const id = params.cursor ? 2 : 1
      const name =
        params.q ||
        `${config.url === '/warehouses' ? 'Warehouse' : 'Product'} ${params.includeInactive === 'only' ? 'Archived' : id}`
      data = {
        items: [product(id, name, params.includeInactive !== 'only')],
        nextCursor:
          params.cursor || params.q || params.includeInactive === 'only' ? null : 'page-2',
      }
    }
    if (config.url === '/inventory-items/99') data = product(99, 'Selected beyond first page')
    return { config, data, status: 200, statusText: '', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
function mount(element: React.ReactNode) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {element}
    </QueryClientProvider>,
  )
}
const surfaces = [
  {
    resource: 'products',
    path: '/inventory-items',
    name: 'Product',
    search: 'Search inventory',
    archived: /^Archived/,
    element: () => <InventoryItemCatalog />,
  },
  {
    resource: 'warehouses',
    path: '/warehouses',
    name: 'Warehouse',
    search: 'Search warehouses',
    archived: /^Archived Warehouses/,
    element: () => <WarehouseList onOpenWarehouse={() => {}} />,
  },
]
it.each(surfaces)(
  'loads additional $resource pages on demand without changing stock paging',
  async ({ path, name, element }) => {
    mount(element())
    await screen.findByText(`${name} 1`)
    expect(requests.filter(({ url, params }) => url === path && params.limit === 50)).toHaveLength(
      1,
    )
    expect(screen.queryByText(`${name} 2`)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText(`${name} 2`)
    expect(requests).toContainEqual({
      url: path,
      params: { includeInactive: 'false', limit: 50, cursor: 'page-2' },
    })
    expect(screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText(`${name} 1`)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))
    await screen.findByText(`${name} 1`)
    expect(requests.filter(({ url }) => url === '/stock-items')).toHaveLength(1)
  },
)
it.each(surfaces)(
  'resets $resource cursors for name search and archived scope',
  async ({ path, name, search, archived, element }) => {
    mount(element())
    await screen.findByText(`${name} 1`)
    fireEvent.change(screen.getByRole('textbox', { name: search }), {
      target: { value: 'Matched name' },
    })
    await screen.findByText('Matched name')
    expect(requests).toContainEqual({
      url: path,
      params: { includeInactive: 'false', q: 'Matched name', limit: 50 },
    })
    fireEvent.change(screen.getByRole('textbox', { name: search }), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: archived }))
    await screen.findByText(`${name} Archived`)
    expect(requests).toContainEqual({ url: path, params: { includeInactive: 'only', limit: 50 } })
    expect(screen.queryByText(`${name} 1`)).toBeNull()
  },
)
it('resolves focused products by ID when they are outside the loaded catalog page', async () => {
  mount(<InventoryItemCatalog focusTarget={{ productId: 99, warehouseId: 1 }} />)
  await screen.findByText('Selected beyond first page')
  expect(requests).toContainEqual({ url: '/inventory-items/99', params: {} })
  expect(requests.filter(({ url }) => url === '/inventory-items')).toHaveLength(1)
  expect(screen.queryByText(/product is archived or no longer available/)).toBeNull()
  await waitFor(() => expect(screen.getByText('Product 1')).toBeTruthy())
})
