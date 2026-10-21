import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { StockAdjustModal } from './StockAdjustModal'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
const product = {
  id: 1,
  name: 'Rice',
  unit: 'kg',
  unitPrice: '10.00',
  description: null,
  isActive: true,
  createdAt: '',
  updatedAt: '',
}
function mount(failPair = false) {
  const mutations: string[] = []
  apiClient.defaults.adapter = async (config) => {
    if (config.method !== 'get') mutations.push(config.url!)
    if (config.url?.startsWith('/stock-items/pair/') && failPair)
      throw new AxiosError('Network Error')
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data:
        config.url === '/warehouses'
          ? [{ id: 1, name: 'Main', isActive: true }]
          : config.url?.startsWith('/stock-items/pair/')
            ? null
            : [],
    }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <StockAdjustModal open inventoryItem={product} warehouseId={1} onClose={vi.fn()} />
    </QueryClientProvider>,
  )
  return mutations
}
it('does not create stock when the existing warehouse balance cannot be verified', async () => {
  const mutations = mount(true)
  expect((await screen.findByRole('alert')).textContent).toMatch(/connect|network/i)
  expect(screen.getByRole('button', { name: 'Allocate Stock' }).hasAttribute('disabled')).toBe(true)
  expect(mutations).toEqual([])
})
it('does not silently turn blank or over-precise stock input into a zero balance', async () => {
  const mutations = mount()
  const button = screen.getByRole('button', { name: 'Allocate Stock' })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  for (const value of ['', '1.234']) {
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value } })
    expect(button.hasAttribute('disabled')).toBe(true)
  }
  expect(mutations).toEqual([])
})
