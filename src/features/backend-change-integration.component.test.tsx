import { createElement, type PropsWithChildren } from 'react'
import { act, render, renderHook, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient, getApiFieldErrors, getErrorMessage } from '@/lib/api-client'
import { DeliveryStatusBadge } from '@/components/deliveries/shared/DeliveryStatusBadge'
import { IncomingDeliveryDetailModal } from '@/components/deliveries/shared/IncomingDeliveryDetailModal'
import type { DeliveryRow } from './logistics/delivery-workflow'
import { replaceEmployeeJobsApi } from './staffing/staffing.api'
import { updateDeliveryRunDraftApi } from './logistics/delivery-runs.api'
import { useReconcileRunMember } from './logistics/delivery-runs.hooks'
import { useCompleteIncomingDelivery } from './logistics/incoming-deliveries.hooks'
import { updateSalesOrderDraftApi } from './crm/sales-orders.api'
import type { OutgoingDeliveryRecord } from './logistics/outgoing-deliveries.types'

const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function context() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children)
  return { client, wrapper }
}

it.each([[], [2, 2], [0], [-1], [1.5], [Number.NaN]].map((jobIds) => ({ jobIds })))(
  'rejects invalid replacement job IDs $jobIds without any HTTP or deletion',
  async ({ jobIds }) => {
    const request = vi.fn(async (config) => ({
      config,
      status: 200,
      statusText: '',
      headers: {},
      data: [],
    }))
    apiClient.defaults.adapter = request
    await expect(replaceEmployeeJobsApi(7, jobIds)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
  },
)

it('sends a nonempty replacement set once without client assignment timestamps', async () => {
  const requests: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    requests.push({ method: config.method, url: config.url, data: JSON.parse(config.data) })
    return { config, status: 200, statusText: '', headers: {}, data: '' }
  }
  await replaceEmployeeJobsApi(7, [2, 3])
  expect(requests).toEqual([
    { method: 'put', url: '/employee-jobs/employees/7/jobs', data: { jobIds: [2, 3] } },
  ])
})

it('omits an unchanged run warehouse and rejects explicit null before HTTP', async () => {
  const bodies: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    bodies.push(JSON.parse(config.data))
    return { config, status: 200, statusText: '', headers: {}, data: { id: 4, warehouseId: 9 } }
  }
  await updateDeliveryRunDraftApi(4, { expectedRevision: 2, notes: 'Keep warehouse' })
  expect(bodies).toEqual([{ expectedRevision: 2, notes: 'Keep warehouse' }])
  await expect(
    updateDeliveryRunDraftApi(4, { expectedRevision: 2, warehouseId: null } as never),
  ).rejects.toThrow()
  expect(bodies).toHaveLength(1)
})

it('keeps warehouse validation errors attached to the warehouse field', () => {
  const error = {
    isAxiosError: true,
    response: {
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        detail: 'Review the warehouse',
        issues: [{ path: 'warehouseId', code: 'isInt', message: 'Select a warehouse' }],
      },
    },
  }
  expect(getApiFieldErrors(error)).toEqual({ warehouseId: 'Select a warehouse' })
  expect(getErrorMessage(error)).toContain('warehouseId: Select a warehouse')
})

it('omits unrelated sales draft fields when editing only notes', async () => {
  apiClient.defaults.adapter = async (config) => {
    expect(JSON.parse(config.data)).toEqual({ expectedRevision: 4, notes: 'Business note' })
    return { config, status: 200, statusText: '', headers: {}, data: {} }
  }
  await updateSalesOrderDraftApi(8, { expectedRevision: 4, notes: 'Business note' })
})

it('uses authoritative accepted quantities and timestamps after an identical receipt retry', async () => {
  const { client, wrapper } = context()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  const stored = {
    id: 7,
    deliveryNumber: 'IN-7',
    status: 'COMPLETED',
    outcome: 'RECEIVED_WITH_DAMAGE',
    items: [
      {
        id: 11,
        receivedQuantity: '3.00',
        damagedQuantity: '1.00',
        acceptedQuantity: '2.00',
        updatedAt: '2026-10-25T00:00:00.000Z',
      },
    ],
  }
  let calls = 0
  apiClient.defaults.adapter = async (config) => {
    calls++
    return { config, status: 200, statusText: '', headers: {}, data: stored }
  }
  const hook = renderHook(() => useCompleteIncomingDelivery(), { wrapper })
  const command = {
    id: 7,
    expectedRevision: 2,
    items: [{ purchaseOrderItemId: 9, receivedQuantity: '3.00', damagedQuantity: '1.00' }],
  }
  await act(async () => {
    await hook.result.current.mutateAsync(command)
  })
  // A later quarantine clearance changes accepted goods, independently of receipt counts.
  stored.items[0] = {
    ...stored.items[0],
    acceptedQuantity: '2.50',
    updatedAt: '2026-10-26T00:00:00.000Z',
  }
  await act(async () => {
    await hook.result.current.mutateAsync(command)
  })
  expect(calls).toBe(2)
  expect(client.getQueryData(['incoming-deliveries', 'id', 7])).toEqual(stored)
  expect(stored.items[0].acceptedQuantity).toBe('2.50')
  for (const key of ['incoming-deliveries', 'purchase-orders', 'stock-items', 'quarantine-lots'])
    expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
  hook.unmount()
  client.clear()
})

it('shows the stored accepted quantity after quarantine clearance in receipt details', () => {
  const row = {
    type: 'Incoming',
    record: {
      id: 7,
      deliveryNumber: 'IN-7',
      status: 'COMPLETED',
      items: [
        {
          id: 11,
          purchaseOrderItemId: 9,
          receivedQuantity: '3.00',
          damagedQuantity: '1.00',
          acceptedQuantity: '2.50',
        },
      ],
    },
  } as Extract<DeliveryRow, { type: 'Incoming' }>
  render(
    createElement(IncomingDeliveryDetailModal, {
      row,
      purchaseOrders: [],
      products: [],
      onClose: vi.fn(),
    }),
  )
  expect(screen.getByRole('columnheader', { name: 'Accepted' })).toBeTruthy()
  expect(screen.getByRole('cell', { name: '2.50' })).toBeTruthy()
  expect(screen.getByRole('columnheader', { name: 'Damaged at receipt' })).toBeTruthy()
})

it('does not show receipt quantities before an incoming delivery is confirmed', () => {
  const row: Extract<DeliveryRow, { type: 'Incoming' }> = {
    key: 'incoming-7',
    reference: 'IN-7',
    type: 'Incoming',
    party: 'Supplier #9',
    relatedOrder: 'PO #7',
    orderId: 7,
    method: 'To Be Confirmed',
    warehouse: 'Warehouse #3',
    vehicle: '—',
    driver: '—',
    date: null,
    status: 'DRAFT',
    record: {
      id: 7,
      revision: 1,
      deliveryNumber: 'IN-7',
      purchaseOrderId: 7,
      warehouseId: 3,
      status: 'DRAFT',
      outcome: null,
      noReceiptReason: null,
      confirmedByUserId: null,
      scheduledAt: null,
      completedAt: null,
      cancelledAt: null,
      supplierReference: null,
      notes: null,
      createdAt: '',
      updatedAt: '',
      items: [
        {
          id: 11,
          incomingDeliveryId: 7,
          purchaseOrderItemId: 9,
          receivedQuantity: '0.00',
          damagedQuantity: null,
          acceptedQuantity: null,
          createdAt: '',
          updatedAt: '',
          purchaseOrderItem: { inventoryItemId: 1, quantity: '2.00' },
        },
      ],
    },
  }
  render(
    createElement(IncomingDeliveryDetailModal, {
      row,
      purchaseOrders: [],
      products: [],
      onClose: vi.fn(),
    }),
  )
  expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
    'Product',
    'Expected',
  ])
  expect(screen.getByRole('cell', { name: '2.00' })).toBeTruthy()
  expect(screen.queryByRole('columnheader', { name: 'Received' })).toBeNull()
  expect(screen.queryByRole('columnheader', { name: 'Accepted' })).toBeNull()
  expect(screen.queryByRole('columnheader', { name: 'Damaged' })).toBeNull()
})

it('shows a conflicting receipt retry as a conflict without retrying or writing stock', async () => {
  const { client, wrapper } = context()
  const conflict = {
    isAxiosError: true,
    response: {
      status: 409,
      data: {
        code: 'RECEIPT_ALREADY_CONFIRMED',
        detail: 'Receipt already confirmed with different counts',
      },
    },
  }
  const calls: string[] = []
  apiClient.defaults.adapter = async (config) => {
    calls.push(config.url!)
    throw conflict
  }
  const hook = renderHook(() => useCompleteIncomingDelivery(), { wrapper })
  await act(async () => {
    await expect(
      hook.result.current.mutateAsync({
        id: 7,
        expectedRevision: 2,
        items: [],
        noReceiptReason: 'No goods',
      }),
    ).rejects.toBe(conflict)
  })
  expect(calls).toEqual(['/incoming-deliveries/7/complete'])
  expect(getErrorMessage(conflict)).toContain('different counts')
  hook.unmount()
  client.clear()
})

it.each(['NONE', 'PARTIAL', 'FULL', null] as const)(
  'keeps lifecycle status separate from backend fulfillment %s',
  (fulfillmentOutcome) => {
    const delivery = {
      status: 'RECONCILED',
      fulfillmentOutcome,
    } satisfies Pick<OutgoingDeliveryRecord, 'status' | 'fulfillmentOutcome'>
    render(createElement(DeliveryStatusBadge, { status: delivery.status }))
    expect(screen.getByText('Completed')).toBeTruthy()
    expect(screen.queryByText(/Nothing delivered|Partially delivered|Fully delivered/)).toBeNull()
    expect(delivery.fulfillmentOutcome).toBe(fulfillmentOutcome)
  },
)

it.each(['NONE', 'PARTIAL', 'FULL', null] as const)(
  'refreshes reconciliation views with authoritative fulfillment %s',
  async (fulfillmentOutcome) => {
    const { client, wrapper } = context()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const delivery = { id: 3, status: 'RECONCILED', fulfillmentOutcome } as OutgoingDeliveryRecord
    const run = { id: 4, revision: 5, status: 'COMPLETED' }
    apiClient.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: '',
      headers: {},
      data: { delivery, run },
    })
    const hook = renderHook(() => useReconcileRunMember(), { wrapper })
    await act(async () => {
      await hook.result.current.mutateAsync({
        id: 4,
        deliveryId: 3,
        payload: {
          expectedRevision: 3,
          items: [
            {
              outgoingDeliveryItemId: 10,
              deliveredQuantity: '1.00',
              returnedSellableQuantity: '0.00',
              returnedDamagedQuantity: '0.00',
              missingQuantity: '0.00',
            },
          ],
        },
      })
    })
    expect(client.getQueryData(['outgoing-deliveries', 'id', 3])).toBe(delivery)
    expect(client.getQueryData(['delivery-runs', 'id', 4])).toBe(run)
    for (const key of ['outgoing-deliveries', 'delivery-runs', 'sales-orders', 'stock-items'])
      expect(invalidate).toHaveBeenCalledWith({ queryKey: [key] })
    hook.unmount()
    client.clear()
  },
)
