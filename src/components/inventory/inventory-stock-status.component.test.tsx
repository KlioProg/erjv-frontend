import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { getAdapter } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { InventoryItemCatalog } from './InventoryItemCatalog'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false, isManager: false }),
}))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})

function mount({
  incomplete = false,
  failed = false,
  warehouseId,
  outWarehouse = false,
}: { incomplete?: boolean; failed?: boolean; warehouseId?: number; outWarehouse?: boolean } = {}) {
  const products = [
    'Empty Rice',
    'Low Rice',
    'Available Rice',
    'Unassigned Rice',
    'Unknown Rice',
  ].map((name, index) => ({
    id: index + 1,
    name,
    unit: 'kg',
    unitPrice: '25',
    isActive: true,
    description: null,
    createdAt: '',
    updatedAt: '',
  }))
  const stocks = [
    { inventoryItemId: 1, availableQuantity: '0', stockStatus: 'OUT', reorderThreshold: null },
    { inventoryItemId: 2, availableQuantity: '2.5', stockStatus: 'LOW', reorderThreshold: '3' },
    { inventoryItemId: 3, availableQuantity: '20', stockStatus: 'NORMAL', reorderThreshold: '3' },
    {
      inventoryItemId: 5,
      availableQuantity: 'invalid',
      stockStatus: 'OUT',
      reorderThreshold: null,
    },
  ].map((stock, index) => ({
    ...stock,
    id: index + 1,
    warehouseId: 1,
    onHandQuantity: '30',
    inTransitQuantity: '9',
    quarantinedQuantity: '0',
    inventoryItem: products.find((product) => product.id === stock.inventoryItemId),
    warehouse: { id: 1, name: 'Main' },
  }))
  // This warehouse has stock even though the selected warehouse is low.
  stocks.push({
    ...stocks[2],
    id: 9,
    inventoryItemId: 2,
    warehouseId: 2,
    warehouse: { id: 2, name: 'Other' },
  })
  if (outWarehouse) {
    stocks[2].availableQuantity = '109.75'
    stocks.push({ ...stocks[2], id: 10, warehouseId: 2, availableQuantity: '0', stockStatus: 'OUT', warehouse: { id: 2, name: 'Other' } })
  }
  apiClient.defaults.adapter = async (config) => {
    if (failed && config.url === '/stock-items') throw Error('Stock service unavailable')
    const data =
      config.url === '/inventory-items'
        ? { items: products, nextCursor: null }
        : config.url === '/stock-items'
          ? { items: stocks, nextCursor: incomplete ? 'more-stock' : null }
          : config.url?.startsWith('/stock-items/inventory-items/')
            ? {
                items: stocks.filter(
                  (stock) => stock.inventoryItemId === Number(config.url!.split('/').at(-1)),
                ),
                nextCursor: null,
              }
            : {
                items: [
                  { id: 1, name: 'Main', isActive: true },
                  { id: 2, name: 'Other', isActive: true },
                ],
                nextCursor: null,
              }
    return { config, data, status: 200, statusText: 'OK', headers: {} }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider
      client={client}
    >
      <InventoryItemCatalog
        focusTarget={warehouseId ? { warningFilter: 'LOW', warehouseId } : undefined}
      />
    </QueryClientProvider>,
  )
  return client
}

it('keeps product rows, stock labels and focus while refreshing the same query, then applies new balances', async () => {
  const client = mount()
  const row = await screen.findByRole('row', { name: /Empty Rice/ })
  await within(row).findByText('Out of Stock')
  const search = screen.getByRole('textbox', { name: 'Search inventory' })
  search.focus()
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const adapter = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (['/inventory-items', '/stock-items'].includes(config.url!)) await gate
    const response = await adapter(config)
    if (config.url === '/stock-items') response.data.items[0] = { ...response.data.items[0], availableQuantity: '7', stockStatus: 'UNCONFIGURED' }
    return response
  }
  let refresh!: Promise<unknown>
  act(() => { refresh = Promise.all([
    client.invalidateQueries({ queryKey: ['products'] }),
    client.invalidateQueries({ queryKey: ['stock-items'] }),
  ]) })
  await screen.findByText('Updating inventory...')
  expect(row.isConnected).toBe(true)
  expect(within(row).getByText('Out of Stock')).toBeTruthy()
  expect(document.activeElement).toBe(search)
  await act(async () => { release(); await refresh })
  await waitFor(() => expect(within(row).queryByText('Out of Stock')).toBeNull())
  expect(row.isConnected).toBe(true)
  expect(within(row).getByText('7')).toBeTruthy()
})

it.each([503, 403])('handles inventory refresh failure %s and retries without clearing the current data', async (status) => {
  const client = mount()
  await screen.findByRole('row', { name: /Empty Rice/ })
  const adapter = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/stock-items') throw { isAxiosError: true, response: { status, data: { message: 'Refresh failed' } } }
    return adapter(config)
  }
  await act(async () => { await client.invalidateQueries({ queryKey: ['stock-items'] }) })
  await screen.findByRole('alert')
  if (status === 503) {
    const row = screen.getByRole('row', { name: /Empty Rice/ })
    expect(within(row).getByText('Out of Stock')).toBeTruthy()
    expect(screen.getByText(/Latest inventory update could not be retrieved/)).toBeTruthy()
  } else expect(screen.queryByRole('table')).toBeNull()
  apiClient.defaults.adapter = adapter
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  expect(screen.getByRole('row', { name: /Empty Rice/ })).toBeTruthy()
})

it('labels confirmed availability without confusing physical stock, missing assignments or unknown balances', async () => {
  mount()
  const empty = await screen.findByRole('row', { name: /Empty Rice/ })
  expect(within(empty).getByText('Out of Stock')).toBeTruthy()
  expect(within(empty).getByText('0')).toBeTruthy()
  expect(empty.className).toContain('bg-destructive/5')
  const unassigned = screen.getByRole('row', { name: /Unassigned Rice/ })
  expect(within(unassigned).getByText('No Warehouse Assigned')).toBeTruthy()
  expect(within(unassigned).queryByText('Out of Stock')).toBeNull()
  expect(
    within(screen.getByRole('row', { name: /Unknown Rice/ })).getByText('Stock Unavailable'),
  ).toBeTruthy()
  expect(screen.queryByText('In Stock')).toBeNull()
  expect(screen.getByRole('columnheader', { name: /Available Stock/ })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: /Available Stock/ }).textContent).not.toContain('All warehouses')
  expect(
    within(screen.getByRole('row', { name: /Low Rice/ })).getByText(/1 warehouse low/),
  ).toBeTruthy()
})

it('tints warning rows while keeping quantities and full warning details accessible', async () => {
  mount({ outWarehouse: true })
  const available = await screen.findByRole('row', { name: /Available Rice/ })
  expect(within(available).getByText('109.75')).toBeTruthy()
  expect(within(available).getByText('kg')).toBeTruthy()
  expect(within(available).getByText('\u00b7 1 warehouse out')).toBeTruthy()
  expect(available.className).toContain('bg-destructive/5')
  const low = screen.getByRole('row', { name: /Low Rice/ })
  expect(low.className).toContain('bg-status-warning/50')
  expect(within(available).getByText('\u00b7 1 warehouse out').className).toContain('sr-only')
  expect(within(low).getByText('\u00b7 1 warehouse low').className).toContain('sr-only')
  const quantity = within(available).getByText('109.75').closest('[tabindex]')!
  act(() => (quantity as HTMLElement).focus())
  expect(screen.getByRole('tooltip').textContent).toContain('1 warehouse out')
  expect(within(screen.getByRole('row', { name: /Low Rice/ })).getByText('\u00b7 1 warehouse low')).toBeTruthy()
  const empty = screen.getByRole('row', { name: /Empty Rice/ })
  expect(within(empty).queryByText('\u00b7')).toBeNull()
  expect(within(empty).getByText('Out of Stock')).toBeTruthy()
  expect(within(empty).getByText('Out of Stock').className).toContain('sr-only')
  expect(screen.getByRole('row', { name: /Unknown Rice/ }).className).not.toMatch(/bg-destructive|bg-status-warning/)
  expect(screen.getByRole('row', { name: /Unassigned Rice/ }).className).not.toMatch(/bg-destructive|bg-status-warning/)
  for (const row of [available, empty, screen.getByRole('row', { name: /Low Rice/ })]) {
    expect(row.textContent).not.toContain('?')
  }
})

it('uses the selected warning warehouse instead of masking its low stock with another warehouse balance', async () => {
  mount({ warehouseId: 1 })
  const row = (await screen.findByText('Low Rice')).closest('tr')!
  expect(within(row).getByText('Low Stock')).toBeTruthy()
  expect(within(row).getByText('2.5')).toBeTruthy()
  expect(within(row).queryByText('22.5')).toBeNull()
  expect(row.className).toContain('bg-status-warning/50')
})

it('does not claim zero or no warehouse assignments from incomplete stock pages', async () => {
  mount({ incomplete: true })
  const row = await screen.findByRole('row', { name: /Unassigned Rice/ })
  expect(within(row).getByText('Stock Unavailable')).toBeTruthy()
  expect(within(row).queryByText('No Warehouse Assigned')).toBeNull()
  expect(within(row).queryByText('Out of Stock')).toBeNull()
  expect(row.className).not.toMatch(/bg-destructive|bg-status-warning/)
})

it('reports stock loading failures instead of showing misleading balances', async () => {
  mount({ failed: true })
  expect((await screen.findByRole('alert')).textContent).toContain('Inventory could not be loaded')
  expect(screen.queryByRole('table')).toBeNull()
})

it.each([false, true])('groups neutral, yellow and red rows without changing balances (mixed out: %s)', async (outWarehouse) => {
  mount({ outWarehouse })
  await screen.findByRole('row', { name: /Empty Rice/ })
  const names = screen.getAllByRole('row').slice(1).map(row => within(row).getAllByRole('cell')[0].textContent)
  expect(names).toEqual(outWarehouse
    ? ['Unassigned Rice', 'Unknown Rice', 'Low Rice', 'Empty Rice', 'Available Rice']
    : ['Available Rice', 'Unassigned Rice', 'Unknown Rice', 'Low Rice', 'Empty Rice'])
  expect(screen.queryByText('In Stock')).toBeNull()
  expect(screen.getByText('Products with stock warnings appear last on this page.')).toBeTruthy()
})
