import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import { ScheduleIncomingDeliveryModal } from './ScheduleIncomingDeliveryModal'

const original = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = original })
const orders = [1, 2].map((id) => ({ id, revision: 3, orderNumber: `PO-${id}`, status: 'CONFIRMED', supplierId: id, expectedAt: `2026-11-0${id}T08:00:00Z`, items: [{ id: id * 100, inventoryItemId: id * 11, quantity: '5.00' }] })) as PurchaseOrderRecord[]
const warehouses = [{ id: 10, name: 'Dock A', isActive: true }, { id: 20, name: 'Dock B', isActive: true }]
function mount({ selected, fail = '', empty = false }: { selected?: number; fail?: string; empty?: boolean } = {}) {
  const calls: { url: string; params: Record<string, unknown> }[] = []
  let failure = fail
  let inactive = false
  const onSubmit = vi.fn(async () => undefined)
  apiClient.defaults.adapter = async (config) => {
    const url = config.url!
    const params = config.params ?? {}
    calls.push({ url, params: { ...params } })
    if (url === failure || (failure === 'INVALID_CURSOR' && params.cursor))
      throw new AxiosError('Lookup failed', 'ERR_BAD_REQUEST', config, undefined, { config, status: failure === 'INVALID_CURSOR' ? 400 : 503, statusText: '', headers: {}, data: { code: failure === 'INVALID_CURSOR' ? 'INVALID_CURSOR' : 'UNAVAILABLE', detail: 'Lookup failed.' } })
    let data: unknown
    if (url === '/purchase-orders') data = { items: empty ? [] : params.q ? (String(params.q).includes('Second') ? [orders[1]] : []) : params.cursor ? orders : [orders[0]], nextCursor: empty || params.q || params.cursor ? null : 'po-2' }
    else if (url === '/warehouses') data = { items: params.q ? (String(params.q).includes('Dock B') ? [warehouses[1]] : []) : params.cursor ? warehouses : [warehouses[0]], nextCursor: params.q || params.cursor ? null : 'wh-2' }
    else if (url.startsWith('/purchase-orders/')) data = orders.find((order) => order.id === Number(url.split('/').pop()))
    else if (url.startsWith('/warehouses/')) data = { ...warehouses.find((warehouse) => warehouse.id === Number(url.split('/').pop())), isActive: !inactive }
    else if (url === '/incoming-deliveries') data = { items: [], nextCursor: null }
    else if (url.startsWith('/suppliers/')) data = { id: Number(url.split('/').pop()), name: `Supplier ${url.split('/').pop()}` }
    else if (url.startsWith('/inventory-items/')) data = { id: Number(url.split('/').pop()), name: `Product ${url.split('/').pop()}`, unit: 'kg' }
    else throw Error(`Unexpected collection request ${url}`)
    return { config, data, status: 200, statusText: '', headers: {} }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><ScheduleIncomingDeliveryModal open onClose={vi.fn()} onSubmit={onSubmit} purchaseOrders={[]} suppliers={[]} products={[]} warehouses={[]} preselectedOrderId={selected} /></QueryClientProvider>)
  return { calls, onSubmit, recover: () => { failure = '' }, deactivate: () => { inactive = true }, client }
}
async function chooseWarehouse() {
  await userEvent.click(screen.getByRole('button', { name: 'Destination Warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Dock A' }))
}

it('loads pages only on demand, preserves filters and deduplicates selector options', async () => {
  const { calls } = mount()
  await waitFor(() => expect(calls.some((call) => call.url === '/purchase-orders')).toBe(true))
  expect(calls.some((call) => call.url === '/incoming-deliveries')).toBe(false)
  expect(calls.some((call) => call.params.cursor)).toBe(false)
  await userEvent.click(screen.getByRole('button', { name: 'Purchase Order' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Load more purchase orders' }))
  await screen.findByRole('menuitem', { name: 'PO-2 / Supplier #2' })
  expect(screen.getAllByRole('menuitem', { name: 'PO-1 / Supplier #1' })).toHaveLength(1)
  expect(calls.find((call) => call.params.cursor === 'po-2')?.params).toEqual({ limit: 50, statuses: ['CONFIRMED', 'PARTIALLY_RECEIVED'], cursor: 'po-2' })
  await userEvent.click(screen.getByRole('menuitem', { name: 'PO-2 / Supplier #2' }))
  await screen.findByText('Product 22')
  expect(calls.filter((call) => call.url === '/incoming-deliveries').every((call) => call.params.purchaseOrderId === 2 && JSON.stringify(call.params.statuses) === '["COMPLETED"]')).toBe(true)
  await userEvent.click(screen.getByRole('button', { name: 'Destination Warehouse' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Load more results' }))
  await screen.findByRole('menuitem', { name: 'Dock B' })
  expect(screen.getAllByRole('menuitem', { name: 'Dock A' })).toHaveLength(1)
  expect(calls.find((call) => call.params.cursor === 'wh-2')?.params).toEqual({ limit: 50, includeInactive: 'false', cursor: 'wh-2' })
})

it('searches both selectors on the server and retains off-page selected records', async () => {
  const user = userEvent.setup()
  const { calls, onSubmit } = mount({ selected: 2 })
  await screen.findByText('Product 22')
  await userEvent.click(screen.getByRole('button', { name: 'Purchase Order' }))
  await user.type(screen.getByRole('searchbox', { name: 'Search purchase orders' }), 'Second')
  await screen.findByRole('menuitem', { name: 'PO-2 / Supplier #2' })
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Nothing' } })
  await screen.findByText('No eligible purchase orders found.')
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Purchase Order' }).textContent).toContain('PO-2')
  await userEvent.click(screen.getByRole('button', { name: 'Destination Warehouse' }))
  await user.type(screen.getByRole('searchbox', { name: 'Search warehouse' }), 'Dock B')
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Dock B' }))
  await userEvent.click(screen.getByRole('button', { name: 'Destination Warehouse' }))
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'No match' } })
  await screen.findByText('No matching results.')
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Destination Warehouse' }).textContent).toContain('Dock B')
  const submit = screen.getByRole('button', { name: 'Schedule Incoming Delivery' })
  await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false))
  await userEvent.click(submit)
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(onSubmit.mock.calls[0]).toEqual([expect.objectContaining({ purchaseOrderId: 2, warehouseId: 20 })])
  expect(calls.filter((call) => call.params.q).every((call) => call.params.cursor === undefined)).toBe(true)
})

it('shows an empty initial result without issuing an unscoped receiving query', async () => {
  const { calls } = mount({ empty: true })
  await userEvent.click(screen.getByRole('button', { name: 'Purchase Order' }))
  await screen.findByText('No eligible purchase orders found.')
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
  expect(calls.some((call) => call.url === '/incoming-deliveries')).toBe(false)
  expect(screen.getByRole('button', { name: 'Schedule Incoming Delivery' }).hasAttribute('disabled')).toBe(true)
})

it('exposes lookup errors and restarts an invalid cursor only when explicitly reloaded', async () => {
  const { calls, recover } = mount({ fail: 'INVALID_CURSOR' })
  await userEvent.click(screen.getByRole('button', { name: 'Purchase Order' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Load more purchase orders' }))
  await screen.findByRole('button', { name: 'Reload purchase orders' })
  expect(calls.filter((call) => call.params.cursor === 'po-2')).toHaveLength(1)
  recover()
  await userEvent.click(screen.getByRole('button', { name: 'Reload purchase orders' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Reload purchase orders' })).toBeNull())
  expect(calls.at(-1)?.params.cursor).toBeUndefined()
})

it('allows changing a failed order selection and clears PO-dependent reference and arrival data', async () => {
  mount({ selected: 1 })
  await screen.findByText('Product 11')
  fireEvent.change(screen.getByLabelText('Supplier Reference (optional)'), { target: { value: 'Old supplier reference' } })
  fireEvent.change(screen.getByLabelText('Expected Arrival Date & Time'), { target: { value: '2026-12-01T10:00' } })
  await userEvent.click(screen.getByRole('button', { name: 'Purchase Order' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Load more purchase orders' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'PO-2 / Supplier #2' }))
  await screen.findByText('Product 22')
  expect(screen.queryByText('Product 11')).toBeNull()
  expect((screen.getByLabelText('Supplier Reference (optional)') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Expected Arrival Date & Time') as HTMLInputElement).value).not.toBe('2026-12-01T10:00')
  expect(screen.getByText(/Supplier: Supplier 2/)).toBeTruthy()
})

it('does not submit an inactive warehouse discovered during scheduling preflight', async () => {
  const { onSubmit, deactivate } = mount({ selected: 1 })
  await screen.findByText('Product 11')
  await chooseWarehouse()
  const submit = screen.getByRole('button', { name: 'Schedule Incoming Delivery' })
  await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false))
  deactivate()
  await userEvent.click(submit)
  await screen.findByText(/active target intake warehouse/)
  expect(onSubmit).not.toHaveBeenCalled()
})

it('recovers an initial purchase lookup error without changing the selected order', async () => {
  const { recover } = mount({ selected: 2, fail: '/purchase-orders' })
  await screen.findByText('Product 22')
  await userEvent.click(screen.getByRole('button', { name: 'Purchase Order' }))
  await screen.findByRole('alert')
  recover()
  await userEvent.click(screen.getByRole('button', { name: 'Reload purchase orders' }))
  await screen.findByRole('menuitem', { name: 'PO-1 / Supplier #1' })
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
  expect(screen.getByRole('button', { name: 'Purchase Order' }).textContent).toContain('PO-2')
})

it('allows replacing a selected order whose detail request fails', async () => {
  mount({ selected: 1, fail: '/purchase-orders/1' })
  await screen.findByRole('alert')
  expect(screen.getByRole('button', { name: 'Schedule Incoming Delivery' }).hasAttribute('disabled')).toBe(true)
  await userEvent.click(screen.getByRole('button', { name: 'Purchase Order' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Load more purchase orders' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'PO-2 / Supplier #2' }))
  await screen.findByText('Product 22')
  expect(screen.queryByText(/selected purchase order or incoming delivery balances could not be loaded/)).toBeNull()
})

it('keeps a failed selected warehouse visible and permits explicit recovery', async () => {
  const { recover, onSubmit } = mount({ selected: 1, fail: '/warehouses/10' })
  await screen.findByText('Product 11')
  await chooseWarehouse()
  await screen.findByRole('button', { name: 'Reload selected warehouse' })
  expect(screen.getByRole('button', { name: 'Destination Warehouse' }).textContent).toContain('Dock A')
  expect(screen.getByRole('button', { name: 'Schedule Incoming Delivery' }).hasAttribute('disabled')).toBe(true)
  expect(onSubmit).not.toHaveBeenCalled()
  recover()
  await userEvent.click(screen.getByRole('button', { name: 'Reload selected warehouse' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Schedule Incoming Delivery' }).hasAttribute('disabled')).toBe(false))
  expect(screen.getByRole('button', { name: 'Destination Warehouse' }).textContent).toContain('Dock A')
})
