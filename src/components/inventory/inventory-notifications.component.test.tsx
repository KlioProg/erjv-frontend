import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation, useNavigate } from 'react-router'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { AppRoutes } from '@/routing/AppRoutes'
import { InventoryHub } from './InventoryHub'
import { WarehouseList } from '@/components/operations/WarehouseList'
import { WarehouseInventory } from '@/components/operations/WarehouseInventory'
import { StockNotifications } from '@/components/layout/StockNotifications'
import { useCompleteIncomingDelivery } from '@/features/logistics/incoming-deliveries.hooks'
import { useCompleteOutgoingDelivery } from '@/features/logistics/outgoing-deliveries.hooks'
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
let failPrice: boolean
let priceGate: Promise<void> | undefined
let requests: { method: string; url: string; body: Record<string, unknown> }[]
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
function mountDashboard(initialEntry = '/') {
  function LocationControls() {
    const location = useLocation()
    const navigate = useNavigate()
    return (
      <>
        <output data-testid="route-location">{location.pathname}</output>
        <button type="button" onClick={() => navigate(-1)}>
          Test browser back
        </button>
        <button type="button" onClick={() => navigate(1)}>
          Test browser forward
        </button>
      </>
    )
  }
  return mount(
    <MemoryRouter initialEntries={[initialEntry]}>
      <AppRoutes />
      <LocationControls />
    </MemoryRouter>,
  )
}
beforeEach(() => {
  warehouses[1].isActive = true
  failPrice = false
  priceGate = undefined
  requests = []
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
    requests.push({ method, url, body })
    let data: unknown = []
    if (method === 'get') {
      if ((url === '/stock-items' || url.startsWith('/stock-items/warehouses/')) && failStock)
        throw {
          isAxiosError: true,
          response: { status: 503, data: { message: 'Stock unavailable' } },
        }
      data =
        url === '/inventory-items'
          ? products.filter((p) => config.params?.includeInactive === 'true' || p.isActive)
          : url === '/stock-items'
            ? stocks
            : url.startsWith('/stock-items/warehouses/')
              ? stocks.filter((s) => s.warehouseId === Number(url.split('/')[3]))
              : url === '/warehouses'
                ? warehouses.filter((w) => w.isActive)
                : []
    } else if (
      url === '/incoming-deliveries/1/complete' ||
      url === '/outgoing-deliveries/1/complete'
    ) {
      stocks = stocks.map((item) =>
        item.id === 1 ? { ...item, quantity: url.startsWith('/incoming') ? '5' : '0' } : item,
      )
      data = { id: 1, deliveryNumber: 'TEST-MOVEMENT' }
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
      if (url.endsWith('/unit-price')) {
        if (priceGate) await priceGate
        if (failPrice)
          throw {
            isAxiosError: true,
            response: { status: 409, data: { message: 'Price update rejected' } },
          }
      }
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
  it('lets keyboard users change the warehouse and return to warning categories', async () => {
    const user = userEvent.setup()
    mount(<StockNotifications onOpenInventory={vi.fn()} />)
    const bell = await screen.findByRole('button', { name: /2 unresolved/ })
    bell.focus()
    await user.keyboard('{Enter}')
    const selector = screen.getByRole('combobox', { name: 'Warning warehouse' })
    expect(document.activeElement).toBe(selector)
    await user.keyboard('{ArrowDown}{End}{Enter}')
    expect(selector.textContent).toContain('Main Warehouse')
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('menuitemradio', { name: 'All warnings' }))
    await user.tab({ shift: true })
    expect(document.activeElement).toBe(selector)
  })

  it('refreshes notifications after receiving and outgoing completion through the existing mutation hooks', async () => {
    function Movements() {
      const receive = useCompleteIncomingDelivery()
      const deliver = useCompleteOutgoingDelivery()
      return (
        <>
          <button onClick={() => receive.mutate(1)}>Test receive</button>
          <button onClick={() => deliver.mutate(1)}>Test complete delivery</button>
          <StockNotifications onOpenInventory={vi.fn()} />
        </>
      )
    }
    const user = userEvent.setup()
    mount(<Movements />)
    await screen.findByRole('button', { name: /2 unresolved/ })
    await user.click(screen.getByRole('button', { name: 'Test receive' }))
    await screen.findByRole('button', { name: /1 unresolved/ })
    await user.click(screen.getByRole('button', { name: 'Test complete delivery' }))
    await screen.findByRole('button', { name: /2 unresolved/ })
    expect(requests.some((request) => request.url === '/incoming-deliveries/1/complete')).toBe(true)
    expect(requests.some((request) => request.url === '/outgoing-deliveries/1/complete')).toBe(true)
  })

  it('hides the warehouse selector for one active warehouse and provides honest empty category states', async () => {
    warehouses[1].isActive = false
    stocks = stocks.map((item) => ({ ...item, quantity: '50', reservedQuantity: '50' }))
    const user = userEvent.setup()
    mount(<StockNotifications onOpenInventory={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: /0 unresolved/ }))
    expect(screen.queryByRole('combobox', { name: 'Warning warehouse' })).toBeNull()
    expect(screen.getByRole('status').textContent).toContain('No stock warnings')
    await user.click(screen.getByRole('menuitemradio', { name: 'Out of stock' }))
    expect(screen.getByRole('status').textContent).toContain('No out-of-stock items')
    await user.click(screen.getByRole('menuitemradio', { name: 'Low stock' }))
    expect(screen.getByRole('status').textContent).toContain(
      'without configured reorder thresholds',
    )
  })

  it('filters warnings by active warehouse and opens Inventory with the same warning scope', async () => {
    stocks.push(stock(10, 3, 2, '0'))
    const user = userEvent.setup()
    mountDashboard('/customers')
    await user.click(
      await screen.findByRole('button', { name: /Stock notifications, 3 unresolved/ }),
    )
    await user.click(screen.getByRole('combobox', { name: 'Warning warehouse' }))
    await user.click(await screen.findByRole('option', { name: 'Main Warehouse' }))
    expect(screen.queryByRole('menuitem', { name: /Out of stock: Beta Mixed/ })).toBeNull()
    expect(
      screen.getByRole('menuitem', { name: /Out of stock: Gamma Small, Main Warehouse/ }),
    ).toBeTruthy()
    await user.click(screen.getByRole('menuitem', { name: 'View All' }))
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(screen.getByRole('combobox', { name: 'Warning warehouse' }).textContent).toContain(
      'Main Warehouse',
    )
    expect(screen.queryByText('Beta Mixed')).toBeNull()
    expect(screen.getByRole('region', { name: 'Stock by location for Gamma Small' })).toBeTruthy()
  })

  it('limits the warning preview and distinguishes unavailable thresholds from zero stock', async () => {
    products = Array.from({ length: 9 }, (_, i) => product(i + 1, `Warning ${i + 1}`))
    stocks = products.map((p) => stock(p.id, p.id, 1, '0'))
    const user = userEvent.setup()
    mount(<StockNotifications onOpenInventory={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: /9 unresolved/ }))
    expect(screen.getAllByRole('menuitem', { name: /Out of stock:/ })).toHaveLength(6)
    expect(screen.getByText('Showing 6 of 9 warnings')).toBeTruthy()
    await user.click(screen.getByRole('menuitemradio', { name: 'Low stock' }))
    expect(screen.getByRole('status').textContent).toContain('No low-stock items')
    expect(screen.getByText(/Low-stock detection is unavailable/)).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: /Out of stock:/ })).toBeNull()
  })

  it('shows warehouse-specific and overall empty states without fabricating unallocated stock', async () => {
    const user = userEvent.setup()
    mount(<StockNotifications onOpenInventory={vi.fn()} />)
    await user.click(await screen.findByRole('button', { name: /2 unresolved/ }))
    await user.click(screen.getByRole('combobox', { name: 'Warning warehouse' }))
    await user.click(await screen.findByRole('option', { name: 'Main Warehouse' }))
    expect(screen.getByRole('status').textContent).toContain(
      'No warnings for the selected warehouse',
    )
  })

  it('edits only the wholesale price inline, validates decimals and saves exact zero with Enter', async () => {
    const user = userEvent.setup()
    products[0].unit = 'piece'
    mount(<InventoryHub />)
    const edit = await screen.findByRole('button', { name: 'Edit wholesale price for Alpha Empty' })
    expect(screen.queryByText(/per\s+piece\(s\)/i)).toBeNull()
    await user.click(edit)
    const input = screen.getByRole('textbox', { name: 'Wholesale price for Alpha Empty' })
    const save = screen.getByRole('button', { name: 'Save wholesale price for Alpha Empty' })
    for (const invalid of ['', '-1', '1.234', '10000000000']) {
      fireEvent.change(input, { target: { value: invalid } })
      await user.click(save)
      expect(screen.getByRole('alert').textContent).toContain('Enter a non-negative price')
    }
    expect(requests.filter((request) => request.method === 'patch')).toHaveLength(0)
    await user.clear(input)
    await user.type(input, '0.00{Enter}')
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Wholesale price for Alpha Empty' })).toBeNull(),
    )
    expect(requests.filter((request) => request.method === 'patch')).toEqual([
      { method: 'patch', url: '/inventory-items/1/unit-price', body: { unitPrice: '0.00' } },
    ])
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit wholesale price for Alpha Empty' }).textContent,
      ).toContain('₱0.00'),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('retains an inline price on API failure, retries once and blocks duplicate pending submits', async () => {
    const user = userEvent.setup()
    mount(<InventoryHub />)
    await user.click(
      await screen.findByRole('button', { name: 'Edit wholesale price for Alpha Empty' }),
    )
    const input = screen.getByRole('textbox', { name: 'Wholesale price for Alpha Empty' })
    await user.clear(input)
    await user.type(input, '92.75')
    failPrice = true
    await user.click(screen.getByRole('button', { name: 'Save wholesale price for Alpha Empty' }))
    await screen.findByText('Price update rejected.')
    expect((input as HTMLInputElement).value).toBe('92.75')
    failPrice = false
    let finish!: () => void
    priceGate = new Promise<void>((resolve) => {
      finish = resolve
    })
    const form = input.closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(input.matches(':disabled')).toBe(true))
    expect(
      screen
        .getByRole('button', { name: 'Cancel price edit for Alpha Empty' })
        .matches(':disabled'),
    ).toBe(true)
    await waitFor(() =>
      expect(
        requests.filter((request) => request.url === '/inventory-items/1/unit-price'),
      ).toHaveLength(2),
    )
    await act(async () => {
      finish()
    })
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: 'Wholesale price for Alpha Empty' })).toBeNull(),
    )
    expect(
      requests.filter((request) => request.url === '/inventory-items/1/unit-price'),
    ).toHaveLength(2)
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Edit wholesale price for Alpha Empty' }).textContent,
      ).toContain('₱92.75'),
    )
  })

  it('cancels price edits with Escape and keeps archived or staff prices read-only', async () => {
    const user = userEvent.setup()
    const view = mount(<InventoryHub />)
    await user.click(
      await screen.findByRole('button', { name: 'Edit wholesale price for Alpha Empty' }),
    )
    await user.clear(screen.getByRole('textbox', { name: 'Wholesale price for Alpha Empty' }))
    await user.keyboard('45{Escape}')
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe(
        'Edit wholesale price for Alpha Empty',
      ),
    )
    expect(requests.filter((request) => request.method === 'patch')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: /Archived/ }))
    await screen.findByText('Archived Product')
    expect(screen.queryByRole('button', { name: /Edit wholesale price/ })).toBeNull()
    view.unmount()
    auth.isAdmin = false
    auth.isManager = false
    auth.isStaff = true
    mount(<InventoryHub />)
    await screen.findByText('Alpha Empty')
    expect(screen.queryByRole('button', { name: /Edit wholesale price/ })).toBeNull()
  })

  it('prioritizes empty and low warehouse stock before pagination without a status column', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    products = [
      product(1, 'Alpha Healthy'),
      product(2, 'Zulu Empty'),
      product(3, 'Yield Low'),
      product(4, 'Omega Fractional'),
      product(5, 'Delta Unknown'),
      ...Array.from({ length: 11 }, (_, i) => product(i + 6, `Healthy ${i}`)),
    ]
    stocks = [
      stock(1, 1, 1, '20.01'),
      stock(2, 2, 1, '0'),
      stock(3, 3, 1, '20'),
      stock(4, 4, 1, '0.05'),
      stock(5, 5, 1, 'bad'),
      ...Array.from({ length: 11 }, (_, i) => stock(i + 6, i + 6, 1, '100')),
    ]
    mount(<WarehouseInventory warehouse={warehouses[0]} onBack={onBack} />)
    await screen.findByText('Zulu Empty')
    const table = screen.getByRole('table')
    const visibleRows = () => within(table).getAllByRole('row').slice(1)
    expect(within(table).getAllByRole('columnheader')).toHaveLength(3)
    expect(screen.queryByRole('columnheader', { name: 'Status' })).toBeNull()
    expect(visibleRows()).toHaveLength(10)
    expect(
      visibleRows()
        .slice(0, 4)
        .map((row) => within(row).getAllByRole('cell')[0].textContent),
    ).toEqual(['Zulu Empty', 'Omega Fractional', 'Yield Low', 'Alpha Healthy'])
    expect(screen.getByRole('img', { name: 'Out of stock: Zulu Empty in Store' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Low stock: Yield Low in Store' })).toBeTruthy()
    expect(within(visibleRows()[1]).getByText('0.05')).toBeTruthy()
    expect(within(visibleRows()[3]).queryByRole('img')).toBeNull()
    expect(screen.queryByText('In Stock')).toBeNull()

    const search = screen.getByRole('textbox', { name: 'Search warehouse products' })
    await user.type(search, 'Delta Unknown')
    expect(visibleRows()).toHaveLength(1)
    expect(within(visibleRows()[0]).queryByRole('img')).toBeNull()
    await user.clear(search)
    await user.click(within(table).getByRole('button', { name: 'Product' }))
    expect(within(visibleRows()[0]).getByText('Alpha Healthy')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Back to Warehouses' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('keeps warehouse stock failures recoverable rather than showing empty-stock warnings', async () => {
    failStock = true
    const user = userEvent.setup()
    mount(<WarehouseInventory warehouse={warehouses[0]} onBack={vi.fn()} />)
    expect((await screen.findByRole('alert')).textContent).toContain(
      'Warehouse stock could not be loaded:',
    )
    expect(screen.queryByRole('img', { name: /Out of stock/ })).toBeNull()
    failStock = false
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('Alpha Empty')).toBeTruthy()
  })

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
    mountDashboard()
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
    ).getByRole('link', { name: 'Inventory' })
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
    expect(locations.queryByText(/^(Total:|Product total)/)).toBeNull()
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
      stock(p.id * 2, p.id, 1, p.id === 15 ? '0' : '1'),
      stock(p.id * 2 + 1, p.id, 2, '100'),
    ])
    const user = userEvent.setup()
    mountDashboard()
    await screen.findByText('Product 01')
    await user.click(
      within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('link', {
        name: 'Customers',
      }),
    )
    await user.click(
      await screen.findByRole('button', { name: /Stock notifications, 1 unresolved/ }),
    )
    const alert = await screen.findByRole('menuitem', { name: /Out of stock: Product 15, Store/ })
    await waitFor(() => expect(alert.getAttribute('data-disabled')).toBeNull())
    await user.click(alert)
    const region = await screen.findByRole('region', { name: 'Stock by location for Product 15' })
    expect(within(region).getByRole('img', { name: 'Out of stock at Store' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement?.id).toBe('inventory-location-15-1'))
    expect(screen.queryByText('Product 01')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Stock notifications, 1 unresolved warnings' }),
    ).toBeTruthy()
  })

  it('uses the pilot URLs for customers and sales orders while keeping the dashboard shell mounted', async () => {
    const user = userEvent.setup()
    mountDashboard('/customers')

    await screen.findByRole('heading', { name: 'Customers' })
    const mainNavigation = screen.getByRole('navigation', { name: 'Main navigation' })
    const customersLink = within(mainNavigation).getByRole('link', { name: 'Customers' })
    expect(screen.getByTestId('route-location').textContent).toBe('/customers')
    expect(customersLink.getAttribute('aria-current')).toBe('page')

    await user.click(within(mainNavigation).getByRole('link', { name: 'Sales Orders' }))
    await screen.findByRole('heading', { name: 'Sales Orders' })
    expect(screen.getByTestId('route-location').textContent).toBe('/sales-orders')
    expect(
      within(mainNavigation)
        .getByRole('link', { name: 'Sales Orders' })
        .getAttribute('aria-current'),
    ).toBe('page')
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBe(mainNavigation)

    await user.click(screen.getByRole('button', { name: 'Test browser back' }))
    await screen.findByRole('heading', { name: 'Customers' })
    expect(screen.getByTestId('route-location').textContent).toBe('/customers')

    await user.click(screen.getByRole('button', { name: 'Test browser forward' }))
    await screen.findByRole('heading', { name: 'Sales Orders' })
    expect(screen.getByTestId('route-location').textContent).toBe('/sales-orders')
  })

  it('provides a safe destination for unknown paths', async () => {
    const user = userEvent.setup()
    mountDashboard('/not-a-page')
    await screen.findByRole('heading', { name: 'Page not found' })
    await user.click(screen.getByRole('link', { name: 'Go to home' }))
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(screen.getByTestId('route-location').textContent).toBe('/inventory')
  })

  it('redirects staff away from staffing URLs', async () => {
    auth.isAdmin = false
    auth.isStaff = true
    mountDashboard('/legacy/employees')
    await screen.findByRole('heading', { name: 'Inventory' })
    expect(screen.getByTestId('route-location').textContent).toBe('/inventory')
    expect(screen.queryByRole('heading', { name: 'Staff Directory' })).toBeNull()
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

describe('warehouse product expansion', () => {
  it('keeps expansion attached to warehouse IDs through sorting, pagination and search', async () => {
    const user = userEvent.setup()
    const adapter = apiClient.defaults.adapter as import('axios').AxiosAdapter
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/warehouses')
        return {
          data: Array.from({ length: 12 }, (_, index) =>
            location(index + 1, `Warehouse ${String(index + 1).padStart(2, '0')}`),
          ).reverse(),
          status: 200,
          statusText: 'OK',
          headers: {},
          config,
        }
      return adapter(config)
    }
    mount(<WarehouseList onOpenWarehouse={vi.fn()} />)
    await screen.findByRole('button', { name: 'Show products for Warehouse 12' })
    const table = screen.getByRole('table')
    await user.click(screen.getByRole('button', { name: 'Warehouse' }))
    expect(within(table).getAllByRole('row')[1].textContent).toContain('Warehouse 01')
    await user.click(screen.getByRole('button', { name: 'Show products for Warehouse 01' }))
    const region = await screen.findByRole('region', { name: 'Products at Warehouse 01' })
    await within(region).findByText('Alpha Empty')
    await user.click(screen.getByRole('button', { name: 'Next Page' }))
    expect(screen.queryByRole('region', { name: 'Products at Warehouse 01' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Show products for Warehouse 11' })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Previous Page' }))
    expect(await screen.findByRole('region', { name: 'Products at Warehouse 01' })).toBeTruthy()
    const search = screen.getByRole('textbox', { name: 'Search warehouses' })
    await user.type(search, 'Warehouse 02')
    expect(screen.queryByRole('region', { name: 'Products at Warehouse 01' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Show products for Warehouse 02' })).toBeTruthy()
    await user.clear(search)
    expect(await screen.findByRole('region', { name: 'Products at Warehouse 01' })).toBeTruthy()
  })

  it('loads only expanded warehouses, preserves independent expansion and displays exact units and quantities', async () => {
    const user = userEvent.setup()
    stocks = [stock(1, 1, 1, '3429.25'), stock(2, 2, 1, '158'), stock(3, 3, 2, '0')]
    stocks[1].inventoryItem.unit = 'pieces'
    const openWarehouse = vi.fn()
    mount(<WarehouseList onOpenWarehouse={openWarehouse} />)
    const store = await screen.findByRole('button', { name: 'Show products for Store' })
    expect(requests.some((r) => r.url.startsWith('/stock-items/warehouses/'))).toBe(false)
    store.focus()
    await user.keyboard('{Enter}')
    const region = await screen.findByRole('region', { name: 'Products at Store' })
    expect(await within(region).findByText('3,429.25')).toBeTruthy()
    expect(within(region).getByRole('heading', { name: 'Products at Store' })).toBeTruthy()
    expect(within(region).queryByText(/Total products:/)).toBeNull()
    expect(document.activeElement).toBe(store)
    expect(within(region).getByText('piece(s)')).toBeTruthy()
    expect(within(region).getByText('158')).toBeTruthy()
    expect(store.getAttribute('aria-expanded')).toBe('true')
    expect(store.getAttribute('aria-controls')).toBe(region.id)
    expect(openWarehouse).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Show products for Main Warehouse' }))
    const main = await screen.findByRole('region', { name: 'Products at Main Warehouse' })
    expect(await within(main).findByText('Gamma Small')).toBeTruthy()
    expect(within(main).getByText('0')).toBeTruthy()
    await user.click(store)
    expect(screen.queryByRole('region', { name: 'Products at Store' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Products at Main Warehouse' })).toBeTruthy()
    await user.click(screen.getByText('Store'))
    expect(openWarehouse).toHaveBeenCalledWith(1)
  })

  it('handles empty stock, loading and a failed request with retry', async () => {
    const user = userEvent.setup()
    stocks = []
    mount(<WarehouseList onOpenWarehouse={vi.fn()} />)
    const store = await screen.findByRole('button', { name: 'Show products for Store' })
    const adapter = apiClient.defaults.adapter as import('axios').AxiosAdapter
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/stock-items/warehouses/1') await gate
      return adapter(config)
    }
    failStock = true
    await user.click(store)
    const region = screen.getByRole('region', { name: 'Products at Store' })
    expect(within(region).getByRole('status').textContent).toContain('Loading products')
    expect(within(region).queryByText(/Total products:/)).toBeNull()
    await act(async () => release())
    expect(await within(region).findByRole('alert')).toBeTruthy()
    expect(within(region).queryByText(/Total products:/)).toBeNull()
    failStock = false
    await user.click(within(region).getByRole('button', { name: 'Retry' }))
    expect(await within(region).findByText('No products in this warehouse.')).toBeTruthy()
    expect(within(region).queryByText(/Total products:/)).toBeNull()
  })
})
