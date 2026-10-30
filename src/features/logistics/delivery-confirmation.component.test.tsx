import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { completeIncomingDeliveryApi } from './incoming-deliveries.api'
import { dispatchDeliveryRunApi, reconcileRunMemberApi } from './delivery-runs.api'
import { getDeliveryActions } from './delivery-workflow'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})

it('serializes actual receipt, damage, and an explicit no-receipt reason', async () => {
  const bodies: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    bodies.push(JSON.parse(config.data))
    return { config, data: {}, status: 200, statusText: '', headers: {} }
  }
  const receipt = {
    expectedRevision: 2,
    items: [{ purchaseOrderItemId: 25, receivedQuantity: '100.00', damagedQuantity: '10.00' }],
  }
  await completeIncomingDeliveryApi(1, receipt)
  await completeIncomingDeliveryApi(1, { expectedRevision: 2, items: [], noReceiptReason: 'Supplier did not arrive' })
  expect(bodies).toEqual([receipt, { expectedRevision: 2, items: [], noReceiptReason: 'Supplier did not arrive' }])
})

it('serializes run loads and revision-aware member reconciliation', async () => {
  const bodies: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    bodies.push(JSON.parse(config.data))
    return { config, data: {}, status: 200, statusText: '', headers: {} }
  }
  const dispatch = {
    expectedRevision: 4,
    loadedWeightKg: '25.00',
    loads: [{ deliveryId: 15, expectedRevision: 2, items: [{ salesOrderItemId: 15, stockItemId: 22, loadedQuantity: '2.00' }] }],
  }
  const complete = {
    expectedRevision: 3,
    items: [
      {
        outgoingDeliveryItemId: 9,
        deliveredQuantity: '1.00',
        returnedSellableQuantity: '0.00',
        returnedDamagedQuantity: '1.00',
        missingQuantity: '0.00',
        discrepancyReason: 'Broken in transit',
      },
    ],
  }
  await dispatchDeliveryRunApi(2, dispatch)
  await reconcileRunMemberApi(2, 15, complete)
  expect(bodies).toEqual([dispatch, complete])
})

it('rejects missing or empty outgoing confirmation arrays before making a request', async () => {
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  await expect(
    dispatchDeliveryRunApi(2, { expectedRevision: 4, loadedWeightKg: '25.00', loads: [{ deliveryId: 15, expectedRevision: 2, items: [] }] }),
  ).rejects.toThrow(/item/i)
  await expect(reconcileRunMemberApi(2, 15, { expectedRevision: 3, items: [] })).rejects.toThrow(/item/i)
  expect(adapter).not.toHaveBeenCalled()
})

it('only permits cancellation before dispatch', () => {
  for (const status of ['DRAFT', 'READY'] as const)
    expect(getDeliveryActions({ type: 'Outgoing', status })).toContain('cancel')
  for (const status of ['DISPATCHED', 'RECONCILED'] as const)
    expect(getDeliveryActions({ type: 'Outgoing', status })).not.toContain('cancel')
})
