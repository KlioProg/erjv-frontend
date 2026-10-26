import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { useDeactivateWarehouse, WAREHOUSES_QUERY_KEY } from './warehouses.hooks'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

it.each(['confirmed', 'rejected', 'unexpected'])(
  'waits for server confirmation before changing warehouse visibility (%s)',
  async (outcome) => {
    const reject = outcome !== 'confirmed'
    vi.spyOn(toast, 'success').mockReturnValue('test')
    vi.spyOn(toast, 'error').mockReturnValue('test')
    let finish!: () => void
    const gate = new Promise<void>((resolve) => {
      finish = resolve
    })
    apiClient.defaults.adapter = async (config) => {
      await gate
      if (outcome === 'rejected')
        throw {
          isAxiosError: true,
          response: { status: 409, data: { message: 'Warehouse still has inventory' } },
        }
      return {
        config,
        data: { id: 1, name: 'Main', isActive: outcome === 'unexpected' },
        headers: {},
        status: 200,
        statusText: 'OK',
      }
    }
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    const key = [...WAREHOUSES_QUERY_KEY, 'true']
    client.setQueryData(key, [{ id: 1, name: 'Main', isActive: true }])
    const { result } = renderHook(() => useDeactivateWarehouse(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    })
    let pending!: Promise<unknown>
    act(() => {
      pending = result.current.mutateAsync(1).catch((error: unknown) => error)
    })
    expect(client.getQueryData(key)).toEqual([{ id: 1, name: 'Main', isActive: true }])
    expect(toast.success).not.toHaveBeenCalled()
    await act(async () => {
      finish()
      await pending
    })
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
    expect(toast.success).toHaveBeenCalledTimes(reject ? 0 : 1)
    if (reject) expect(client.getQueryData(key)).toEqual([{ id: 1, name: 'Main', isActive: true }])
  },
)
