import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { StockAdjustModal } from './StockAdjustModal'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })
const product = { id: 1, name: 'Rice', unit: 'kg', unitPrice: '10.00', description: null, isActive: true, createdAt: '', updatedAt: '' }
const stock = { id: 5, revision: 3, inventoryItemId: 1, warehouseId: 1, onHandQuantity: '10.00', inTransitQuantity: '2.00', quarantinedQuantity: '1.00', availableQuantity: '9.00', conditionQuantities: { DAMAGED: '1.00', SPOILED: '0.00' }, reorderThreshold: null, stockStatus: 'UNCONFIGURED' as const, createdAt: '', updatedAt: '', inventoryItem: product, warehouse: { id: 1, name: 'Main' } }
function mount({ failPair = false, existing = false, failWrite = false }: { failPair?: boolean; existing?: boolean; failWrite?: boolean } = {}) {
  const mutations: { url: string; body: Record<string, unknown> }[] = []
  const onClose = vi.fn()
  apiClient.defaults.adapter = async (config) => {
    if (config.method !== 'get') {
      const body = JSON.parse(config.data)
      mutations.push({ url: config.url!, body })
      if (failWrite && mutations.length === 1) throw new AxiosError('Network Error')
      return { config, status: 201, statusText: '', headers: {}, data: { ...stock, ...body, stockItemId: 5, submittedQuantity: body.quantity, beforeRevision: body.expectedRevision, afterRevision: Number(body.expectedRevision) + 1 } }
    }
    if (config.url?.startsWith('/stock-items/pair/')) {
      if (failPair) throw new AxiosError('Network Error')
      throw new AxiosError('Not found', 'ERR_BAD_REQUEST', config, undefined, { config, status: 404, statusText: '', headers: {}, data: { code: 'RESOURCE_NOT_FOUND' } })
    }
    const data = config.url === '/stock-items/5' ? stock : config.url?.startsWith('/stock-items/pair/') ? null : { items: [], nextCursor: null }
    return { config, status: 200, statusText: '', headers: {}, data }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><StockAdjustModal open stockItem={existing ? stock : undefined} inventoryItem={product} warehouseId={1} onClose={onClose} /></QueryClientProvider>)
  return { mutations, onClose, client }
}
it('does not create stock when the existing warehouse balance cannot be verified', async () => {
  const { mutations } = mount({ failPair: true })
  expect((await screen.findByRole('alert')).textContent).toMatch(/connect|network/i)
  expect(screen.getByRole('button', { name: 'Allocate Stock' }).hasAttribute('disabled')).toBe(true)
  expect(mutations).toEqual([])
})
it('does not silently turn blank or over-precise stock input into a zero balance', async () => {
  const { mutations } = mount({ existing: true })
  const button = screen.getByRole('button', { name: 'Record Adjustment' })
  fireEvent.change(screen.getByLabelText('Adjustment reason'), { target: { value: 'Cycle count' } })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  for (const value of ['', '1.234']) {
    fireEvent.change(screen.getByLabelText('Adjustment quantity (kg)'), { target: { value } })
    expect(button.hasAttribute('disabled')).toBe(true)
  }
  expect(mutations).toEqual([])
})
it('creates an allocation without submitting initial stock quantities', async () => {
  const { mutations, onClose } = mount()
  const button = screen.getByRole('button', { name: 'Allocate Stock' })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  fireEvent.click(button)
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(mutations).toEqual([{ url: '/stock-items', body: { inventoryItemId: 1, warehouseId: 1 } }])
})
it('keeps the exact revision, reason and UUID on an uncertain-outcome retry', async () => {
  const { mutations, onClose } = mount({ existing: true, failWrite: true })
  fireEvent.change(screen.getByLabelText('Adjustment quantity (kg)'), { target: { value: '1.25' } })
  fireEvent.change(screen.getByLabelText('Adjustment reason'), { target: { value: 'Cycle count' } })
  const button = screen.getByRole('button', { name: 'Record Adjustment' })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  fireEvent.click(button)
  const retry = await screen.findByRole('button', { name: 'Retry Same Adjustment' })
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Adjustment quantity (kg)').hasAttribute('disabled')).toBe(true)
  fireEvent.click(retry)
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(mutations).toHaveLength(2)
  expect(mutations[1]).toEqual(mutations[0])
  expect(mutations[0].body).toMatchObject({ kind: 'INCREASE', quantity: '1.25', expectedRevision: 3, reason: 'Cycle count' })
  expect(mutations[0].body.requestId).toMatch(/^[0-9a-f-]{36}$/)
})
