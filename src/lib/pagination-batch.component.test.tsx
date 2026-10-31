import { EmployeePositionSelector } from '@/components/staffing/EmployeePositionSelector'
import { InventoryItemCatalog } from '@/components/inventory/InventoryItemCatalog'
import { within } from '@testing-library/react'
import { vi } from 'vitest'
import type { PropsWithChildren } from 'react'
import { act, renderHook, waitFor, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it } from 'vitest'
import { apiClient } from './api-client'
import { useResourcePage } from './use-cursor-page'
import { useCursorLookup } from './use-cursor-lookup'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { fetchClientsApi, searchClientsByNameApi } from '@/features/crm/clients.api'
import { fetchSuppliersApi } from '@/features/logistics/suppliers.api'
import { fetchProductsApi } from '@/features/products/products.api'
import { fetchWarehousesApi } from '@/features/logistics/warehouses.api'
import { fetchEmployeesApi, fetchJobsApi, fetchUsersApi } from '@/features/staffing/staffing.api'
import {
  fetchDeliveryVehiclesApi,
  fetchAvailableVehiclesApi,
} from '@/features/logistics/delivery-vehicles.api'

vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isAdmin: false, isManager: false }) }))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
function provider() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    client,
    wrapper: ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  }
}
const paths = [
  '/suppliers',
  '/employees',
  '/users',
  '/jobs',
  '/warehouses',
  '/inventory-items',
  '/delivery-vehicles',
  '/stock-items',
  '/stock-items/warehouses/2',
  '/stock-items/inventory-items/3',
  '/stock-items/4/adjustments',
  '/stock-items/quarantine-lots',
  '/incoming-deliveries',
  '/outgoing-deliveries',
  '/delivery-runs',
]
it.each(paths)(
  'pages %s without downloading other pages, deduplicates and preserves filters',
  async (path) => {
    const reads: Record<string, unknown>[] = []
    apiClient.defaults.adapter = async (config) => {
      reads.push(config.params)
      return {
        config,
        headers: {},
        status: 200,
        statusText: '',
        data: {
          items: config.params.cursor ? [{ id: 8 }, { id: 3 }, { id: 8 }] : [{ id: 1 }],
          nextCursor: config.params.cursor ? null : 'opaque',
        },
      }
    }
    const { wrapper, client } = provider()
    const { result } = renderHook(() => useResourcePage<{ id: number }>(path), { wrapper })
    await waitFor(() => expect(result.current.items).toEqual([{ id: 1 }]))
    expect(reads).toHaveLength(1)
    expect(result.current.hasPrevious).toBe(false)
    act(() => result.current.next())
    await waitFor(() => expect(result.current.items).toEqual([{ id: 8 }, { id: 3 }]))
    expect(reads[1]).toEqual({ limit: 50, cursor: 'opaque' })
    expect(result.current.hasNext).toBe(false)
    act(() => result.current.previous())
    await waitFor(() => expect(result.current.items).toEqual([{ id: 1 }]))
    const resource = path.split('/')[1]
    await act(() =>
      client.invalidateQueries({
        queryKey: [
          ['employees', 'users', 'jobs'].includes(resource)
            ? 'staffing'
            : resource === 'inventory-items'
              ? 'products'
              : resource,
        ],
      }),
    )
    expect(reads.filter((params) => !params.cursor).length).toBeGreaterThan(1)
  },
)

it('resets search, status scope and size without combining new filters with an old cursor', async () => {
  const reads: Record<string, unknown>[] = []
  apiClient.defaults.adapter = async (config) => {
    reads.push(config.params)
    return {
      config,
      headers: {},
      status: 200,
      statusText: '',
      data: {
        items: [{ id: config.params.cursor ? 2 : 1 }],
        nextCursor: config.params.cursor ? null : 'opaque',
      },
    }
  }
  const { wrapper } = provider()
  const { result, rerender } = renderHook(
    ({ q, includeInactive }) => useResourcePage<{ id: number }>('/jobs', { q, includeInactive }),
    { wrapper, initialProps: { q: '', includeInactive: 'false' } },
  )
  await waitFor(() => expect(result.current.items).toHaveLength(1))
  act(() => result.current.next())
  await waitFor(() => expect(result.current.page).toBe(2))
  rerender({ q: 'new', includeInactive: 'only' })
  await waitFor(() => expect(reads.at(-1)).toMatchObject({ q: 'new', includeInactive: 'only' }))
  expect(reads.at(-1)?.cursor).toBeUndefined()
  expect(result.current.page).toBe(1)
  act(() => result.current.setPageSize(25))
  await waitFor(() => expect(reads.at(-1)?.limit).toBe(25))
  expect(reads.at(-1)?.cursor).toBeUndefined()
})

it.each([
  fetchClientsApi,
  fetchSuppliersApi,
  fetchProductsApi,
  fetchWarehousesApi,
  fetchEmployeesApi,
  fetchJobsApi,
  fetchUsersApi,
  fetchDeliveryVehiclesApi,
  fetchAvailableVehiclesApi,
])(
  'complete reference adapter %s traverses envelopes and keeps opaque cursors',
  async (fetchList) => {
    const reads: Record<string, unknown>[] = []
    apiClient.defaults.adapter = async (config) => {
      reads.push(config.params)
      return {
        config,
        headers: {},
        status: 200,
        statusText: '',
        data: {
          items: [{ id: config.params.cursor ? 2 : 1 }],
          nextCursor: config.params.cursor ? null : 'opaque',
        },
      }
    }
    const items = await fetchList()
    expect(items.map((item) => item.id)).toEqual([1, 2])
    expect(reads).toEqual([{ limit: 50 }, { limit: 50, cursor: 'opaque' }])
  },
)

it('rejects cursor loops in searchable lookups without retrying forever and resets on reload', async () => {
  let reads = 0
  apiClient.defaults.adapter = async (config) => {
    reads++
    return {
      config,
      headers: {},
      status: 200,
      statusText: '',
      data: { items: [{ id: reads }], nextCursor: 'opaque' },
    }
  }
  const { wrapper } = provider()
  const { result } = renderHook(() => useCursorLookup<{ id: number }>('/jobs'), { wrapper })
  await waitFor(() => expect(result.current.items).toHaveLength(1))
  await act(async () => {
    await result.current.fetchNextPage()
  })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(reads).toBe(2)
  await act(async () => {
    await result.current.reload()
  })
  expect(result.current.items).toHaveLength(1)
  expect(reads).toBe(3)
})

it('looks up an off-page selection by ID, searches remotely, and retains the chosen label', async () => {
  const reads: string[] = []
  apiClient.defaults.adapter = async (config) => {
    reads.push(config.url!)
    const data =
      config.url === '/jobs/99'
        ? { id: 99, name: 'Previously selected' }
        : {
            items: config.params.q
              ? [{ id: 2, name: 'Remote match' }]
              : [{ id: 1, name: 'First result' }],
            nextCursor: null,
          }
    return { config, headers: {}, status: 200, statusText: '', data }
  }
  const { wrapper } = provider()
  const user = userEvent.setup()
  const { rerender } = render(
    <CursorLookup<{ id: number; name: string }>
      id="jobs"
      path="/jobs"
      value="99"
      onChange={() => {}}
      label="Job"
      getLabel={(record) => record.name}
    />,
    { wrapper },
  )
  await screen.findByText('Previously selected')
  expect(reads).toEqual(['/jobs/99'])
  await user.click(screen.getByRole('button', { name: 'Choose job' }))
  await screen.findByRole('menuitem', { name: 'First result' })
  await user.type(screen.getByRole('searchbox'), 'Remote')
  await screen.findByRole('menuitem', { name: 'Remote match' })
  expect(screen.getByText('Previously selected')).toBeTruthy()
  await user.keyboard('{Escape}')
  rerender(
    <CursorLookup<{ id: number; name: string }>
      id="jobs"
      path="/jobs"
      value="99"
      onChange={() => {}}
      label="Job"
      getLabel={(record) => record.name}
      disabled
    />,
  )
  expect(screen.getByRole('button', { name: 'Choose job' }).hasAttribute('disabled')).toBe(true)
})


it('loads product stock locations from their scoped endpoint across multiple pages', async () => {
  const reads: { url: string; params: Record<string, unknown> }[] = []
  apiClient.defaults.adapter = async config => {
    reads.push({ url: config.url!, params: config.params ?? {} })
    let data: unknown = { items: [], nextCursor: null }
    if (config.url === '/inventory-items') data = { items: [{ id: 1, name: 'Scoped Rice', isActive: true, unit: 'kg', unitPrice: '1.00' }], nextCursor: null }
    if (config.url === '/stock-items') data = { items: [{ id: 99, inventoryItemId: 999, warehouseId: 3, onHandQuantity: '1.00', availableQuantity: '1.00' }], nextCursor: 'other-stock' }
    if (config.url === '/stock-items/inventory-items/1') data = { items: [{ id: config.params.cursor ? 8 : 4, inventoryItemId: 1, warehouseId: config.params.cursor ? 2 : 1, warehouse: { id: config.params.cursor ? 2 : 1, name: config.params.cursor ? 'Later warehouse' : 'First warehouse' }, availableQuantity: '12.50', quarantinedQuantity: '0.00' }], nextCursor: config.params.cursor ? null : 'locations-next' }
    return { config, data, headers: {}, status: 200, statusText: '' }
  }
  const { wrapper } = provider()
  const user = userEvent.setup()
  render(<InventoryItemCatalog />, { wrapper })
  await screen.findByText('Scoped Rice')
  expect(reads.some(read => read.url.includes('/inventory-items/1'))).toBe(false)
  await user.click(screen.getByRole('button', { name: 'Show stock by location for Scoped Rice' }))
  await screen.findByText('First warehouse')
  expect(reads.filter(read => read.url === '/stock-items/inventory-items/1')).toHaveLength(1)
  const pages = () => within(screen.getByRole('navigation', { name: 'Stock location pages' }))
  await user.click(pages().getByRole('button', { name: 'Next' }))
  await screen.findByText('Later warehouse')
  expect(screen.queryByText('First warehouse')).toBeNull()
  expect(reads.at(-1)).toMatchObject({ url: '/stock-items/inventory-items/1', params: { cursor: 'locations-next', limit: 50 } })
  await user.click(pages().getByRole('button', { name: 'Previous' }))
  await screen.findByText('First warehouse')
})

it('pages and searches job assignments without dropping assigned off-page IDs', async () => {
  const reads: Record<string, unknown>[] = []
  const writes: unknown[] = []
  apiClient.defaults.adapter = async config => {
    let data: unknown = []
    if (config.url === '/jobs') {
      reads.push(config.params)
      data = { items: [{ id: config.params.cursor || config.params.q ? 2 : 1, name: config.params.cursor || config.params.q ? 'Remote Job' : 'First Job', isActive: true }], nextCursor: config.params.cursor || config.params.q ? null : 'jobs-next' }
    } else if (config.method === 'put') writes.push(JSON.parse(config.data))
    else data = [{ id: 8, employeeId: 5, jobId: 90, job: { id: 90, name: 'Assigned outside page' } }]
    return { config, data, headers: {}, status: 200, statusText: '' }
  }
  const { wrapper } = provider()
  const user = userEvent.setup()
  render(<EmployeePositionSelector employeeId={5} employeeName="Staff" canEdit />, { wrapper })
  await user.click(await screen.findByRole('button', { name: /Change job positions/ }))
  await user.click(screen.getByRole('button', { name: 'Load more positions' }))
  await screen.findByRole('menuitemcheckbox', { name: 'Remote Job' })
  await user.type(screen.getByRole('textbox', { name: 'Search job positions' }), 'Remote')
  await waitFor(() => expect(reads.at(-1)?.q).toBe('Remote'))
  expect(reads.at(-1)?.cursor).toBeUndefined()
  expect(screen.getByRole('menuitemcheckbox', { name: /Assigned outside page/ }).getAttribute('aria-checked')).toBe('true')
  await user.click(screen.getByRole('menuitemcheckbox', { name: 'Remote Job' }))
  await waitFor(() => expect(writes).toEqual([{ jobIds: [90, 2] }]))
})

it('rejects multi-step lookup cursor cycles instead of claiming the aggregate is complete', async () => {
  apiClient.defaults.adapter = async config => ({ config, headers: {}, status: 200, statusText: '', data: { items: [{ id: config.params.cursor === 'B' ? 3 : config.params.cursor === 'A' ? 2 : 1 }], nextCursor: config.params.cursor === 'B' ? 'A' : config.params.cursor === 'A' ? 'B' : 'A' } })
  const { wrapper } = provider()
  const { result } = renderHook(() => useCursorLookup<{ id: number }>('/jobs'), { wrapper })
  await waitFor(() => expect(result.current.items).toHaveLength(1))
  await act(async () => { await result.current.fetchNextPage() })
  await waitFor(() => expect(result.current.items).toHaveLength(2))
  await act(async () => { await result.current.fetchNextPage() })
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.items).toHaveLength(2)
})


it('uses the supported paginated customer name search instead of the removed search route', async () => {
  const reads: { url: string; params: Record<string, unknown> }[] = []
  apiClient.defaults.adapter = async config => {
    reads.push({ url: config.url!, params: config.params })
    return { config, headers: {}, status: 200, statusText: '', data: { items: [{ id: config.params.cursor ? 2 : 1 }], nextCursor: config.params.cursor ? null : 'matches-next' } }
  }
  expect((await searchClientsByNameApi(' Buyer ')).map(item => item.id)).toEqual([1, 2])
  expect(reads).toEqual([{ url: '/clients', params: { q: 'Buyer', includeInactive: 'true', limit: 50 } }, { url: '/clients', params: { q: 'Buyer', includeInactive: 'true', limit: 50, cursor: 'matches-next' } }])
})
