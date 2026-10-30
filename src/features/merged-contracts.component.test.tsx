import { afterEach, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { usePurchaseOrderEntry } from './logistics/purchase-order-entry.hooks'
import { useSalesOrderEntry } from './crm/sales-order-entry.hooks'
import { AxiosError } from 'axios'
import { apiClient, getApiError, getErrorMessage } from '@/lib/api-client'
import { confirmPurchaseOrderApi, cancelPurchaseOrderApi } from './logistics/purchase-orders.api'
import { confirmSalesOrderApi, cancelSalesOrderApi } from './crm/sales-orders.api'
import {
  scheduleIncomingDeliveryApi,
  cancelIncomingDeliveryApi,
  completeIncomingDeliveryApi,
} from './logistics/incoming-deliveries.api'
import { fetchSalesOrdersApi } from './crm/sales-orders.api'
import { fetchStockItemByPairApi } from './logistics/stock-items.api'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

it('saves a purchase draft with no supplier or lines', async () => {
  const onSubmit = vi
    .fn()
    .mockResolvedValue({ id: 7, revision: 1, status: 'DRAFT', orderNumber: 'PO-7', items: [] })
  const { result } = renderHook(() =>
    usePurchaseOrderEntry({ suppliers: [], products: [], onSubmit, onClose: vi.fn() }),
  )
  await act(() => result.current.submit({ preventDefault() {}, nativeEvent: {} } as never))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ supplierId: null, items: [] }),
    'draft',
  )
})

it('saves a sales draft with no lines or delivery address', async () => {
  const onSubmit = vi
    .fn()
    .mockResolvedValue({ id: 8, revision: 1, status: 'DRAFT', orderNumber: 'SO-8', items: [] })
  const { result } = renderHook(() =>
    useSalesOrderEntry({
      clients: [{ id: 2, name: 'Client', isActive: true }] as never,
      products: [],
      cashier: 'Clerk',
      onSubmit,
      onClose: vi.fn(),
    }),
  )
  act(() => result.current.changeClient('2'))
  await act(() => result.current.submit({ preventDefault() {}, nativeEvent: {} } as never))
  expect(onSubmit).toHaveBeenCalledWith(
    expect.objectContaining({ clientId: 2, lines: [], deliveryAddress: '' }),
    'draft',
  )
})

function problem(status: number, data: unknown) {
  const error = new AxiosError('Request failed')
  error.response = { status, data, statusText: '', headers: {}, config: {} as never }
  return error
}

it('treats only a coded missing stock-pair lookup as an empty allocation', async () => {
  apiClient.defaults.adapter = async () => {
    throw problem(404, { code: 'RESOURCE_NOT_FOUND', detail: 'Stock item not found' })
  }
  await expect(fetchStockItemByPairApi(1, 2)).resolves.toBeNull()
  const denied = problem(403, { code: 'FORBIDDEN' })
  apiClient.defaults.adapter = async () => {
    throw denied
  }
  await expect(fetchStockItemByPairApi(1, 2)).rejects.toBe(denied)
})

it('shows problem detail, nested validation paths, and keeps structured extensions', () => {
  const issues = [
    { path: 'items[0].quantity', code: 'INVALID_DECIMAL', message: 'Use a decimal quantity' },
  ]
  const error = problem(400, {
    type: '/problems/validation-failed',
    title: 'Validation failed',
    status: 400,
    detail: 'Review the submitted fields',
    code: 'VALIDATION_FAILED',
    issues,
  })
  expect(getErrorMessage(error)).toContain('Review the submitted fields')
  expect(getErrorMessage(error)).toContain('items[0].quantity: Use a decimal quantity')
  expect(getApiError(error)?.issues).toEqual(issues)
  const stale = problem(409, {
    detail: 'Revision changed',
    code: 'STALE_REVISION',
    currentRevision: 8,
  })
  expect(getErrorMessage(stale)).toMatch(/refresh|reload/i)
  expect(getErrorMessage(stale)).toContain('8')
})

it('never exposes problem details from an unexpected server failure', () => {
  expect(
    getErrorMessage(problem(500, { detail: 'secret SQL connection', code: 'STALE_REVISION' })),
  ).not.toContain('secret SQL')
})

const actions = [
  confirmPurchaseOrderApi,
  cancelPurchaseOrderApi,
  confirmSalesOrderApi,
  cancelSalesOrderApi,
  scheduleIncomingDeliveryApi,
  cancelIncomingDeliveryApi,
]
it.each(actions)(
  '%s sends the reviewed resource revision without a lookup or retry',
  async (action) => {
    const requests: unknown[] = []
    apiClient.defaults.adapter = async (config) => {
      requests.push([config.method, JSON.parse(config.data)])
      return { config, data: { id: 7, revision: 5 }, status: 200, statusText: '', headers: {} }
    }
    await action(7, 4)
    expect(requests).toEqual([['patch', { expectedRevision: 4 }]])
    await expect(action(7, 0)).rejects.toThrow(/revision/i)
    expect(requests).toHaveLength(1)
  },
)

it('sends the delivery revision on receipt and no-receipt confirmation', async () => {
  const bodies: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    bodies.push(JSON.parse(config.data))
    return { config, data: {}, status: 200, statusText: '', headers: {} }
  }
  const receipt = {
    expectedRevision: 3,
    items: [{ purchaseOrderItemId: 9, receivedQuantity: '2.50', damagedQuantity: '0.50' }],
  }
  await completeIncomingDeliveryApi(7, receipt)
  const none = { expectedRevision: 4, items: [], noReceiptReason: 'No shipment arrived' }
  await completeIncomingDeliveryApi(7, none)
  expect(bodies).toEqual([receipt, none])
})

it('serializes repeated status filters and removes duplicate cursor records', async () => {
  const calls: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    expect(apiClient.getUri(config)).toContain('statuses=DRAFT')
    calls.push(config.params)
    return {
      config,
      status: 200,
      statusText: '',
      headers: {},
      data: config.params.cursor
        ? { items: [{ id: 1 }, { id: 2 }], nextCursor: null }
        : { items: [{ id: 1 }], nextCursor: 'opaque+/=' },
    }
  }
  await expect(fetchSalesOrdersApi({ status: 'DRAFT' })).resolves.toEqual([{ id: 1 }, { id: 2 }])
  expect(calls).toEqual([
    { statuses: ['DRAFT'], limit: 50 },
    { statuses: ['DRAFT'], limit: 50, cursor: 'opaque+/=' },
  ])
})
