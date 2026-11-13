import { render, screen, within, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, MemoryRouter, Routes, Route } from 'react-router'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { getAdapter } from 'axios'
import { WarehouseTransfersPage } from './WarehouseTransfersPage'
import { transferFixture } from '@/features/warehouse-transfers/warehouse-transfers.fixtures'
import { useTransferWrite } from '@/features/warehouse-transfers/warehouse-transfers.hooks'
import type { WarehouseTransfer } from '@/features/warehouse-transfers/warehouse-transfers.types'
import { screenFromPath } from '@/routes'
const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
let records: WarehouseTransfer[]
let reads: Record<string, unknown>[]
let writes: string[]
let ignoreScope = false
beforeEach(() => {
  auth.isAdmin = true
  auth.isStaff = false
  reads = []
  writes = []
  ignoreScope = false
  records = (['DRAFT', 'DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'] as const).map(
    (status, index) => {
      const id = 7 + index
      return {
        ...transferFixture(),
        id,
        transferNumber: 'WT-' + id,
        status,
        runId: index === 1 ? 44 : null,
        dispatchedAt:
          status === 'DISPATCHED' || status === 'COMPLETED' ? '2026-11-11T01:00:00Z' : null,
        reconciledAt: status === 'COMPLETED' ? '2026-11-11T03:00:00Z' : null,
        items: transferFixture().items.map((item) => ({
          ...item,
          id: id * 10,
          warehouseTransferId: id,
          ...(status === 'COMPLETED'
            ? {
                receivedQuantity: '10',
                damagedQuantity: '0',
                returnedSellableQuantity: '0',
                returnedDamagedQuantity: '0',
                missingQuantity: '0',
              }
            : {}),
        })),
      }
    },
  )
  apiClient.defaults.adapter = async (config) => {
    const params = config.params ?? {}
    let data: unknown = { items: [], nextCursor: null }
    if (config.url === '/warehouse-transfers' && config.method === 'get') {
      reads.push({ ...params })
      const filtered = records.filter(
        (record) =>
          (ignoreScope || !params.statuses || params.statuses.includes(record.status)) &&
          (!params.q || record.transferNumber.includes(params.q)),
      )
      data = {
        items: params.cursor ? filtered.slice(1) : filtered,
        nextCursor: params.cursor ? null : 'next-page',
      }
    } else if (config.url?.startsWith('/warehouse-transfers/')) {
      const id = Number(config.url.split('/')[2])
      let record = records.find((item) => item.id === id)!
      if (config.method === 'patch') {
        writes.push(config.url)
        const body = JSON.parse(config.data)
        record = {
          ...record,
          status: 'COMPLETED',
          revision: record.revision + 1,
          items: record.items.map((item, index) => ({ ...item, ...body.items[index] })),
        }
        records = records.map((item) => (item.id === id ? record : item))
      }
      data = record
    } else if (config.url?.startsWith('/warehouses/'))
      data = {
        id: Number(config.url.split('/').at(-1)),
        name: config.url.endsWith('/1') ? 'Main Warehouse' : 'Branch Warehouse',
        isActive: true,
      }
    else if (config.url?.startsWith('/inventory-items/'))
      data = { id: 10, name: 'Mango', unit: 'kg' }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount(path = '/warehouse-transfers', controls = false) {
  function Finish() {
    const mutation = useTransferWrite()
    return (
      <button
        onClick={() =>
          mutation.mutate({
            action: 'reconcile',
            id: 9,
            payload: {
              expectedRevision: records[2].revision,
              items: [
                {
                  warehouseTransferItemId: 90,
                  receivedQuantity: '10',
                  damagedQuantity: '0',
                  returnedSellableQuantity: '0',
                  returnedDamagedQuantity: '0',
                  missingQuantity: '0',
                },
              ],
            },
          })
        }
      >
        Finish test transfer
      </button>
    )
  }
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <MemoryRouter initialEntries={[path]}>
        <Link to="/warehouse-transfers/history">Transfer history navigation</Link>
        <Routes>
          <Route path="/warehouse-transfers" element={<WarehouseTransfersPage key="active" />} />
          <Route
            path="/warehouse-transfers/history"
            element={<WarehouseTransfersPage key="history" view="history" />}
          />
          <Route path="/deliveries/runs" element={<h1>Delivery Trips</h1>} />
        </Routes>
        {controls && <Finish />}
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
it('shows only operational transfers with compact outgoing-style controls and verified next actions', async () => {
  mount()
  await screen.findByText('WT-7')
  expect(reads[0].statuses).toEqual(['DRAFT', 'DISPATCHED'])
  expect(screen.queryByText('WT-10')).toBeNull()
  expect(screen.queryByText('WT-11')).toBeNull()
  expect(screen.queryByRole('button', { name: 'All Transfers' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'History' })).toBeNull()
  expect(screen.getAllByRole('columnheader').map((node) => node.textContent)).toEqual([
    'Transfer #',
    'Source / Destination',
    'Trip',
    'Departure',
    'Status',
    'Next Action',
  ])
  expect(screen.getByRole('button', { name: 'Filters' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Create Transfer' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add to Trip' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'View Trip' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Receive Goods' })).toBeTruthy()
  const route = screen.getAllByText('Main Warehouse → Branch Warehouse')[0]
  expect(route.closest('td')?.classList.contains('max-w-0')).toBe(true)
  expect(screen.getByRole('columnheader', { name: 'Source / Destination' }).style.width).toBe('')
  expect(screen.getByText('3 transfers on this page')).toBeTruthy()
  expect(writes).toHaveLength(0)
})
it('opens read-only completed and cancelled records through History and returns to active work', async () => {
  mount()
  await screen.findByText('WT-7')
  await userEvent.click(screen.getByRole('link', { name: 'Transfer history navigation' }))
  await screen.findByRole('heading', { name: 'Warehouse Transfer History' })
  await screen.findByText('WT-10')
  expect(reads.at(-1)?.statuses).toEqual(['COMPLETED', 'CANCELLED'])
  expect(screen.queryByText('WT-7')).toBeNull()
  expect(screen.getByText('WT-11')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Create Transfer' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Receive Goods|Add to Trip/ })).toBeNull()
  const identifier = screen.getByRole('button', { name: 'View transfer WT-10' })
  identifier.focus()
  await userEvent.keyboard('{Enter}')
  const dialog = await screen.findByRole('dialog')
  await within(dialog).findByText('Transfer results (1)')
  expect(
    within(dialog).queryByRole('button', {
      name: /Receive Goods|Edit Draft|Cancel Transfer|Add to Trip/,
    }),
  ).toBeNull()
  await userEvent.keyboard('{Escape}')
  await userEvent.click(screen.getByRole('link', { name: 'Active Transfers' }))
  await screen.findByText('WT-7')
  expect(writes).toHaveLength(0)
})
it.each([
  ['/warehouse-transfers', 'Draft', 'DRAFT'],
  ['/warehouse-transfers/history', 'Completed', 'COMPLETED'],
])('keeps %s filters and cursors in the correct server scope', async (path, label, status) => {
  mount(path)
  await screen.findByRole('table')
  await screen.findByText(path.endsWith('history') ? 'WT-10' : 'WT-7')
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('Page 2')
  await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
  await userEvent.click(screen.getByRole('combobox', { name: 'Transfer status' }))
  await userEvent.click(screen.getByRole('option', { name: label }))
  await waitFor(() => expect(reads.at(-1)?.statuses).toEqual([status]))
  expect(reads.at(-1)?.cursor).toBeUndefined()
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Search warehouse transfers' }), {
    target: { value: 'WT-' },
  })
  await waitFor(() => expect(reads.at(-1)?.q).toBe('WT-'))
  expect(reads.at(-1)?.statuses).toEqual([status])
  expect(reads.at(-1)?.cursor).toBeUndefined()
})
it('moves a completed record out of active work and makes it available in History after invalidation', async () => {
  mount('/warehouse-transfers', true)
  await screen.findByText('WT-9')
  await userEvent.click(screen.getByRole('button', { name: 'View transfer WT-9' }))
  await screen.findByRole('dialog', { name: 'WT-9' })
  await userEvent.keyboard('{Escape}')
  await userEvent.click(screen.getByRole('button', { name: 'Finish test transfer' }))
  await waitFor(() => expect(screen.queryByText('WT-9')).toBeNull())
  expect(writes).toEqual(['/warehouse-transfers/9/reconcile'])
  await userEvent.click(screen.getByRole('link', { name: 'Transfer history navigation' }))
  await screen.findByText('WT-9')
  expect(screen.queryByRole('dialog')).toBeNull()
})
it('preserves staff permissions and prevents final records from leaking into active work', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  ignoreScope = true
  mount()
  await screen.findByText('WT-7')
  expect(screen.queryByText('WT-10')).toBeNull()
  expect(screen.queryByText('WT-11')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Create Transfer' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Add to Trip' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Receive Goods' })).toBeTruthy()
  expect(screenFromPath('/warehouse-transfers/history')).toBe('warehouse-transfers')
})

it('keeps history recovery separate from an empty history and preserves controls', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  let fail = true
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/warehouse-transfers' && fail) {
      fail = false
      throw Error('History unavailable')
    }
    return adapter(config)
  }
  mount('/warehouse-transfers/history')
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.queryByText('No transfer history yet.')).toBeNull()
  expect(screen.getByRole('textbox', { name: 'Search warehouse transfers' })).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('WT-10')
  expect(screen.getByText('2 transfers on this page')).toBeTruthy()
})
it.each(['Add to Trip', 'View Trip'])(
  'preserves the existing %s handoff without writing a transfer',
  async (name) => {
    mount()
    await screen.findByText('WT-8')
    await userEvent.click(screen.getByRole('button', { name }))
    expect(await screen.findByRole('heading', { name: 'Delivery Trips' })).toBeTruthy()
    expect(writes).toHaveLength(0)
  },
)
it('opens cancelled history by row click without operational controls', async () => {
  mount('/warehouse-transfers/history')
  const row = (await screen.findByText('WT-11')).closest('tr')!
  await userEvent.click(row)
  const dialog = await screen.findByRole('dialog', { name: 'WT-11' })
  expect(within(dialog).getByText('Cancelled')).toBeTruthy()
  expect(
    within(dialog).queryByRole('button', { name: /Edit Draft|Cancel Transfer|Receive Goods/ }),
  ).toBeNull()
  expect(writes).toHaveLength(0)
})
