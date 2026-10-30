import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { apiClient, extractArray } from '@/lib/api-client'
import {
  createOutgoingDeliveryApi,
  readyOutgoingDeliveryApi,
  reopenOutgoingDeliveryApi,
  cancelOutgoingDeliveryApi,
} from './logistics/outgoing-deliveries.api'
import { reconcileRunMemberApi } from './logistics/delivery-runs.api'
import { updateSalesOrderDraftApi } from './crm/sales-orders.api'
import { createVehicleApi, updateVehicleDetailsApi } from './logistics/delivery-vehicles.api'
import { replaceEmployeeJobsApi } from './staffing/staffing.api'
import { useReplaceEmployeeJobs, staffingKeys } from './staffing/staffing.hooks'
import { fetchSupplierPricesApi, saveSupplierPriceApi } from './logistics/supplier-pricing.api'
import type { PropsWithChildren } from 'react'
import { createProductApi, updateProductPriceApi } from './products/products.api'

it.each([1.001, -1, NaN, Infinity, '1e2', '10000000000'])(
  'rejects catalog prices %s instead of silently rounding',
  async (unitPrice) => {
    await expect(createProductApi({ name: 'Rice', unit: 'bag', unitPrice })).rejects.toThrow(/price/)
    await expect(updateProductPriceApi(1, unitPrice)).rejects.toThrow(/price/)
    expect(calls).toHaveLength(0)
  },
)

const original = apiClient.defaults.adapter
let calls: { method: string; url: string; body: unknown }[]
beforeEach(() => {
  calls = []
  apiClient.defaults.adapter = async (config) => {
    calls.push({
      method: config.method ?? '',
      url: config.url ?? '',
      body: config.data ? JSON.parse(config.data) : undefined,
    })
    return { config, data: { id: 90, status: 'DRAFT' }, status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
  vi.restoreAllMocks()
})

it('strips obsolete stock/vehicle assignments from outgoing header creation', async () => {
  const stale = {
    salesOrderId: 7,
    notes: ' Plan ',
    scheduledAt: '2026-10-30T09:00:00Z',
    deliveryVehicleId: 1,
    driverEmployeeId: 2,
    items: [{ salesOrderItemId: 10, stockItemId: 30, quantity: '100' }],
  }
  await createOutgoingDeliveryApi(stale)
  expect(calls[0].body).toEqual({ salesOrderId: 7, notes: 'Plan' })
})
it('requires saved positive revisions for readiness, reopening, cancellation and SO draft updates', async () => {
  for (const operation of [readyOutgoingDeliveryApi, reopenOutgoingDeliveryApi, cancelOutgoingDeliveryApi])
    for (const value of [0, -1, NaN, undefined, 1.5])
      await expect(operation(90, value as number)).rejects.toThrow(/Refresh/)
  await expect(updateSalesOrderDraftApi(7, { expectedRevision: 0 })).rejects.toThrow(/revision/)
  expect(calls).toHaveLength(0)
  await readyOutgoingDeliveryApi(90, 4)
  await reopenOutgoingDeliveryApi(90, 5)
  await cancelOutgoingDeliveryApi(90, 6)
  expect(calls).toEqual([
    { method: 'patch', url: '/outgoing-deliveries/90/ready', body: { expectedRevision: 4 } },
    { method: 'patch', url: '/outgoing-deliveries/90/reopen', body: { expectedRevision: 5 } },
    { method: 'patch', url: '/outgoing-deliveries/90/cancel', body: { expectedRevision: 6 } },
  ])
})
it.each(['1.001', '1e2', '-1', '10000000000', 'garbage'])(
  'rejects invalid vehicle capacity %s without rounding or dropping it',
  async (capacity) => {
    await expect(
      createVehicleApi({ plateNumber: 'TEST', vehicleType: 'Truck', capacityKg: capacity }),
    ).rejects.toThrow(/capacity/i)
    await expect(updateVehicleDetailsApi(1, { capacityKg: capacity })).rejects.toThrow(/capacity/i)
    expect(calls).toHaveLength(0)
  },
)
it('keeps large vehicle capacities exact and preserves null clearing', async () => {
  await updateVehicleDetailsApi(1, { capacityKg: '9999999999.99' })
  expect(calls[0].body).toEqual({ capacityKg: '9999999999.99' })
  await updateVehicleDetailsApi(1, { capacityKg: null })
  expect(calls[1].body).toEqual({ capacityKg: null })
})
it('removes final employee positions through supported DELETE routes rather than an empty replacement', async () => {
  apiClient.defaults.adapter = async (config) => {
    calls.push({ method: config.method ?? '', url: config.url ?? '', body: config.data })
    return {
      config,
      data:
        config.method === 'get'
          ? [
              { employeeId: 4, jobId: 2 },
              { employeeId: 4, jobId: 3 },
            ]
          : {},
      status: 200,
      statusText: 'OK',
      headers: {},
    }
  }
  await replaceEmployeeJobsApi(4, [])
  expect(calls.map((call) => [call.method, call.url])).toEqual([
    ['get', '/employee-jobs/employees/4/jobs'],
    ['delete', '/employee-jobs/employees/4/jobs/2'],
    ['delete', '/employee-jobs/employees/4/jobs/3'],
  ])
})
it('refreshes position queries even when clearing several assignments only partially succeeds', async () => {
  apiClient.defaults.adapter = async (config) => {
    if (config.url?.endsWith('/3'))
      throw {
        isAxiosError: true,
        response: { status: 409, data: { message: 'Assignment changed' } },
      }
    return {
      config,
      data:
        config.method === 'get'
          ? [
              { employeeId: 4, jobId: 2 },
              { employeeId: 4, jobId: 3 },
            ]
          : {},
      status: 200,
      statusText: 'OK',
      headers: {},
    }
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  client.setQueryData(staffingKeys.employeeJobs(4), [])
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(useReplaceEmployeeJobs, { wrapper })
  await act(async () => {
    await expect(result.current.mutateAsync({ employeeId: 4, jobIds: [] })).rejects.toBeTruthy()
  })
  await waitFor(() =>
    expect(client.getQueryState(staffingKeys.employeeJobs(4))?.isInvalidated).toBe(true),
  )
})
it('reports unsupported supplier pricing without sending invented endpoint requests', async () => {
  await expect(fetchSupplierPricesApi(1)).rejects.toThrow(/not available/)
  await expect(
    saveSupplierPriceApi({ supplierId: 1, inventoryItemId: 1, latestUnitCost: '5.00' }),
  ).rejects.toThrow(/not available/)
  expect(calls).toHaveLength(0)
})
it('fails clearly for unexpected list responses while preserving supported array wrappers', () => {
  expect(extractArray({ items: [{ id: 1 }] })).toEqual([{ id: 1 }])
  expect(extractArray([])).toEqual([])
  expect(() => extractArray({ error: 'incomplete response' })).toThrow(/incomplete list/)
})
it('serializes all reconciliation categories and requires a discrepancy reason', async () => {
  const line = {
    outgoingDeliveryItemId: 901,
    deliveredQuantity: '1.25',
    returnedSellableQuantity: '0.25',
    returnedDamagedQuantity: '0.50',
    missingQuantity: '0.00',
    discrepancyReason: ' Damaged bag ',
  }
  await reconcileRunMemberApi(9, 90, { expectedRevision: 4, items: [line] })
  expect(calls[0].url).toBe('/delivery-runs/9/deliveries/90/reconcile')
  expect(calls[0].body).toEqual({ expectedRevision: 4, items: [{ ...line, discrepancyReason: 'Damaged bag' }] })
  await expect(
    reconcileRunMemberApi(9, 90, { expectedRevision: 4, items: [{ ...line, discrepancyReason: '' }] }),
  ).rejects.toThrow(/Explain/)
})
