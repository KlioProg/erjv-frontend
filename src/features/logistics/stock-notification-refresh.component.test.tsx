import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { StockNotifications } from '@/components/layout/StockNotifications'
import { useStockWarnings } from './stock-warnings.hooks'
import { useCursorLookup } from '@/lib/use-cursor-lookup'

const original = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = original })

it('refreshes loaded pages when new records shift their cursor boundaries', async () => {
  let shifted = false
  apiClient.defaults.adapter = async (config) => {
    const cursor = config.params.cursor
    const page = shifted
      ? cursor ? { items: [{ id: 4 }], nextCursor: 'old-a' } : { items: [{ id: 5 }], nextCursor: 'new-a' }
      : cursor ? { items: [{ id: 3 }], nextCursor: 'old-b' } : { items: [{ id: 4 }], nextCursor: 'old-a' }
    return { config, status: 200, statusText: 'OK', headers: {}, data: page }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { result } = renderHook(() => useCursorLookup<{ id: number }>('/stock-items'), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual([4]))
  await act(async () => { await result.current.fetchNextPage() })
  await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual([4, 3]))
  shifted = true
  await act(async () => { expect((await result.current.refetch()).isError).toBe(false) })
  await waitFor(() => expect(result.current.items.map((item) => item.id)).toEqual([5, 4]))
  expect(result.current.isError).toBe(false)
  expect(result.current.hasNextPage).toBe(true)
  client.clear()
})

it.each([false, true])('retains shared warnings during a notification refresh (failure: %s)', async (fail) => {
  let refresh = false
  let failure = fail
  let requests = 0
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  apiClient.defaults.adapter = async (config) => {
    requests++
    if (refresh) {
      await pending
      if (failure && config.url === '/stock-items') throw Error('Warning refresh failed')
    }
    const items = config.url === '/inventory-items'
      ? [{ id: 1, name: 'Rice', unit: 'bags', isActive: true }]
      : config.url === '/warehouses'
        ? [{ id: 2, name: 'Central', isActive: true }]
        : [{ id: 3, inventoryItemId: 1, warehouseId: 2, availableQuantity: refresh ? '2.00' : '0.00', stockStatus: refresh ? 'LOW' : 'OUT', reorderThreshold: '5.00' }]
    return { config, status: 200, statusText: 'OK', headers: {}, data: { items, nextCursor: null } }
  }
  function Preview() {
    const warnings = useStockWarnings()
    return <output aria-label="Dashboard stock preview">{warnings.loading ? 'Loading summary' : warnings.unavailable ? 'Unavailable' : warnings.warnings.map((warning) => `${warning.severity}:${warning.quantityCents}`).join(',')}</output>
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  render(<QueryClientProvider client={client}><Preview /><StockNotifications onOpenInventory={vi.fn()} /></QueryClientProvider>)
  const preview = screen.getByLabelText('Dashboard stock preview')
  await waitFor(() => expect(preview.textContent).toBe('OUT:0'))
  expect(requests).toBe(3)
  refresh = true
  await userEvent.click(screen.getByRole('button', { name: /Stock notifications/ }))
  await waitFor(() => expect(requests).toBe(6))
  const duringRefresh = preview.textContent
  release()
  await waitFor(() => expect(preview.textContent).toBe(fail ? 'Unavailable' : 'LOW:200'))
  expect(duringRefresh).toBe('OUT:0')
  if (fail) {
    expect(screen.getByText('Stock warnings could not be loaded.')).toBeTruthy()
    failure = false
    await userEvent.click(screen.getByRole('menuitem', { name: 'Retry loading warnings' }))
    await waitFor(() => expect(preview.textContent).toBe('LOW:200'))
  }
  client.clear()
})
