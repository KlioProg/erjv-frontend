import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { createStockItemApi, setStockQuantityApi, setReorderThresholdApi, increaseStockQuantityApi, decreaseStockQuantityApi } from './stock-items.api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })
const commands = [
  { field: 'quantity', send: (value: string) => createStockItemApi({ inventoryItemId: 1, warehouseId: 2, quantity: value }) },
  { field: 'quantity', send: (value: string) => setStockQuantityApi(1, { quantity: value }) },
  { field: 'reorderThreshold', send: (value: string) => setReorderThresholdApi(1, { reorderThreshold: value }) },
  { field: 'amount', send: (value: string) => increaseStockQuantityApi(1, { amount: value }) },
  { field: 'amount', send: (value: string) => decreaseStockQuantityApi(1, { amount: value }) },
]
it.each(commands)('preserves decimal strings for stock command $field', async ({ field, send }) => {
  const value = '999999999999.99'
  apiClient.defaults.adapter = async (config) => {
    expect(JSON.parse(config.data)[field]).toBe(value)
    return { config, data: {}, status: 200, statusText: 'OK', headers: {} }
  }
  await send(value)
})
it.each(commands)('rejects invalid stock $field instead of silently rounding', async ({ send }) => {
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  for (const value of ['', '1.001', '-1', '1e2']) await expect(send(value)).rejects.toThrow(/quantity/i)
  expect(adapter).not.toHaveBeenCalled()
})
