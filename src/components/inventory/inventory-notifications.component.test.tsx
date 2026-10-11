import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { MainDashboard } from '@/components/dashboard/MainDashboard'
import { InventoryHub } from './InventoryHub'
import { StockNotifications } from '@/components/layout/StockNotifications'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'

const auth = vi.hoisted(() => ({
  isAdmin: true,
  isManager: false,
  isStaff: false,
  logout: vi.fn(),
  user: { fullName: 'Test Employee', email: 'test@example.test', role: 'ADMIN' },
}))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const dates = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
const location = (id: number, name: string, isActive = true) => ({
  id,
  name,
  isActive,
  address: '',
  contactNumber: null,
  ...dates,
})
const warehouses = [
  location(1, 'Store'),
  location(2, 'Main Warehouse'),
  location(3, 'Archived Warehouse', false),
]
const product = (id: number, name: string, isActive = true): InventoryItemResponse => ({
  id,
  name,
  isActive,
  unit: 'sacks',
  unitPrice: 20,
  description: 'Inventory test',
  variety: null,
  ...dates,
})
let products: InventoryItemResponse[]
let stocks: StockItemWithRelations[]
let failStock: boolean
let failArchive: boolean
const originalAdapter = apiClient.defaults.adapter
const stock = (
  id: number,
  productId: number,
  warehouseId: number,
  quantity: string,
): StockItemWithRelations => ({
  id,
  inventoryItemId: productId,
  warehouseId,
  quantity,
  reservedQuantity: '0',
  inventoryItem: {
    id: productId,
    name: products.find((p) => p.id === productId)?.name || 'Unknown',
    unit: 'sacks',
  },
  warehouse: warehouses.find((w) => w.id === warehouseId)!,
  ...dates,
})
function mount(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  }
}
beforeEach(() => {
  auth.isAdmin = true
  auth.isStaff = false
  auth.logout.mockClear()
  products = [
    product(1, 'Alpha Empty'),
    product(2, 'Beta Mixed'),
    product(3, 'Gamma Small'),
    product(4, 'Delta Unknown'),
    product(5, 'Archived Product', false),
  ]
  stocks = [
    stock(1, 1, 1, '0'),
    stock(2, 2, 1, '0'),
    stock(3, 2, 2, '100'),
    stock(4, 3, 1, '0.01'),
    stock(5, 4, 1, 'bad'),
    stock(6, 5, 1, '0'),
  ]
  failStock = false
  failArchive = false
  vi.spyOn(toast, 'success').mockReturnValue('success')
  vi.spyOn(toast, 'error').mockReturnValue('error')
  // Test-only adapter exercises real services, caches, mutations and navigation.
  apiClient.defaults.adapter = async (config) => {
    const url = config.url || ''
    const method = config.method || 'get'
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
    let data: unknown = []
    if (method === 'get') {
      if (url === '/stock-items' && failStock)
        throw {
          isAxiosError: true,
          response: { status: 503, data: { message: 'Stock unavailable' } },
        }
      data =
        url === '/inventory-items'
          ? products.filter((p) => config.params?.includeInactive === 'true' || p.isActive)
          : url === '/stock-items'
            ? stocks
            : url === '/warehouses'
              ? warehouses.filter((w) => w.isActive)
              : []
    } else if (url.startsWith('/inventory-items/') && method === 'delete') {
      if (failArchive)
        throw { isAxiosError: true, response: { status: 409, data: { message: 'Archive failed' } } }
      const id = Number(url.split('/')[2])
      products = products.map((p) => (p.id === id ? { ...p, isActive: false } : p))
      data = products.find((p) => p.id === id)
    } else if (url.endsWith('/reactivate')) {
      const id = Number(url.split('/')[2])
      products = products.map((p) => (p.id === id ? { ...p, isActive: true } : p))
      data = products.find((p) => p.id === id)
    } else if (url === '/inventory-items' && method === 'post') {
      const added = { ...product(99, body.name), ...body, unitPrice: Number(body.unitPrice) }
      products = [...products, added]
      data = added
    } else if (url.endsWith('/details') || url.endsWith('/unit-price')) {
      const id = Number(url.split('/')[2])
      products = products.map((p) => (p.id === id ? { ...p, ...body } : p))
      data = products.find((p) => p.id === id)
    }
    return { data: structuredClone(data), config, headers: {}, status: 200, statusText: 'OK' }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

describe('inventory and global stock warnings', () => {
  it('registers and edits products through the existing services and refreshes the table', async () => {
    const user = userEvent.setup()
    mount(<InventoryHub />)
    await screen.findByText('Alpha Empty')
    await user.click(screen.getByRole('button', { name: 'Register Product' }))
    let dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByRole('textbox', { name: /Product Item Name/ }), 'New Product')
    await user.type(dialog.getByRole('spinbutton', { name: /Standard Wholesale Unit Price/ }), '25')
    await user.click(dialog.getByRole('button', { name: 'Register Product' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const row = (await screen.findByText('New Product')).closest('tr')!
    await user.click(within(row).getAllByRole('button', { name: 'Edit' })[0])
    dialog = within(screen.getByRole('dialog'))
    const name = dialog.getByRole('textbox', { name: /Product Item Name/ })
    await user.clear(name)
    await user.type(name, 'Renamed Product')
    await user.click(dialog.getByRole('button', { name: 'Save Product Changes' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(await screen.findByText('Renamed Product')).toBeTruthy()
    expect(screen.queryByText('New Product')).toBeNull()
  })

  it('removes redundant navigation/cards/status while preserving account and inventory management', async () => {
    const user = userEvent.setup()
    mount(<MainDashboard />)
    await screen.findByText('Alpha Empty')
    expect(screen.getByRole('heading', { name: 'Inventory' })).toBeTruthy()
    for (const text of [
      'Low-Stock Alerts',
      'Warehouse Locations',
      'Total Stored Units',
      'Available Vehicles',
      'Catalog Products',
      'Product Catalog',
      'ADMIN Mode',
      'In Stock',
    ])
      expect(screen.queryByText(text)).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull()
    expect(screen.getAllByRole('columnheader')).toHaveLength(5)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0].textContent).toContain('Alpha Empty')
    expect(rows[0].className).toContain('bg-destructive/5')
    expect(rows[1].textContent).toContain('Beta Mixed')
    expect(rows[1].className).not.toContain('bg-destructive')
    expect(
      within(rows[1]).getByRole('img', { name: /Out of stock at some locations/ }),
    ).toBeTruthy()
    expect(rows[2].textContent).toContain('Gamma Small')
    await user.click(screen.getByRole('button', { name: /^Archived/ }))
    expect(await screen.findByText('Archived Product')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: /^Active/ }))
    await screen.findByText('Alpha Empty')
    const inventoryNav = within(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ).getByRole('button', { name: 'Inventory' })
    expect(inventoryNav.querySelectorAll('svg')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Account menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Sign Out' }))
    expect(auth.logout).toHaveBeenCalledOnce()
  })

  it('respects chosen sorting and searches and expands individual warehouse shortages', async () => {
    const user = userEvent.setup()
    const openWarehouse = vi.fn()
    mount(<InventoryHub onOpenWarehouse={openWarehouse} />)
    await screen.findByText('Alpha Empty')
    await user.click(screen.getByRole('button', { name: 'Product' }))
    expect(screen.getAllByRole('row')[3].textContent).toContain('Delta Unknown')
    await user.type(screen.getByRole('textbox', { name: 'Search inventory' }), 'Beta')
    await user.click(screen.getByRole('button', { name: 'Show stock by location for Beta Mixed' }))
    const locations = within(
      screen.getByRole('region', { name: 'Stock by location for Beta Mixed' }),
    )
    expect(locations.getByRole('img', { name: 'Out of stock at Store' })).toBeTruthy()
    expect(locations.queryByRole('img', { name: /Main Warehouse/ })).toBeNull()
    await user.click(locations.getByRole('button', { name: 'View inventory in Store' }))
    expect(openWarehouse).toHaveBeenCalledWith(1)
  })

  it('opens and focuses the exact location from another module, including products on later pages', async () => {
    products = Array.from({ length: 15 }, (_, index) =>
      product(index + 1, `Product ${String(index + 1).padStart(2, '0')}`),
    )
    stocks = products.flatMap((p) => [
      stock(p.id * 2, p.id, 1, '0'),
      stock(p.id * 2 + 1, p.id, 2, '100'),
    ])
    const user = userEvent.setup()
    mount(<MainDashboard />)
    await screen.findByText('Product 01')
    await user.click(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', {
        name: 'Customers',
      }),
    )
    await user.click(
      await screen.findByRole('button', { name: /Stock notifications, 15 unresolved/ }),
    )
    const alert = await screen.findByRole('menuitem', { name: /Out of stock: Product 15, Store/ })
    await waitFor(() => expect(alert.getAttribute('data-disabled')).toBeNull())
    await user.click(alert)
    const region = await screen.findByRole('region', { name: 'Stock by location for Product 15' })
    expect(within(region).getByRole('img', { name: 'Out of stock at Store' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement?.id).toBe('inventory-location-15-1'))
    expect(screen.queryByText('Product 01')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Stock notifications, 15 unresolved warnings' }),
    ).toBeTruthy()
  })

  it('keeps warnings unresolved when read and refreshes them after stock/cache changes', async () => {
    const user = userEvent.setup()
    const openInventory = vi.fn()
    const { queryClient } = mount(<StockNotifications onOpenInventory={openInventory} />)
    await user.click(
      await screen.findByRole('button', { name: 'Stock notifications, 2 unresolved warnings' }),
    )
    const warning = await screen.findByRole('menuitem', { name: /Out of stock: Beta Mixed, Store/ })
    await waitFor(() => expect(warning.getAttribute('data-disabled')).toBeNull())
    await user.click(warning)
    expect(openInventory).toHaveBeenCalledWith({ productId: 2, warehouseId: 1 })
    expect(
      screen.getByRole('button', { name: 'Stock notifications, 2 unresolved warnings' }),
    ).toBeTruthy()
    stocks = stocks.map((s) => (s.inventoryItemId === 2 ? { ...s, quantity: '5' } : s))
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['stock-items'] })
    })
    await user.click(
      await screen.findByRole('button', { name: 'Stock notifications, 1 unresolved warnings' }),
    )
    expect(screen.queryByRole('menuitem', { name: /Beta Mixed/ })).toBeNull()
  })

  it('shows a recoverable error instead of zero alerts when stock loading fails', async () => {
    failStock = true
    const user = userEvent.setup()
    mount(<StockNotifications onOpenInventory={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: 'Stock notifications unavailable' }))
    expect(await screen.findByText('Stock warnings could not be loaded.')).toBeTruthy()
    expect(screen.queryByText('No out-of-stock locations found.')).toBeNull()
    failStock = false
    await user.click(screen.getByRole('menuitem', { name: 'Retry loading warnings' }))
    expect(await screen.findByRole('menuitem', { name: /Out of stock: Alpha Empty/ })).toBeTruthy()
  })

  it('handles removed/archived notification targets safely and keeps staff access read-only', async () => {
    auth.isAdmin = false
    auth.isStaff = true
    mount(<InventoryHub focusTarget={{ productId: 5, warehouseId: 1 }} />)
    expect(
      await screen.findByText(
        'This product is archived or no longer available. Browse active inventory below.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Register Product' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull()
    expect(screen.getByRole('button', { name: /^Archived/ })).toBeTruthy()
  })

  it('keeps archive errors open for retry and preserves archived stock links and restoration', async () => {
    failArchive = true
    const user = userEvent.setup()
    mount(<InventoryHub />)
    const row = (await screen.findByText('Alpha Empty')).closest('tr')!
    await user.click(within(row).getAllByRole('button', { name: 'Archive' })[0])
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive Item' }),
    )
    expect(await screen.findByText('Archive failed.')).toBeTruthy()
    failArchive = false
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Archive Item' }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await user.click(screen.getByRole('button', { name: /^Archived/ }))
    await user.click(
      await screen.findByRole('button', { name: 'Show stock by location for Alpha Empty' }),
    )
    expect(screen.getByRole('region', { name: 'Stock by location for Alpha Empty' })).toBeTruthy()
    const archivedRow = screen.getByText('Alpha Empty').closest('tr')!
    await user.click(within(archivedRow).getAllByRole('button', { name: 'Restore' })[0])
    await waitFor(() => expect(screen.queryByText('Alpha Empty')).toBeNull())
    await user.click(screen.getByRole('button', { name: /^Active/ }))
    expect(await screen.findByText('Alpha Empty')).toBeTruthy()
  })
})
