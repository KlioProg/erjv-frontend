import { afterEach, expect, it } from 'vitest'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { apiClient, getErrorMessage } from '@/lib/api-client'
import { fetchSalesOrdersApi } from './crm/sales-orders.api'
import {
  fetchPurchaseOrdersApi,
  updatePurchaseOrderDraftApi,
} from './logistics/purchase-orders.api'
import { fetchIncomingDeliveriesApi } from './logistics/incoming-deliveries.api'
import { fetchOutgoingDeliveriesApi } from './logistics/outgoing-deliveries.api'
import { outgoingPlanningErrors } from './logistics/outgoing-planning'
import { availableStock } from '@/lib/order-amounts'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
const response = (config: InternalAxiosRequestConfig, data: unknown) => ({
  config,
  status: 200,
  statusText: 'OK',
  headers: {},
  data,
})
function failure(code: string, details?: unknown) {
  const error = new AxiosError('Request failed')
  error.response = {
    ...response({} as InternalAxiosRequestConfig, {
      code,
      message: 'Review the current record',
      details,
    }),
    status: code === 'INVALID_CURSOR' ? 400 : 409,
  }
  return error
}
const lists = [
  {
    name: 'sales',
    fetch: () => fetchSalesOrdersApi({ status: 'DRAFT', clientId: 7, limit: 1 }),
    filter: { statuses: ['DRAFT'], clientId: 7 },
  },
  {
    name: 'purchases',
    fetch: () => fetchPurchaseOrdersApi({ status: 'DRAFT', supplierId: 7, limit: 1 }),
    filter: { statuses: ['DRAFT'], supplierId: 7 },
  },
  {
    name: 'incoming',
    fetch: () =>
      fetchIncomingDeliveriesApi({ status: 'DRAFT', purchaseOrderId: 7, warehouseId: 8, limit: 1 }),
    filter: { statuses: ['DRAFT'], purchaseOrderId: 7, warehouseId: 8 },
  },
  {
    name: 'outgoing',
    fetch: () =>
      fetchOutgoingDeliveriesApi({ status: 'DRAFT', salesOrderId: 7, warehouseId: 8, limit: 1 }),
    filter: { statuses: ['DRAFT'], salesOrderId: 7, warehouseId: 8 },
  },
]

it.each(lists)(
  '$name traverses all pages with filters and full nested lines',
  async ({ fetch, filter }) => {
    const calls: unknown[] = []
    const records = [1, 2, 3].map((id) => ({
      id,
      revision: id,
      items: [{ id: id * 10, quantity: '2.50', nested: { retained: true } }],
    }))
    apiClient.defaults.adapter = async (config) => {
      calls.push(config.params)
      const index = config.params.cursor ? Number(config.params.cursor) : 0
      return response(config, {
        items: [records[index]],
        nextCursor: index < 2 ? String(index + 1) : null,
      })
    }
    await expect(fetch()).resolves.toEqual(records)
    expect(calls).toEqual(
      [undefined, '1', '2'].map((cursor) => ({
        ...filter,
        limit: 1,
        ...(cursor ? { cursor } : {}),
      })),
    )
  },
)

it.each(lists)(
  '$name restarts once after INVALID_CURSOR and discards partial results',
  async ({ fetch }) => {
    let calls = 0
    apiClient.defaults.adapter = async (config) => {
      calls++
      if (calls === 1) return response(config, { items: [{ id: 99 }], nextCursor: '99' })
      if (calls === 2) throw failure('INVALID_CURSOR')
      expect(config.params.cursor).toBeUndefined()
      return response(config, { items: [{ id: 1 }], nextCursor: null })
    }
    await expect(fetch()).resolves.toEqual([{ id: 1 }])
    expect(calls).toBe(3)
  },
)

it('does not return partial results or loop when a restarted cursor also expires', async () => {
  let calls = 0
  apiClient.defaults.adapter = async (config) => {
    calls++
    if (calls % 2 === 0) throw failure('INVALID_CURSOR')
    return response(config, { items: [{ id: 1 }], nextCursor: '1' })
  }
  await expect(fetchSalesOrdersApi()).rejects.toMatchObject({
    response: { data: { code: 'INVALID_CURSOR' } },
  })
  expect(calls).toBe(4)
})

it('distinguishes an empty collection from a failed later page', async () => {
  apiClient.defaults.adapter = async (config) => response(config, { items: [], nextCursor: null })
  await expect(fetchSalesOrdersApi()).resolves.toEqual([])
  apiClient.defaults.adapter = async (config) => {
    if (config.params.cursor) throw new AxiosError('Network Error')
    return response(config, { items: [{ id: 1 }], nextCursor: '1' })
  }
  await expect(fetchSalesOrdersApi()).rejects.toThrow('Network Error')
})

it('supports an initial cursor and defaults to a 50-record page', async () => {
  const cursors: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    expect(config.params.limit).toBe(50)
    cursors.push(config.params.cursor)
    if (config.params.cursor === 'bad') throw failure('INVALID_CURSOR')
    return response(config, { items: [], nextCursor: null })
  }
  await expect(fetchSalesOrdersApi({ cursor: 'bad' })).resolves.toEqual([])
  expect(cursors).toEqual(['bad', undefined])
})

it.each([0, 101, 1.5])(
  'rejects an invalid page size (%s) before sending a request',
  async (limit) => {
    let calls = 0
    apiClient.defaults.adapter = async (config) => {
      calls++
      return response(config, {})
    }
    await expect(fetchSalesOrdersApi({ limit })).rejects.toThrow(/between 1 and 100/)
    expect(calls).toBe(0)
  },
)

it('fails instead of silently truncating when the server repeats a cursor', async () => {
  apiClient.defaults.adapter = async (config) =>
    response(config, { items: [{ id: 1 }], nextCursor: '1' })
  await expect(fetchSalesOrdersApi()).rejects.toThrow(/repeated.*cursor/i)
})

it('sends the PO expected revision and only current draft fields, replacing complete lines', async () => {
  const item = {
    inventoryItemId: 3,
    quantity: '2.50',
    unitPrice: '8.00',
    discountAmount: '1.00',
    notes: ' keep ',
    legacy: true,
  }
  apiClient.defaults.adapter = async (config) => {
    expect(JSON.parse(config.data)).toEqual({
      expectedRevision: 4,
      supplierId: null,
      notes: null,
      items: [
        {
          inventoryItemId: 3,
          quantity: '2.50',
          unitPrice: '8.00',
          discountAmount: '1.00',
          notes: 'keep',
        },
      ],
    })
    return response(config, { id: 7, revision: 5, items: [{ ...item, id: 30 }] })
  }
  const saved = await updatePurchaseOrderDraftApi(7, {
    expectedRevision: 4,
    supplierId: null,
    notes: '',
    items: [item],
  })
  expect(saved.revision).toBe(5)
})

it('rejects missing revisions but permits empty replacement lines for a PO draft', async () => {
  let calls = 0
  apiClient.defaults.adapter = async (config) => {
    calls++
    return response(config, {})
  }
  await expect(updatePurchaseOrderDraftApi(7, {} as never)).rejects.toThrow(/revision/i)
  expect(calls).toBe(0)
  await expect(updatePurchaseOrderDraftApi(7, { expectedRevision: 1, items: [] })).resolves.toEqual({})
  expect(calls).toBe(1)
})

it.each([
  'STALE_REVISION',
  'INVALID_ORDER_STATE',
  'ORDER_CONFIRMATION_BLOCKED',
  'ORDER_CANCELLATION_BLOCKED',
  'INVALID_DELIVERY_STATE',
  'DELIVERY_CANCELLATION_BLOCKED',
  'RECEIPT_CAPACITY_CHANGED',
  'RECEIPT_ALREADY_CONFIRMED',
  'RETURN_ALREADY_CONFIRMED',
  'VEHICLE_UNAVAILABLE',
  'DRIVER_INACTIVE',
  'ORDER_CAPACITY_CHANGED',
  'WAREHOUSE_CAPACITY_CHANGED',
  'PLAN_LIMIT_EXCEEDED',
  'RESOURCE_NOT_FOUND',
])('retains the %s backend message and actionable details', (code) => {
  const message = getErrorMessage(failure(code, { currentStatus: 'CONFIRMED', currentRevision: 4 }))
  expect(message).toContain('Review the current record')
  expect(message).toContain('CONFIRMED')
  expect(message).toContain('4')
})

it('allows repeated product lines and stock shortfalls within each order line remaining demand', () => {
  const options = [1, 2].map((id) => ({
    salesOrderItemId: id,
    inventoryItemId: 3,
    orderedQuantity: '100.00',
    committedQuantity: '0.00',
    readyQuantity: '0.00',
    availableQuantity: '1.00',
    plannedQuantity: '8.00',
    maximumPlannableQuantity: '5.00',
    remainingToPlanQuantity: '5.00',
    shortfallQuantity: '7.00',
  }))
  const errors = outgoingPlanningErrors(
    {
      items: options.map((option) => ({ id: option.salesOrderItemId, inventoryItemId: 3 })),
    } as never,
    options,
    { 1: '3.00', 2: '3.00' },
  )
  expect(errors).toEqual({})
  expect(outgoingPlanningErrors(
    { items: options.map((option) => ({ id: option.salesOrderItemId, inventoryItemId: 3 })) } as never,
    options,
    { 1: '5.01', 2: '3.00' },
  )).toEqual({ 'quantity-1': 'Maximum plannable quantity is 5.00. Review this quantity.' })
})

it('uses authoritative availability in legacy order source calculations too', () => {
  expect(
    availableStock({
      availableQuantity: '12.00',
    }),
  ).toBe(1200n)
})
