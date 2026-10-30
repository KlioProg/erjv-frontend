import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { createStockItemApi, createStockAdjustmentApi, setReorderThresholdApi } from './stock-items.api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })
const base = { expectedRevision: 3, reason: 'Cycle count', requestId: '4265d0c1-7b54-4a61-8c76-656b8f6c72a1' }
it('creates only the product and warehouse allocation, stripping obsolete initial quantity', async () => {
  apiClient.defaults.adapter = async (config) => {
    expect(config.method).toBe('post')
    expect(config.url).toBe('/stock-items')
    expect(JSON.parse(config.data)).toEqual({ inventoryItemId: 1, warehouseId: 2 })
    return { config, data: { id: 1, inventoryItemId: 1, warehouseId: 2, revision: 1 }, status: 201, statusText: '', headers: {} }
  }
  await createStockItemApi({ inventoryItemId: 1, warehouseId: 2, quantity: '99' } as never)
})
it.each(['SET', 'INCREASE', 'DECREASE'] as const)('posts exact %s adjustment and retains precision', async (kind) => {
  const quantity = '9999999999.99'
  apiClient.defaults.adapter = async (config) => {
    expect(config.method).toBe('post')
    expect(config.url).toBe('/stock-items/1/adjustments')
    expect(JSON.parse(config.data)).toEqual({ ...base, kind, quantity })
    return { config, data: { ...base, stockItemId: 1, kind, submittedQuantity: quantity, beforeRevision: 3, afterRevision: 4 }, status: 201, statusText: '', headers: {} }
  }
  await createStockAdjustmentApi(1, { ...base, kind, quantity })
})
it.each(['SET', 'INCREASE', 'DECREASE'] as const)('rejects invalid %s decimals before transport', async (kind) => {
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  for (const quantity of ['', '1.001', '-1', '1e2', ...(kind === 'SET' ? [] : ['0'])])
    await expect(createStockAdjustmentApi(1, { ...base, kind, quantity })).rejects.toThrow(/quantity/i)
  expect(adapter).not.toHaveBeenCalled()
})
it('validates revision, reason, and UUID before transport', async () => {
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  for (const patch of [{ expectedRevision: 0 }, { reason: ' ' }, { requestId: 'broken' }])
    await expect(createStockAdjustmentApi(1, { ...base, kind: 'SET', quantity: '0', ...patch })).rejects.toThrow()
  expect(adapter).not.toHaveBeenCalled()
})
it('does not accept an unrelated or unconfirmed adjustment response', async () => {
  apiClient.defaults.adapter = async (config) => ({ config, data: { id: 1, stockItemId: 2 }, status: 200, statusText: '', headers: {} })
  await expect(createStockAdjustmentApi(1, { ...base, kind: 'SET', quantity: '0' })).rejects.toThrow(/did not confirm/)
})
it('preserves reorder threshold precision and rejects invalid values', async () => {
  const adapter = vi.fn(async (config) => ({ config, data: {}, status: 200, statusText: '', headers: {} }))
  apiClient.defaults.adapter = adapter
  await setReorderThresholdApi(1, { reorderThreshold: '9999999999.99' })
  expect(JSON.parse(adapter.mock.calls[0][0].data).reorderThreshold).toBe('9999999999.99')
  adapter.mockClear()
  for (const value of ['', '1.001', '-1', '1e2']) await expect(setReorderThresholdApi(1, { reorderThreshold: value })).rejects.toThrow(/threshold/i)
  expect(adapter).not.toHaveBeenCalled()
})
