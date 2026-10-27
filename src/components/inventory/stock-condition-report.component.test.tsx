import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { AxiosError } from 'axios'
import { apiClient } from '@/lib/api-client'
import { StockConditionReportModal } from './StockConditionReportModal'
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 12 }, isStaff: true, isAdmin: false, isManager: false }),
}))
const stock = {
  id: 4,
  inventoryItemId: 1,
  warehouseId: 2,
  quantity: '20.00',
  availableQuantity: '12.00',
  inventoryItem: { id: 1, name: 'Rice', unit: 'kg' },
  warehouse: { id: 2, name: 'Main Warehouse' },
} as StockItemWithRelations
const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  sessionStorage.clear()
})
function cacheWarehouses(client: QueryClient) {
  client.setQueryDefaults(['warehouses'], { staleTime: Infinity })
  client.setQueryData(
    ['warehouses', 'true'],
    [
      { id: 2, name: 'Main Warehouse' },
      { id: 20, name: 'Second Warehouse' },
      { id: 30, name: 'Empty Warehouse' },
    ],
  )
}
function setup(stockRows = [stock], initialStockItemId: number | null = 4) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 3 } },
  })
  for (const key of [
    'stock-items',
    'products',
    'warehouses',
    'quarantine-lots',
    'outgoing-deliveries',
  ])
    client.setQueryData([key], [stock])
  cacheWarehouses(client)
  const close = vi.fn()
  const element = (
    <QueryClientProvider client={client}>
      <StockConditionReportModal
        open
        onClose={close}
        stocks={stockRows}
        initialStockItemId={initialStockItemId ?? undefined}
      />
    </QueryClientProvider>
  )
  return { client, close, element, ...render(element) }
}
function fill() {
  fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: '1.50' } })
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Found on shelf' } })
  fireEvent.click(
    screen.getByLabelText('I confirm the product, warehouse, condition, and quantity.'),
  )
}

it('keeps the exact payload and UUID across timeout, unmount, and an explicit retry', async () => {
  const bodies: Record<string, unknown>[] = []
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'get')
      return { config, status: 200, statusText: '', headers: {}, data: [] }
    bodies.push(JSON.parse(config.data))
    if (bodies.length === 1) throw new AxiosError('timeout', 'ECONNABORTED')
    return { config, status: 201, statusText: '', headers: {}, data: { id: 9 } }
  }
  const first = setup()
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Report Stock Condition' }))
  await screen.findByRole('button', { name: 'Retry same report' })
  expect(bodies).toHaveLength(1)
  expect(screen.getByLabelText(/^Quantity/).matches(':disabled')).toBe(true)
  expect(screen.getByLabelText('Reason').matches(':disabled')).toBe(true)
  expect(screen.queryByRole('button', { name: 'Edit report' })).toBeNull()
  first.unmount()
  const retry = setup([{ ...stock, availableQuantity: '0.00' }])
  fireEvent.click(screen.getByRole('button', { name: 'Retry same report' }))
  await waitFor(() => expect(retry.close).toHaveBeenCalledTimes(1))
  expect(bodies).toHaveLength(2)
  expect(bodies[1]).toEqual(bodies[0])
  expect(bodies[0]).toMatchObject({ stockItemId: 4, quantity: '1.50', reason: 'Found on shelf' })
  expect(bodies[0].requestId).toMatch(/^[\da-f-]{36}$/i)
  for (const key of [
    'stock-items',
    'products',
    'warehouses',
    'quarantine-lots',
    'outgoing-deliveries',
  ])
    expect(retry.client.getQueryState([key])?.isInvalidated).toBe(true)
  retry.unmount()
  const fresh = setup()
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Report Stock Condition' }))
  await waitFor(() => expect(fresh.close).toHaveBeenCalledTimes(1))
  expect(bodies[2].requestId).not.toBe(bodies[0].requestId)
})

it('rejects amounts beyond current available stock before sending', async () => {
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  setup()
  fill()
  fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: '12.01' } })
  const button = screen.getByRole('button', { name: 'Report Stock Condition' })
  expect(button.hasAttribute('disabled')).toBe(true)
  expect(screen.getByLabelText(/^Quantity/).getAttribute('aria-invalid')).toBe('true')
  expect(screen.getByText('Quantity cannot exceed available stock.')).toBeTruthy()
  fireEvent.click(button)
  expect(adapter).not.toHaveBeenCalled()
})

it('does not send when it cannot retain the UUID and payload for a safe retry', async () => {
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  setup()
  fill()
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable')
  })
  fireEvent.click(screen.getByRole('button', { name: 'Report Stock Condition' }))
  expect((await screen.findByRole('alert')).textContent).toContain('safe retries')
  expect(adapter).not.toHaveBeenCalled()
  storage.mockRestore()
})

it('shows insufficient-stock conflicts and allows a reviewed different report with a new UUID', async () => {
  const bodies: Record<string, unknown>[] = []
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'get')
      return { config, status: 200, statusText: '', headers: {}, data: [] }
    bodies.push(JSON.parse(config.data))
    const error = new AxiosError('Conflict')
    error.response = {
      config,
      status: 409,
      statusText: '',
      headers: {},
      data: { message: 'Insufficient available stock' },
    }
    throw error
  }
  setup()
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Report Stock Condition' }))
  await screen.findByRole('button', { name: 'Edit report' })
  expect(
    screen
      .getAllByRole('alert')
      .map((el) => el.textContent)
      .join(' '),
  ).toMatch(/stock/i)
  fireEvent.click(screen.getByRole('button', { name: 'Edit report' }))
  fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: '1.00' } })
  fireEvent.click(
    screen.getByLabelText('I confirm the product, warehouse, condition, and quantity.'),
  )
  fireEvent.click(screen.getByRole('button', { name: 'Report Stock Condition' }))
  await waitFor(() => expect(bodies).toHaveLength(2))
  expect(bodies[1].requestId).not.toBe(bodies[0].requestId)
})

it('selects the actual warehouse stock record and condition without changing physical stock', async () => {
  const bodies: Record<string, unknown>[] = []
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'get')
      return { config, status: 200, statusText: '', headers: {}, data: [] }
    expect(config.method).toBe('post')
    expect(config.url).toBe('/stock-items/quarantine-lots')
    bodies.push(JSON.parse(config.data))
    return { config, status: 201, statusText: '', headers: {}, data: { id: 9 } }
  }
  const client = new QueryClient()
  cacheWarehouses(client)
  const close = vi.fn()
  render(
    <QueryClientProvider client={client}>
      <StockConditionReportModal
        open
        onClose={close}
        stocks={[
          stock,
          {
            ...stock,
            id: 40,
            warehouseId: 20,
            warehouse: { ...stock.warehouse, id: 20, name: 'Second Warehouse' },
          },
        ]}
      />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Warehouse' }))
  await user.click(screen.getByRole('menuitem', { name: /Second Warehouse/ }))
  await user.click(screen.getByRole('button', { name: 'Product' }))
  await user.click(screen.getByRole('menuitem', { name: /Rice/ }))
  await user.click(screen.getByRole('combobox', { name: 'Condition' }))
  await user.click(screen.getByRole('option', { name: 'Spoiled' }))
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Report Stock Condition' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(bodies).toHaveLength(1)
  expect(bodies[0]).toEqual({
    stockItemId: 40,
    condition: 'SPOILED',
    quantity: '1.50',
    reason: 'Found on shelf',
    requestId: expect.any(String),
  })
  expect(bodies[0].requestId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  )
})

it('requires warehouse, product, valid quantity, reason and confirmation before enabling a new report', async () => {
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  setup([stock], null)
  const button = screen.getByRole('button', { name: 'Report Stock Condition' })
  expect(screen.getByRole('button', { name: 'Product' }).matches(':disabled')).toBe(true)
  expect(screen.getByText('Select warehouse')).toBeTruthy()
  expect(button.hasAttribute('disabled')).toBe(true)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Warehouse' }))
  await user.click(screen.getByRole('menuitem', { name: 'Main Warehouse' }))
  expect(screen.getByRole('button', { name: 'Product' }).matches(':disabled')).toBe(false)
  expect(button.hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Product' }))
  await user.click(screen.getByRole('menuitem', { name: /Rice/ }))
  expect(screen.getByText('12 kg available')).toBeTruthy()
  fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: '1.50' } })
  fireEvent.click(
    screen.getByLabelText('I confirm the product, warehouse, condition, and quantity.'),
  )
  expect(button.hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Inspection' } })
  expect(button.hasAttribute('disabled')).toBe(false)
  expect(adapter).not.toHaveBeenCalled()
})

it.each(['0', '-1', '0.001', 'bad', '12.01'])(
  'immediately marks invalid quantity %s and blocks even a direct form submission',
  (quantity) => {
    const adapter = vi.fn()
    apiClient.defaults.adapter = adapter
    setup()
    fill()
    fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: quantity } })
    const button = screen.getByRole('button', { name: 'Report Stock Condition' })
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(screen.getByLabelText(/^Quantity/).getAttribute('aria-invalid')).toBe('true')
    expect((screen.getByLabelText(/^Quantity/) as HTMLInputElement).value).toBe(quantity)
    expect(screen.getByLabelText(/^Quantity/).getAttribute('aria-describedby')).toContain(
      'condition-quantity-error',
    )
    fireEvent.submit(button.closest('form')!)
    expect(adapter).not.toHaveBeenCalled()
  },
)

it('clears the product and confirmation on warehouse change and revalidates retained quantity against the new product', async () => {
  const smaller = {
    ...stock,
    id: 40,
    warehouseId: 20,
    availableQuantity: '1.00',
    inventoryItem: { ...stock.inventoryItem, name: 'Banana' },
    warehouse: { id: 20, name: 'Second Warehouse' },
  }
  setup([stock, smaller])
  fill()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Warehouse' }))
  await user.click(screen.getByRole('menuitem', { name: 'Second Warehouse' }))
  expect(screen.getByText('Select product in warehouse')).toBeTruthy()
  expect(
    (
      screen.getByLabelText(
        'I confirm the product, warehouse, condition, and quantity.',
      ) as HTMLInputElement
    ).checked,
  ).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Product' }))
  expect(screen.queryByRole('menuitem', { name: /Rice/ })).toBeNull()
  await user.click(screen.getByRole('menuitem', { name: /Banana/ }))
  expect(screen.getByText('1 kg available')).toBeTruthy()
  expect(screen.getByText('Quantity cannot exceed available stock.')).toBeTruthy()
  fireEvent.change(screen.getByLabelText(/^Quantity/), { target: { value: '1.00' } })
  expect(screen.getByLabelText(/^Quantity/).getAttribute('aria-invalid')).toBe('false')
  expect(
    screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
  ).toBe(true)
  fireEvent.click(
    screen.getByLabelText('I confirm the product, warehouse, condition, and quantity.'),
  )
  expect(
    screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
  ).toBe(false)
})

it('shows a clear empty warehouse state without enabling the product or submission', async () => {
  setup([stock], null)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Warehouse' }))
  await user.click(screen.getByRole('menuitem', { name: 'Empty Warehouse' }))
  expect(screen.getByRole('status').textContent).toBe(
    'No stock records available in this warehouse',
  )
  expect(screen.getByRole('button', { name: 'Product' }).matches(':disabled')).toBe(true)
  expect(
    screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
  ).toBe(true)
})

it.each(['0.00', 'unavailable'])(
  'does not allow reports against %s available stock',
  (availableQuantity) => {
    setup([{ ...stock, availableQuantity }])
    fill()
    expect(screen.getByLabelText(/^Quantity/).getAttribute('aria-invalid')).toBe('true')
    expect(
      screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
    ).toBe(true)
  },
)

it('supports keyboard search and selection for warehouse and product', async () => {
  setup([stock], null)
  const user = userEvent.setup()
  screen.getByRole('button', { name: 'Warehouse' }).focus()
  await user.keyboard('{Enter}')
  await user.type(screen.getByRole('searchbox'), 'Main')
  await user.keyboard('{ArrowDown}{Enter}')
  expect(screen.getByRole('button', { name: 'Warehouse' }).textContent).toContain('Main Warehouse')
  screen.getByRole('button', { name: 'Product' }).focus()
  await user.keyboard('{Enter}')
  await user.type(screen.getByRole('searchbox'), 'Rice')
  await user.keyboard('{ArrowDown}{Enter}')
  expect(screen.getByText('12 kg available')).toBeTruthy()
})

it('immediately revalidates a changed backend balance without changing entered quantities', () => {
  const view = setup()
  fill()
  expect(
    screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
  ).toBe(false)
  view.rerender(
    <QueryClientProvider client={view.client}>
      <StockConditionReportModal
        open
        onClose={view.close}
        stocks={[{ ...stock, availableQuantity: '1.00' }]}
        initialStockItemId={4}
      />
    </QueryClientProvider>,
  )
  expect((screen.getByLabelText(/^Quantity/) as HTMLInputElement).value).toBe('1.50')
  expect(screen.getByText('Quantity cannot exceed available stock.')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
  ).toBe(true)
})

it('updates availability and requests confirmation again when changing products in one warehouse', async () => {
  setup([
    stock,
    {
      ...stock,
      id: 5,
      inventoryItemId: 6,
      availableQuantity: '0.25',
      inventoryItem: { id: 6, name: 'Banana', unit: 'pieces' },
    },
  ])
  fill()
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Product' }))
  await user.click(screen.getByRole('menuitem', { name: /Banana/ }))
  expect(screen.getByText('0.25 pieces available')).toBeTruthy()
  expect(screen.getByLabelText('Quantity (pieces)')).toBeTruthy()
  expect(screen.getByText('Quantity cannot exceed available stock.')).toBeTruthy()
  expect(
    (
      screen.getByLabelText(
        'I confirm the product, warehouse, condition, and quantity.',
      ) as HTMLInputElement
    ).checked,
  ).toBe(false)
  expect(
    screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
  ).toBe(true)
})

it('shows one available balance beside the dynamic quantity label without a details panel', () => {
  const view = setup()
  const input = screen.getByLabelText('Quantity (kg)')
  const balance = screen.getByText('12 kg available')
  expect(input.parentElement?.firstElementChild?.contains(balance)).toBe(true)
  expect(screen.getAllByText('12 kg available')).toHaveLength(1)
  expect(view.container.querySelector('dl')).toBeNull()
  expect(screen.queryByText(/^Available:/)).toBeNull()
  expect(screen.queryByText('Unit')).toBeNull()
})

it('does not invent a balance or unit before a product is selected', () => {
  setup([stock], null)
  expect(screen.getByLabelText('Quantity')).toBeTruthy()
  expect(screen.queryByText(/\d.*available$/)).toBeNull()
  expect(screen.queryByText('Available stock unavailable')).toBeNull()
})

it.each([undefined, null, 'bad'])(
  'blocks reporting when authoritative available stock is %s instead of using physical stock',
  (availableQuantity) => {
    setup([{ ...stock, availableQuantity } as StockItemWithRelations])
    fill()
    expect(screen.getByText('Available stock unavailable')).toBeTruthy()
    expect(screen.queryByText('20 kg available')).toBeNull()
    expect(screen.queryByText('0 kg available')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
    ).toBe(true)
  },
)

it('shows loading and failed stock states and revalidates when stock becomes available', () => {
  const view = setup()
  fill()
  function update(stocksLoading: boolean, stocksError: boolean) {
    view.rerender(
      <QueryClientProvider client={view.client}>
        <StockConditionReportModal
          open
          onClose={view.close}
          stocks={[stock]}
          initialStockItemId={4}
          stocksLoading={stocksLoading}
          stocksError={stocksError}
        />
      </QueryClientProvider>,
    )
  }
  update(true, false)
  expect(screen.getByText('Loading stock...')).toBeTruthy()
  expect(screen.queryByText('12 kg available')).toBeNull()
  expect(screen.getByRole('button', { name: 'Product' }).matches(':disabled')).toBe(true)
  expect(
    screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
  ).toBe(true)
  update(false, true)
  expect(screen.getByText('Available stock unavailable')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
  ).toBe(true)
  update(false, false)
  expect(screen.getByText('12 kg available')).toBeTruthy()
  expect((screen.getByLabelText('Quantity (kg)') as HTMLInputElement).value).toBe('1.50')
  expect(screen.getByLabelText('Quantity (kg)').getAttribute('aria-invalid')).toBe('false')
  expect(
    screen.getByRole('button', { name: 'Report Stock Condition' }).hasAttribute('disabled'),
  ).toBe(false)
})
