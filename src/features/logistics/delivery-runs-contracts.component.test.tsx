import { afterEach, expect, it, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { apiClient } from '@/lib/api-client'
import * as api from './delivery-runs.api'
import { useDispatchDeliveryRun, useReconcileRunMember, useDeliveryRuns } from './delivery-runs.hooks'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => { apiClient.defaults.adapter = originalAdapter })

const member = { deliveryId: 3, expectedRevision: 7 }
const dispatch = {
  expectedRevision: 2, loadedWeightKg: '12.50',
  loads: [{ ...member, items: [{ salesOrderItemId: 8, stockItemId: 9, loadedQuantity: '4.25' }] }],
}
const reconcile = {
  expectedRevision: 8,
  items: [{ outgoingDeliveryItemId: 10, deliveredQuantity: '3.00', returnedSellableQuantity: '0.25', returnedDamagedQuantity: '0.50', missingQuantity: '0.50', discrepancyReason: 'Damaged in transit and missing' }],
}

it.each([
  { method: 'post', path: '', body: { warehouseId: 1, deliveries: [member] }, send: () => api.createDeliveryRunApi({ warehouseId: 1, deliveries: [member], legacy: true } as never) },
  { method: 'patch', path: '/4/draft', body: { expectedRevision: 2, notes: null, driverEmployeeId: null }, send: () => api.updateDeliveryRunDraftApi(4, { expectedRevision: 2, notes: null, driverEmployeeId: null, deliveries: [member] } as never) },
  { method: 'patch', path: '/4/deliveries', body: { expectedRevision: 2, add: [member], remove: [] }, send: () => api.changeRunMembersApi(4, { expectedRevision: 2, add: [member], remove: [] }) },
  { method: 'patch', path: '/4/deliveries/3/reopen', body: { expectedRunRevision: 2, expectedDeliveryRevision: 7 }, send: () => api.reopenRunMemberApi(4, 3, { expectedRunRevision: 2, expectedDeliveryRevision: 7 }) },
  { method: 'patch', path: '/4/deliveries/3/cancel', body: { expectedRunRevision: 2, expectedDeliveryRevision: 7 }, send: () => api.cancelRunMemberApi(4, 3, { expectedRunRevision: 2, expectedDeliveryRevision: 7 }) },
  { method: 'patch', path: '/4/cancel', body: { expectedRevision: 2 }, send: () => api.cancelDeliveryRunApi(4, 2) },
  { method: 'patch', path: '/4/dispatch', body: dispatch, send: () => api.dispatchDeliveryRunApi(4, dispatch) },
  { method: 'patch', path: '/4/deliveries/3/reconcile', body: reconcile, send: () => api.reconcileRunMemberApi(4, 3, reconcile) },
])('uses exact $method $path run contract', async ({ method, path, body, send }) => {
  const response = path.endsWith('reconcile') ? { delivery: { id: 3 }, run: { id: 4 } } : { id: 4 }
  apiClient.defaults.adapter = async (config) => {
    expect(config.url).toBe(`/delivery-runs${path}`)
    expect(config.method).toBe(method)
    expect(JSON.parse(config.data)).toEqual(body)
    return { config, data: response, status: 200, statusText: '', headers: {} }
  }
  expect(await send()).toEqual(response)
})

it('fetches one cursor page with repeated-key status serialization and cancellation', async () => {
  let calls = 0
  const signal = new AbortController().signal
  apiClient.defaults.adapter = async (config) => {
    calls++
    expect(config.url).toBe('/delivery-runs')
    expect(config.params).toMatchObject({ limit: 25, cursor: 'cursor-1', statuses: ['DRAFT', 'DISPATCHED'], warehouseId: 1, q: 'RUN' })
    expect(config.paramsSerializer).toMatchObject({ indexes: null })
    expect(config.signal).toBe(signal)
    return { config, data: { items: [], nextCursor: 'cursor-2' }, status: 200, statusText: '', headers: {} }
  }
  expect(await api.fetchDeliveryRunsPageApi({ limit: 25, cursor: 'cursor-1', statuses: ['DRAFT', 'DISPATCHED'], warehouseId: 1, q: 'RUN' }, signal)).toEqual({ items: [], nextCursor: 'cursor-2' })
  expect(calls).toBe(1)
})

it.each([
  () => api.cancelDeliveryRunApi(4, 0),
  () => api.updateDeliveryRunDraftApi(4, { expectedRevision: undefined } as never),
  () => api.reopenRunMemberApi(4, 3, { expectedRunRevision: 2, expectedDeliveryRevision: 0 }),
  () => api.changeRunMembersApi(4, { expectedRevision: 2, add: [{ ...member, expectedRevision: 0 }] }),
  () => api.dispatchDeliveryRunApi(4, { ...dispatch, loads: [{ ...dispatch.loads[0], expectedRevision: 0 }] }),
  () => api.dispatchDeliveryRunApi(4, { ...dispatch, loads: [dispatch.loads[0], dispatch.loads[0]] }),
  () => api.dispatchDeliveryRunApi(4, { ...dispatch, loadedWeightKg: '0' }),
  () => api.dispatchDeliveryRunApi(4, { ...dispatch, loadedWeightKg: '12.345' }),
  () => api.dispatchDeliveryRunApi(4, { ...dispatch, loads: [{ ...dispatch.loads[0], items: [{ ...dispatch.loads[0].items[0], loadedQuantity: '-1' }] }] }),
  () => api.reconcileRunMemberApi(4, 3, { ...reconcile, expectedRevision: 0 }),
  () => api.reconcileRunMemberApi(4, 3, { ...reconcile, items: [reconcile.items[0], reconcile.items[0]] }),
  () => api.reconcileRunMemberApi(4, 3, { ...reconcile, items: [{ ...reconcile.items[0], discrepancyReason: '' }] }),
])('rejects invalid workflow inputs before HTTP (%#)', async (send) => {
  let calls = 0
  apiClient.defaults.adapter = async () => { calls++; throw new Error('Unexpected request') }
  await expect(send()).rejects.toThrow()
  expect(calls).toBe(0)
})

it('preserves server conflict details without retry or fallback endpoint', async () => {
  const conflict = new Error('STALE_REVISION')
  let calls = 0
  apiClient.defaults.adapter = async () => { calls++; throw conflict }
  await expect(api.dispatchDeliveryRunApi(4, dispatch)).rejects.toBe(conflict)
  expect(calls).toBe(1)
})

it.each([false, true])('refreshes all affected operational queries after dispatch (error=%s)', async (failed) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  apiClient.defaults.adapter = async (config) => {
    if (failed) throw new Error('STALE_REVISION')
    return { config, data: { id: 4, status: 'DISPATCHED', revision: 3 }, status: 200, statusText: '', headers: {} }
  }
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const { result, unmount } = renderHook(() => useDispatchDeliveryRun(), { wrapper })
  await act(async () => {
    const request = result.current.mutateAsync({ id: 4, payload: dispatch })
    if (failed) await expect(request).rejects.toThrow('STALE_REVISION')
    else await request
  })
  for (const key of ['delivery-runs', 'outgoing-deliveries', 'sales-orders', 'stock-items', 'quarantine-lots', 'delivery-vehicles', 'staffing', 'products', 'warehouses'])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
  if (!failed) expect(client.getQueryData(['delivery-runs', 'id', 4])).toMatchObject({ revision: 3 })
  unmount()
  client.clear()
})

it('stores both authoritative reconciliation responses in their detail caches', async () => {
  const client = new QueryClient()
  const response = { delivery: { id: 3, revision: 9, status: 'RECONCILED' }, run: { id: 4, revision: 4, status: 'COMPLETED' } }
  apiClient.defaults.adapter = async (config) => ({ config, data: response, status: 200, statusText: '', headers: {} })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const { result, unmount } = renderHook(() => useReconcileRunMember(), { wrapper })
  await act(async () => { await result.current.mutateAsync({ id: 4, deliveryId: 3, payload: reconcile }) })
  expect(client.getQueryData(['delivery-runs', 'id', 4])).toEqual(response.run)
  expect(client.getQueryData(['outgoing-deliveries', 'id', 3])).toEqual(response.delivery)
  unmount()
  client.clear()
})

it('loads another run page only when explicitly requested', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const calls: (string | undefined)[] = []
  apiClient.defaults.adapter = async (config) => {
    calls.push(config.params.cursor)
    return { config, data: { items: [], nextCursor: config.params.cursor ? null : 'next' }, status: 200, statusText: '', headers: {} }
  }
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  const { result, unmount } = renderHook(() => useDeliveryRuns(), { wrapper })
  await act(async () => { await client.fetchInfiniteQuery({ queryKey: ['delivery-runs', 'pages', {}], initialPageParam: undefined, queryFn: () => api.fetchDeliveryRunsPageApi() }) })
  expect(calls).toEqual([undefined])
  await act(async () => { await result.current.fetchNextPage() })
  expect(calls).toEqual([undefined, 'next'])
  unmount()
  client.clear()
})
