import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { StockAlertSettings } from './StockAlertSettings'
import { InventoryHub } from './InventoryHub'
import { StockNotifications } from '@/components/layout/StockNotifications'
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const dates = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
const warehouses = [
  { id: 1, name: 'Store', isActive: true, address: '', contactNumber: null, ...dates },
  { id: 2, name: 'Main Warehouse', isActive: true, address: '', contactNumber: null, ...dates },
]
const products = [
  {
    id: 10,
    name: 'Banana',
    unit: 'kg',
    isActive: true,
    unitPrice: '1.00',
    variety: null,
    description: '',
    ...dates,
  },
  {
    id: 20,
    name: 'Mango',
    unit: 'boxes',
    isActive: true,
    unitPrice: '2.00',
    variety: null,
    description: '',
    ...dates,
  },
  {
    id: 30,
    name: 'Coconut',
    unit: 'kg',
    isActive: true,
    unitPrice: '3.00',
    variety: null,
    description: '',
    ...dates,
  },
]
let stocks: StockItemWithRelations[]
let requests: { method: string; url: string; body: Record<string, unknown> }[]
let failure: number | 'network' | undefined
let failId: number
let loadFailure: boolean
let gate: Promise<void> | undefined
let malformedSave: boolean
let savedThreshold: string | undefined
const originalAdapter = apiClient.defaults.adapter
const input = (name = 'Banana') =>
  screen.getByRole('textbox', { name: `Reorder threshold for ${name}` }) as HTMLInputElement
const save = (name = 'Banana') =>
  screen.getByRole('button', { name: `Save threshold for ${name}` }) as HTMLButtonElement
const patches = () => requests.filter((request) => request.method === 'patch')
function mount(ui = <StockAlertSettings onClose={vi.fn()} />) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return { ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>), client }
}
beforeEach(() => {
  auth.isAdmin = true
  auth.isManager = false
  auth.isStaff = false
  failure = undefined
  failId = 101
  gate = undefined
  loadFailure = false
  malformedSave = false
  savedThreshold = undefined
  requests = []
  stocks = [
    {
      id: 101,
      inventoryItemId: 10,
      warehouseId: 1,
      inventoryItem: products[0],
      warehouse: warehouses[0],
      quantity: '25.25',
      reservedQuantity: '4',
      damagedQuantity: '4.25',
      availableQuantity: '17.00',
      reorderThreshold: '5.25',
      stockStatus: 'NORMAL',
      ...dates,
    },
    {
      id: 102,
      inventoryItemId: 20,
      warehouseId: 1,
      inventoryItem: products[1],
      warehouse: warehouses[0],
      quantity: '0',
      availableQuantity: '0',
      reorderThreshold: null,
      stockStatus: 'OUT',
      ...dates,
    },
    {
      id: 201,
      inventoryItemId: 30,
      warehouseId: 2,
      inventoryItem: products[2],
      warehouse: warehouses[1],
      quantity: '9999999999.99',
      availableQuantity: '9999999999.99',
      reorderThreshold: null,
      stockStatus: 'UNCONFIGURED',
      ...dates,
    },
  ]
  vi.spyOn(toast, 'success').mockReturnValue('success')
  vi.spyOn(toast, 'error').mockReturnValue('error')
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    const method = config.method ?? 'get'
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})
    requests.push({ method, url, body })
    let data: unknown = []
    if (method === 'get') {
      if (loadFailure && url.startsWith('/stock-items/warehouses/'))
        throw { isAxiosError: true, response: { status: 503, data: { message: 'Unavailable' } } }
      data =
        url === '/warehouses'
          ? warehouses
          : url === '/inventory-items'
            ? products
            : url === '/stock-items'
              ? stocks
              : url.startsWith('/stock-items/warehouses/')
                ? stocks.filter((row) => row.warehouseId === Number(url.split('/').at(-1)))
                : []
    } else if (method === 'patch') {
      await gate
      const id = Number(url.split('/')[2])
      if (id === failId && failure)
        throw {
          isAxiosError: true,
          response:
            failure === 'network'
              ? undefined
              : {
                  status: failure,
                  data: {
                    message:
                      failure === 400
                        ? 'Threshold exceeds the permitted value.'
                        : 'Request rejected',
                  },
                },
        }
      const row = stocks.find((row) => row.id === id)!
      row.reorderThreshold = savedThreshold ?? (body.reorderThreshold as string | null)
      // Test server responses, consumed through real API services and query caches.
      row.stockStatus =
        row.availableQuantity === '0'
          ? 'OUT'
          : row.reorderThreshold === null
            ? 'UNCONFIGURED'
            : 'LOW'
      data = malformedSave ? { id } : row
    }
    return { config, data: structuredClone(data), status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

it('opens from the Inventory heading without replacing product filters or the primary action', async () => {
  const user = userEvent.setup()
  mount(<InventoryHub />)
  await screen.findByText('Banana')
  expect(screen.getByRole('button', { name: /^Active/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Register Product/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Quarantined Stock' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Stock Alert Settings' }))
  const dialog = screen.getByRole('dialog', { name: 'Stock Alert Settings' })
  expect(
    within(dialog)
      .getAllByRole('columnheader')
      .map((header) => header.textContent),
  ).toEqual(['Product', 'Available', 'Reorder Threshold'])
  expect(await within(dialog).findByDisplayValue('5.25')).toBeTruthy()
})

it('loads exact values and units, switches warehouse stock and retains drafts when switching back', async () => {
  const user = userEvent.setup()
  mount()
  await screen.findByDisplayValue('5.25')
  expect(screen.getByText('kg')).toBeTruthy()
  expect(screen.getByText('17')).toBeTruthy()
  fireEvent.change(input(), { target: { value: '18.01' } })
  await user.click(screen.getByRole('button', { name: 'Stock alert warehouse' }))
  await user.click(screen.getByRole('menuitem', { name: 'Main Warehouse' }))
  expect(await screen.findByText('Coconut')).toBeTruthy()
  expect(screen.queryByText('Banana')).toBeNull()
  expect(screen.getByText('9,999,999,999.99')).toBeTruthy()
  expect(input('Coconut').value).toBe('')
  await user.click(screen.getByRole('button', { name: 'Stock alert warehouse' }))
  await user.click(screen.getByRole('menuitem', { name: 'Store' }))
  expect(input().value).toBe('18.01')
})

it('persists the stock-item ID and exact string, prevents duplicate saves and refreshes shared caches', async () => {
  let release!: () => void
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const onClose = vi.fn()
  const { client } = mount(<StockAlertSettings onClose={onClose} />)
  client.setQueryData(['stock-items', 'item', 10], [])
  client.setQueryData(['products', 'detail', 10], products[0])
  client.setQueryData(['warehouses', 'detail', 1], warehouses[0])
  await screen.findByDisplayValue('5.25')
  fireEvent.change(input(), { target: { value: '9999999999.99' } })
  fireEvent.submit(save().closest('form')!)
  fireEvent.submit(save().closest('form')!)
  await waitFor(() => expect(patches()).toHaveLength(1))
  expect(patches()[0]).toEqual({
    method: 'patch',
    url: '/stock-items/101/reorder-threshold',
    body: { reorderThreshold: '9999999999.99' },
  })
  expect(save().disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Done' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Close' }).hasAttribute('disabled')).toBe(true)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  await act(async () => release())
  await screen.findByText('Saved')
  expect(input().value).toBe('9999999999.99')
  expect(stocks[0].reorderThreshold).toBe('9999999999.99')
  expect(save().disabled).toBe(true)
  for (const key of [
    ['stock-items', 'item', 10],
    ['products', 'detail', 10],
    ['warehouses', 'detail', 1],
  ])
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  expect(requests.filter((request) => request.url === '/stock-items/warehouses/1')).toHaveLength(2)
})

it('supports clearing a configured threshold with null and setting an unset threshold to zero', async () => {
  const user = userEvent.setup()
  mount()
  await screen.findByDisplayValue('5.25')
  await user.clear(input())
  await user.click(save())
  await screen.findByText('Saved')
  expect(patches()[0].body.reorderThreshold).toBeNull()
  expect(stocks[0].reorderThreshold).toBeNull()
  fireEvent.change(input('Mango'), { target: { value: '0.00' } })
  await user.click(save('Mango'))
  await waitFor(() => expect(screen.getAllByText('Saved')).toHaveLength(2))
  expect(patches()[1].body.reorderThreshold).toBe('0.00')
})

it.each(['-1', 'abc', '1.001', '1e2', '10000000000'])(
  'rejects invalid threshold %s without a request or losing input',
  async (value) => {
    mount()
    await screen.findByDisplayValue('5.25')
    fireEvent.change(input(), { target: { value } })
    fireEvent.submit(save().closest('form')!)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(input().value).toBe(value)
    expect(patches()).toHaveLength(0)
    expect(toast.success).not.toHaveBeenCalled()
  },
)

it.each([400, 403, 404, 409, 'network'] as const)(
  'retains failed input and reports a %s failure without success or automatic retries',
  async (status) => {
    failure = status
    const user = userEvent.setup()
    mount()
    await screen.findByDisplayValue('5.25')
    fireEvent.change(input(), { target: { value: '18.25' } })
    await user.click(save())
    await screen.findByRole('alert')
    expect(input().value).toBe('18.25')
    expect(stocks[0].reorderThreshold).toBe('5.25')
    expect(patches()).toHaveLength(1)
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.queryByText('Saved')).toBeNull()
    failure = undefined
    await user.click(save())
    expect(await screen.findByText('Saved')).toBeTruthy()
  },
)

it('reports partial success per row while preserving the other failed draft during refetch', async () => {
  failure = 409
  failId = 102
  const user = userEvent.setup()
  mount()
  await screen.findByDisplayValue('5.25')
  fireEvent.change(input('Mango'), { target: { value: '10.10' } })
  await user.click(save('Mango'))
  await screen.findByRole('alert')
  fireEvent.change(input(), { target: { value: '18.25' } })
  await user.click(save())
  expect(await within(input().closest('tr')!).findByText('Saved')).toBeTruthy()
  expect(within(input('Mango').closest('tr')!).getByRole('alert')).toBeTruthy()
  expect(input('Mango').value).toBe('10.10')
  expect(stocks[1].reorderThreshold).toBeNull()
  expect(toast.success).toHaveBeenCalledTimes(1)
})

it('keeps unauthorized users read-only while allowing manager edits', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  const view = mount()
  expect(await screen.findByText('5.25')).toBeTruthy()
  expect(screen.getByText(/View only/)).toBeTruthy()
  expect(screen.queryByRole('textbox', { name: /Reorder threshold/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Save threshold/ })).toBeNull()
  expect(screen.getByText('Not configured')).toBeTruthy()
  auth.isManager = true
  view.rerender(
    <QueryClientProvider client={view.client}>
      <StockAlertSettings onClose={vi.fn()} />
    </QueryClientProvider>,
  )
  fireEvent.change(input(), { target: { value: '18.25' } })
  fireEvent.submit(save().closest('form')!)
  expect(await screen.findByText('Saved')).toBeTruthy()
})

it('refreshes actual warning counts and tabs after a save and excludes UNCONFIGURED', async () => {
  const user = userEvent.setup()
  mount(
    <>
      <InventoryHub />
      <StockNotifications onOpenInventory={vi.fn()} />
    </>,
  )
  await screen.findByRole('button', { name: /1 unresolved/ })
  await user.click(screen.getByRole('button', { name: 'Stock Alert Settings' }))
  await screen.findByDisplayValue('5.25')
  fireEvent.change(input(), { target: { value: '18.25' } })
  await user.click(save())
  await screen.findByText('Saved')
  await user.click(screen.getByRole('button', { name: 'Done' }))
  await user.click(await screen.findByRole('button', { name: /2 unresolved/ }))
  expect(screen.getByRole('menuitem', { name: /Low stock: Banana/ })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: /Out of stock: Mango/ })).toBeTruthy()
  expect(screen.queryByRole('menuitem', { name: /Coconut/ })).toBeNull()
  await user.click(screen.getByRole('menuitemradio', { name: 'Low stock' }))
  expect(screen.getByRole('menuitem', { name: /Low stock: Banana/ })).toBeTruthy()
  expect(screen.queryByRole('menuitem', { name: /Out of stock: Mango/ })).toBeNull()
  await user.click(screen.getByRole('menuitemradio', { name: 'Out of stock' }))
  expect(screen.queryByRole('menuitem', { name: /Low stock: Banana/ })).toBeNull()
  expect(screen.getByRole('menuitem', { name: /Out of stock: Mango/ })).toBeTruthy()
})

it('provides a recoverable load error and an honest empty warehouse state', async () => {
  loadFailure = true
  const user = userEvent.setup()
  mount()
  expect(await screen.findByRole('alert')).toBeTruthy()
  loadFailure = false
  stocks = []
  await user.click(screen.getByRole('button', { name: 'Refresh stock list' }))
  expect(await screen.findByText('No products in this warehouse.')).toBeTruthy()
  expect(screen.queryByRole('textbox', { name: /Reorder threshold/ })).toBeNull()
})

it('uses the confirmed server value and never claims success for an incomplete save response', async () => {
  const user = userEvent.setup()
  mount()
  await screen.findByDisplayValue('5.25')
  savedThreshold = '18.20'
  fireEvent.change(input(), { target: { value: '18.2' } })
  await user.click(save())
  await screen.findByText('Saved')
  expect(input().value).toBe('18.20')
  malformedSave = true
  savedThreshold = undefined
  fireEvent.change(input(), { target: { value: '19.25' } })
  await user.click(save())
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(input().value).toBe('19.25')
  expect(screen.queryByText('Saved')).toBeNull()
  expect(toast.success).toHaveBeenCalledTimes(1)
})

it('retains drafts across pagination and keeps long product labels as text in existing overflow controls', async () => {
  const user = userEvent.setup()
  const longName = ('Long product <script>alert(1)</script> ' + 'name '.repeat(40)).trim()
  stocks[0].inventoryItem = { ...stocks[0].inventoryItem, name: longName }
  stocks.push(
    ...Array.from({ length: 11 }, (_, index) => ({
      ...stocks[1],
      id: 300 + index,
      inventoryItem: { ...stocks[1].inventoryItem, name: `Product ${index}` },
    })),
  )
  mount()
  await screen.findByDisplayValue('5.25')
  expect(screen.getByText(longName.trim()).classList.contains('truncate')).toBe(true)
  expect(document.querySelector('script')).toBeNull()
  fireEvent.change(input(longName), { target: { value: '18.25' } })
  await user.click(screen.getByRole('button', { name: 'Next Page' }))
  expect(screen.queryByRole('textbox', { name: `Reorder threshold for ${longName}` })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Previous Page' }))
  expect(input(longName).value).toBe('18.25')
  expect(patches()).toHaveLength(0)
})
