import { afterEach, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import { apiClient } from '@/lib/api-client'
import * as stockApi from './stock-items.api'
import { buildCatalogStockMap } from '../products/products.catalog.utils'
import { stockConditionForItem } from './stock-warnings'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
const payload = {
  stockItemId: 4,
  condition: 'SPOILED' as const,
  quantity: '1.50',
  reason: 'Found on shelf',
  requestId: 'f32e429f-a96c-4567-abf7-172ab80d8f10',
}

it('tags stock with only the verified manual quarantine DTO and keeps backend balances', async () => {
  const lot = { id: 9, ...payload, remainingQuantity: '1.50' }
  apiClient.defaults.adapter = async (config) => {
    expect(config.url).toBe('/stock-items/quarantine-lots')
    expect(config.method).toBe('post')
    expect(JSON.parse(config.data)).toEqual(payload)
    return { config, data: lot, status: 201, statusText: '', headers: {} }
  }
  expect(await stockApi.createManualQuarantineApi({ ...payload, legacy: true } as never)).toEqual(
    lot,
  )
})

it.each([400, 403, 404, 409, undefined])(
  'preserves tagging errors (%s) without automatic retry',
  async (status) => {
    let calls = 0
    const error = new AxiosError('Network Error')
    if (status)
      error.response = {
        status,
        data: { message: 'Insufficient available stock' },
        config: {} as never,
        headers: {},
        statusText: '',
      }
    apiClient.defaults.adapter = async () => {
      calls++
      throw error
    }
    await expect(stockApi.createManualQuarantineApi(payload)).rejects.toBe(error)
    expect(calls).toBe(1)
  },
)

it('serializes quarantine filters including openOnly=false', async () => {
  apiClient.defaults.adapter = async (config) => {
    expect(config.params).toEqual({ stockItemId: 4, condition: 'SPOILED', openOnly: false })
    return { config, data: [], status: 200, statusText: '', headers: {} }
  }
  expect(
    await stockApi.fetchQuarantineLotsApi({
      stockItemId: 4,
      condition: 'SPOILED',
      openOnly: false,
    }),
  ).toEqual([])
})

it.each([
  {
    action: 'condition',
    send: () =>
      stockApi.correctQuarantineConditionApi(9, { condition: 'DAMAGED', reason: 'Rechecked' }),
    method: 'patch',
    suffix: 'condition',
    body: { condition: 'DAMAGED', reason: 'Rechecked' },
  },
  ...(['CLEAR', 'REMOVE'] as const).map((action) => ({
    action,
    send: () => stockApi.resolveQuarantineApi(9, { action, quantity: '1.00', reason: 'Inspected' }),
    method: 'post',
    suffix: 'resolutions',
    body: { action, quantity: '1.00', reason: 'Inspected' },
  })),
])('keeps the $action contract', async ({ send, method, suffix, body }) => {
  apiClient.defaults.adapter = async (config) => {
    expect(config.method).toBe(method)
    expect(config.url).toBe(`/stock-items/quarantine-lots/9/${suffix}`)
    expect(JSON.parse(config.data)).toEqual(body)
    return { config, data: { id: 9 }, status: 200, statusText: '', headers: {} }
  }
  await send()
})

it('uses backend available stock without subtracting quarantine twice', () => {
  const stock = {
    id: 4,
    inventoryItemId: 1,
    warehouseId: 2,
    quantity: '20.00',
    reservedQuantity: '5.00',
    damagedQuantity: '3.00',
    quarantinedQuantity: '3.00',
    conditionQuantities: { DAMAGED: '1.00', SPOILED: '2.00' },
    availableQuantity: '12.00',
  }
  const mapped = buildCatalogStockMap([stock as never]).get(1)!
  expect(mapped.totalCents).toBe(2000n)
  expect(mapped.availableCents).toBe(1200n)
  expect(mapped.allocations[0]).toEqual(stock)
})

it('keeps backend stock status authoritative', () => {
  expect(
    stockConditionForItem({ quantity: '20.00', availableQuantity: '0.00', stockStatus: 'OUT' }),
  ).toBe('OUT')
  expect(stockConditionForItem({ quantity: '0.00', stockStatus: 'NORMAL' })).toBe('NORMAL')
})


it('omits an unspecified numeric stock filter from the actual URL', async () => {
  apiClient.defaults.adapter = async config => {
    const url = apiClient.getUri(config)
    expect(url).toContain('/stock-items/quarantine-lots?')
    expect(url).toContain('openOnly=true')
    expect(url).not.toMatch(/stockItemId|undefined|NaN/)
    return { config, data: [], status: 200, statusText: '', headers: {} }
  }
  expect(await stockApi.fetchQuarantineLotsApi({ stockItemId: undefined, openOnly: true })).toEqual([])
})
