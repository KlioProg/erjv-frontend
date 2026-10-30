import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError, getAdapter } from 'axios'
import { apiClient } from '@/lib/api-client'
import { createProductApi } from '@/features/products/products.api'
import { setReorderThresholdApi } from '@/features/logistics/stock-items.api'
import { InventoryItemModal } from './InventoryItemModal'
import { WarehouseModal } from './WarehouseModal'
import { WarehouseInventory } from './WarehouseInventory'
import type { Warehouse } from '@/features/logistics/warehouses.types'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false, isStaff: false }),
}))
const original = apiClient.defaults.adapter
let writes: { url?: string; body: Record<string, unknown> }[]
let lookupStatus: number
let lookupCode: string | undefined
const warehouse = { id: 2, name: 'Main Warehouse', address: '', isActive: true } as Warehouse
let threshold: string | null
beforeEach(() => {
  writes = []
  lookupStatus = 404
  lookupCode = 'RESOURCE_NOT_FOUND'
  threshold = null
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.includes('/name/'))
      throw new AxiosError('Lookup failed', undefined, config, undefined, {
        status: lookupStatus,
        statusText: '',
        headers: {},
        config,
        data: { code: lookupCode, message: 'Record not found' },
      })
    let data: unknown = []
    if (config.url === '/stock-items/warehouses/2')
      data = [
        {
          id: 4,
          inventoryItemId: 1,
          warehouseId: 2,
          revision: 1,
          onHandQuantity: '10.00',
          inTransitQuantity: '0.00',
          conditionQuantities: { DAMAGED: '0.00', SPOILED: '0.00' },
          stockStatus: 'UNCONFIGURED',
          createdAt: '',
          updatedAt: '',
          availableQuantity: '10.00',
          quarantinedQuantity: '0.00',
          reorderThreshold: threshold,
          inventoryItem: { id: 1, name: 'Rice', unit: 'kg' },
        },
      ]
    if (config.method === 'get' && config.url === '/stock-items/warehouses/2')
      data = { items: data, nextCursor: null }
    if (config.method !== 'get') {
      const body = JSON.parse(config.data)
      writes.push({ url: config.url, body })
      if (config.url?.endsWith('/reorder-threshold')) threshold = body.reorderThreshold
      data = { id: 4, revision: 2, ...body, isActive: true }
    }
    return { config, data, status: 200, statusText: '', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount(element: React.ReactNode) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      {element}
    </QueryClientProvider>,
  )
}
function change(label: RegExp | string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
function fillProduct() {
  change(/Product Item Name/, 'New Product')
  change(/^Unit/, 'pieces')
  change(/Standard Wholesale/, '12.50')
}

it('creates a product with the employee-selected unit after an expected missing-name response', async () => {
  const close = vi.fn()
  mount(<InventoryItemModal open item={null} onClose={close} />)
  fillProduct()
  fireEvent.click(screen.getByRole('button', { name: 'Register Product' }))
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toEqual([
    {
      url: '/inventory-items',
      body: { name: 'New Product', unit: 'pieces', unitPrice: '12.50', isActive: true },
    },
  ])
})
it('never invents a unit for product creation', async () => {
  await expect(createProductApi({ name: 'Product', unit: '', unitPrice: '1.00' })).rejects.toThrow(
    /unit/i,
  )
  expect(writes).toHaveLength(0)
})
it.each([
  [403, 'RESOURCE_NOT_FOUND'],
  [500, 'RESOURCE_NOT_FOUND'],
  [404, undefined],
])('blocks product creation on an unexpected lookup error %s', async (status, code) => {
  lookupStatus = status as number
  lookupCode = code as string | undefined
  mount(<InventoryItemModal open item={null} onClose={vi.fn()} />)
  fillProduct()
  fireEvent.click(screen.getByRole('button', { name: 'Register Product' }))
  await screen.findByRole('alert')
  expect(writes).toHaveLength(0)
})
it('creates a warehouse when the name lookup explicitly reports no matching warehouse', async () => {
  const close = vi.fn()
  mount(<WarehouseModal open warehouse={null} onClose={close} />)
  change(/Warehouse Name/, 'New Warehouse')
  change(/Address/, 'Davao')
  fireEvent.submit(screen.getByRole('button', { name: /Register Warehouse/ }).closest('form')!)
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes[0]).toEqual({
    url: '/warehouses',
    body: { name: 'New Warehouse', address: 'Davao', isActive: true },
  })
})
it('keeps warehouse lookup authorization errors visible without creating a record', async () => {
  lookupStatus = 403
  mount(<WarehouseModal open warehouse={null} onClose={vi.fn()} />)
  change(/Warehouse Name/, 'New Warehouse')
  change(/Address/, 'Davao')
  fireEvent.submit(screen.getByRole('button', { name: /Register Warehouse/ }).closest('form')!)
  await screen.findByRole('alert')
  expect(writes).toHaveLength(0)
})
it('opens the existing reorder settings from the mounted warehouse inventory and saves exact thresholds', async () => {
  mount(<WarehouseInventory warehouse={warehouse} onBack={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: 'Stock Alert Settings for Rice' }))
  expect(await screen.findByRole('heading', { name: 'Warehouse Reorder Threshold' })).toBeTruthy()
  change('Reorder threshold', '2.25')
  fireEvent.submit(screen.getByLabelText('Reorder threshold').closest('form')!)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(writes[0]).toEqual({
    url: '/stock-items/4/reorder-threshold',
    body: { reorderThreshold: '2.25' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Stock Alert Settings for Rice' }))
  expect((screen.getByLabelText('Reorder threshold') as HTMLInputElement).value).toBe('2.25')
})
it.each(['1.234', '-1', '10000000000'])(
  'rejects invalid threshold %s without rounding or sending it',
  async (value) => {
    await expect(setReorderThresholdApi(4, { reorderThreshold: value })).rejects.toThrow(
      /threshold/i,
    )
    expect(writes).toHaveLength(0)
  },
)

it('prevents duplicate warehouse submissions during the name lookup', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  let release!: () => void
  let lookups = 0
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.includes('/name/')) {
      lookups++
      await gate
    }
    return base(config)
  }
  const close = vi.fn()
  mount(<WarehouseModal open warehouse={null} onClose={close} />)
  change(/Warehouse Name/, 'New Warehouse')
  change(/Address/, 'Davao')
  const form = screen.getByRole('button', { name: /Register Warehouse/ }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(lookups).toBe(1))
  release()
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toHaveLength(1)
})

it('keeps an archived product recoverable when restoration fails instead of rejecting an event promise', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.includes('/name/'))
      return {
        config,
        status: 200,
        statusText: '',
        headers: {},
        data: { id: 1, name: 'New Product', unit: 'pieces', unitPrice: '1.00', isActive: false },
      }
    if (config.url?.endsWith('/reactivate'))
      throw new AxiosError('Restore rejected', undefined, config, undefined, {
        config,
        status: 409,
        statusText: '',
        headers: {},
        data: { message: 'Restore rejected' },
      })
    return base(config)
  }
  const close = vi.fn()
  mount(<InventoryItemModal open item={null} onClose={close} />)
  fillProduct()
  fireEvent.click(screen.getByRole('button', { name: 'Register Product' }))
  fireEvent.click(await screen.findByRole('button', { name: /Reactivate Product/ }))
  expect(await screen.findByText(/Restore rejected/)).toBeTruthy()
  expect(close).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /Reactivate Product/ })).toBeTruthy()
})
