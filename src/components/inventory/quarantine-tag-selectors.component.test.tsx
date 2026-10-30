import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { ManualQuarantineDialog } from './ManualQuarantineDialog'

vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isStaff: true }) }))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
const warehouses = [
  { id: 2, name: 'Main', isActive: true },
  { id: 3, name: 'Other', isActive: true },
]
const stock = [7, 8, 9].map((id) => ({
  id,
  revision: 3,
  inventoryItemId: id === 8 ? 22 : 11,
  warehouseId: id === 9 ? 3 : 2,
  onHandQuantity: '10.00',
  inTransitQuantity: '0.00',
  quarantinedQuantity: '1.00',
  availableQuantity: '1.75',
  conditionQuantities: { DAMAGED: '1.00', SPOILED: '0.00' },
  reorderThreshold: null,
  stockStatus: 'UNCONFIGURED',
  createdAt: '',
  updatedAt: '',
  inventoryItem: { id: id === 8 ? 22 : 11, name: id === 8 ? 'Corn' : 'Rice', unit: 'kg' },
}))
function mount({
  selected,
  failure = '',
  empty = false,
  inactive = false,
  available = '1.75',
}: {
  selected?: number
  failure?: string
  empty?: boolean
  inactive?: boolean
  available?: string
} = {}) {
  let failing = failure
  const reads: { url: string; params: Record<string, unknown> }[] = []
  const writes: Record<string, unknown>[] = []
  const close = vi.fn()
  apiClient.defaults.adapter = async (config) => {
    const url = config.url!,
      params = config.params ?? {}
    if (config.method === 'post') {
      const body = JSON.parse(config.data)
      writes.push(body)
      return {
        config,
        data: { id: 101, ...body, initialQuantity: body.quantity, tagReason: body.reason },
        status: 201,
        statusText: '',
        headers: {},
      }
    }
    reads.push({ url, params: { ...params } })
    if (failing === url || (failing === 'INVALID_CURSOR' && params.cursor === 'stock-2'))
      throw new AxiosError('Unavailable', undefined, config, undefined, {
        config,
        status: 400,
        statusText: '',
        headers: {},
        data: {
          code: failing === 'INVALID_CURSOR' ? 'INVALID_CURSOR' : 'UNAVAILABLE',
          detail: 'Lookup failed.',
        },
      })
    let data: unknown
    if (url === '/warehouses')
      data = {
        items: params.q
          ? warehouses.filter((warehouse) => warehouse.name.includes(String(params.q)))
          : params.cursor
            ? warehouses
            : [warehouses[0]],
        nextCursor: params.q || params.cursor ? null : 'wh-2',
      }
    else if (url.startsWith('/warehouses/'))
      data = warehouses.find((warehouse) => warehouse.id === Number(url.split('/').pop()))
    else if (url.startsWith('/stock-items/warehouses/')) {
      const id = Number(url.split('/').pop())
      const matches = stock.filter((record) => record.warehouseId === id)
      data = {
        items: empty
          ? []
          : params.q
            ? matches.filter((record) => record.inventoryItem.name.includes(String(params.q)))
            : params.cursor || id === 3
              ? matches
              : matches.slice(0, 1),
        nextCursor: empty || params.q || params.cursor || id === 3 ? null : 'stock-2',
      }
    } else if (/^\/stock-items\/\d+$/.test(url))
      data = {
        ...stock.find((record) => record.id === Number(url.split('/').pop())),
        availableQuantity: available,
      }
    else if (url.startsWith('/inventory-items/')) {
      const id = Number(url.split('/').pop())
      data = {
        ...stock.find((record) => record.inventoryItemId === id)?.inventoryItem,
        isActive: !inactive,
      }
    } else throw Error(`Unexpected full collection request ${url}`)
    return { config, data, status: 200, statusText: '', headers: {} }
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <ManualQuarantineDialog stockItemId={selected} onClose={close} />
    </QueryClientProvider>,
  )
  return {
    reads,
    writes,
    close,
    recover: () => {
      failing = ''
    },
  }
}
async function warehouse(name = 'Main') {
  await userEvent.click(screen.getByRole('button', { name: 'Quarantine warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name }))
}
async function chooseStock(name = 'Rice \u00b7 stock #7') {
  await userEvent.click(screen.getByRole('button', { name: 'Quarantine product stock' }))
  await userEvent.click(await screen.findByRole('menuitem', { name }))
}
function fill(quantity = '0.25') {
  fireEvent.change(screen.getByLabelText('Inspection quantity'), { target: { value: quantity } })
  fireEvent.change(screen.getByLabelText('Inspection reason'), {
    target: { value: ' Inspection ' },
  })
}
const submit = () => screen.getByRole('button', { name: 'Quarantine stock' })

it('loads warehouse and warehouse-scoped stock pages on demand without duplicate options', async () => {
  const { reads } = mount()
  expect(
    screen.getByRole('button', { name: 'Quarantine product stock' }).hasAttribute('disabled'),
  ).toBe(true)
  await userEvent.click(screen.getByRole('button', { name: 'Quarantine warehouse' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Load more warehouses' }))
  await screen.findByRole('menuitem', { name: 'Other' })
  expect(screen.getAllByRole('menuitem', { name: 'Main' })).toHaveLength(1)
  expect(reads.find((read) => read.params.cursor === 'wh-2')?.params).toEqual({
    includeInactive: 'false',
    limit: 50,
    cursor: 'wh-2',
  })
  await userEvent.click(screen.getByRole('menuitem', { name: 'Main' }))
  await userEvent.click(screen.getByRole('button', { name: 'Quarantine product stock' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Load more stock records' }))
  await screen.findByRole('menuitem', { name: 'Corn \u00b7 stock #8' })
  expect(screen.getAllByRole('menuitem', { name: 'Rice \u00b7 stock #7' })).toHaveLength(1)
  expect(reads.find((read) => read.params.cursor === 'stock-2')).toEqual({
    url: '/stock-items/warehouses/2',
    params: { q: undefined, limit: 50, cursor: 'stock-2' },
  })
  await userEvent.click(screen.getByRole('menuitem', { name: 'Corn \u00b7 stock #8' }))
  await waitFor(() => expect(submit().hasAttribute('disabled')).toBe(false))
})

it('preserves an off-page selected stock across server search and submits its stock ID with exact decimals', async () => {
  const { reads, writes, close } = mount({ selected: 8 })
  await waitFor(() => expect(submit().hasAttribute('disabled')).toBe(false))
  expect(screen.getByRole('button', { name: 'Quarantine product stock' }).textContent).toContain(
    'Corn',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Quarantine product stock' }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Rice' } })
  await screen.findByRole('menuitem', { name: 'Rice \u00b7 stock #7' })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Nothing' } })
  await screen.findByText('No eligible stock records')
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Quarantine product stock' }).textContent).toContain(
    'Corn',
  )
  fill()
  fireEvent.change(screen.getByLabelText('Condition'), { target: { value: 'SPOILED' } })
  await userEvent.click(submit())
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toEqual([
    {
      stockItemId: 8,
      condition: 'SPOILED',
      quantity: '0.25',
      reason: 'Inspection',
      requestId: expect.any(String),
    },
  ])
  expect(
    reads.filter((read) => read.params.q).every((read) => read.params.cursor === undefined),
  ).toBe(true)
  expect(reads.some((read) => ['/stock-items', '/inventory-items'].includes(read.url))).toBe(false)
})

it('searches warehouses and clears dependent stock ID and quantity when warehouse changes', async () => {
  const { writes, reads } = mount({ selected: 8 })
  await waitFor(() => expect(submit().hasAttribute('disabled')).toBe(false))
  fill()
  await userEvent.click(screen.getByRole('button', { name: 'Quarantine warehouse' }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Other' } })
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Other' }))
  expect((screen.getByLabelText('Inspection quantity') as HTMLInputElement).value).toBe('')
  expect(submit().hasAttribute('disabled')).toBe(true)
  await chooseStock('Rice \u00b7 stock #9')
  await waitFor(() => expect(submit().hasAttribute('disabled')).toBe(false))
  fill('1.25')
  await userEvent.click(submit())
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].stockItemId).toBe(9)
  expect(
    reads.some(
      (read) =>
        read.url === '/warehouses' && read.params.q === 'Other' && read.params.cursor === undefined,
    ),
  ).toBe(true)
})

it('shows empty stock results and keeps selectors usable', async () => {
  mount({ empty: true })
  await warehouse()
  await userEvent.click(screen.getByRole('button', { name: 'Quarantine product stock' }))
  await screen.findByText('No eligible stock records')
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
  expect(submit().hasAttribute('disabled')).toBe(true)
  expect(
    screen.getByRole('button', { name: 'Quarantine warehouse' }).hasAttribute('disabled'),
  ).toBe(false)
})

it('reports an invalid stock cursor and restarts only on explicit reload while retaining the selected record', async () => {
  const { recover, reads } = mount({ selected: 8, failure: 'INVALID_CURSOR' })
  await waitFor(() => expect(submit().hasAttribute('disabled')).toBe(false))
  await userEvent.click(screen.getByRole('button', { name: 'Quarantine product stock' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Load more stock records' }))
  await screen.findByRole('button', { name: 'Reload stock records' })
  expect(reads.filter((read) => read.params.cursor === 'stock-2')).toHaveLength(1)
  recover()
  await userEvent.click(screen.getByRole('button', { name: 'Reload stock records' }))
  await waitFor(() =>
    expect(screen.queryByRole('button', { name: 'Reload stock records' })).toBeNull(),
  )
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Quarantine product stock' }).textContent).toContain(
    'Corn',
  )
})

it('recovers warehouse lookup errors without freezing the form', async () => {
  const { recover } = mount({ failure: '/warehouses' })
  await userEvent.click(screen.getByRole('button', { name: 'Quarantine warehouse' }))
  await screen.findByRole('button', { name: 'Reload warehouses' })
  recover()
  await userEvent.click(screen.getByRole('button', { name: 'Reload warehouses' }))
  await screen.findByRole('menuitem', { name: 'Main' })
})

it('explicitly blocks an inactive selected product without choosing a replacement', async () => {
  const { writes } = mount({ selected: 8, inactive: true })
  await screen.findByText(/selected stock record is inactive/)
  expect(submit().hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Quarantine product stock' }).textContent).toContain(
    'Corn',
  )
  expect(writes).toHaveLength(0)
})

it('blocks a selected record with no available stock while preserving its identity', async () => {
  const { writes } = mount({ selected: 8, available: '0.00' })
  await screen.findByText(/selected stock record is inactive, unavailable/)
  expect(submit().hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Quarantine product stock' }).textContent).toContain(
    'Corn',
  )
  expect(writes).toHaveLength(0)
})

it('recovers a failed off-page stock lookup explicitly without selecting another record', async () => {
  const { recover, writes } = mount({ selected: 8, failure: '/stock-items/8' })
  await screen.findByRole('alert')
  expect(submit().hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Quarantine product stock' }).textContent).toContain(
    'Stock #8',
  )
  recover()
  await userEvent.click(screen.getByRole('button', { name: 'Refresh stock and lots' }))
  await waitFor(() => expect(submit().hasAttribute('disabled')).toBe(false))
  expect(screen.getByRole('button', { name: 'Quarantine product stock' }).textContent).toContain(
    'Corn',
  )
  expect(writes).toHaveLength(0)
})
