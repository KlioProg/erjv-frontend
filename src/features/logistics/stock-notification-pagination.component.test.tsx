import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { useStockAlerts } from './stock-alerts.hooks'
import { useStockWarnings } from './stock-warnings.hooks'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

it('labels loaded warnings and withholds global depletion until stock and metadata pages finish', async () => {
  const requests: { path: string; cursor?: string }[] = []
  const product = (id: number) => ({ id, name: `Product ${id}`, unit: 'kg', isActive: true })
  const warehouse = (id: number) => ({ id, name: `Warehouse ${id}`, isActive: true })
  const stock = (id: number, availableQuantity: string) => ({ id, inventoryItemId: id, warehouseId: id, availableQuantity, stockStatus: availableQuantity === '0' ? 'OUT' : 'NORMAL' })
  apiClient.defaults.adapter = async (config) => {
    const path = config.url!
    const cursor = config.params?.cursor
    requests.push({ path, cursor })
    if (path !== '/stock-items') expect(config.params.includeInactive).toBe(path === '/warehouses' ? 'true' : 'false')
    const second = Boolean(cursor)
    const items = path === '/inventory-items' ? [product(second ? 2 : 1)]
      : path === '/warehouses' ? [warehouse(second ? 2 : 1)]
        : [stock(second ? 2 : 1, second ? '9' : '0')]
    return { config, headers: {}, status: 200, statusText: 'OK', data: { items, nextCursor: second ? null : `${path}-page-2` } }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  const { result } = renderHook(() => ({ warnings: useStockWarnings(), alerts: useStockAlerts() }), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  await waitFor(() => expect(result.current.warnings.loading).toBe(false))
  expect(result.current.warnings.complete).toBe(false)
  expect(result.current.warnings.warnings).toHaveLength(1)
  expect(result.current.alerts.verified).toBe(false)
  expect(result.current.alerts.alerts).toEqual([])
  expect(requests).toHaveLength(3)
  await act(async () => { await result.current.warnings.loadNext() })
  await waitFor(() => expect(result.current.alerts.verified).toBe(true))
  expect(result.current.warnings.complete).toBe(true)
  expect(result.current.alerts.alerts.map((alert) => alert.scope).sort()).toEqual(['overall', 'warehouse'])
  expect(requests.filter((request) => request.cursor)).toHaveLength(3)
  await act(async () => { await result.current.alerts.refresh() })
  await waitFor(() => expect(result.current.warnings.hasMore).toBe(true))
  expect(result.current.alerts.verified).toBe(false)
  expect(result.current.alerts.alerts).toEqual([])
  expect(requests.slice(-3).every((request) => request.cursor === undefined)).toBe(true)
})
