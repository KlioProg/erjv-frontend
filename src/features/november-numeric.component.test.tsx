import { afterEach, beforeEach, expect, it } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { decimalLimitError, MONEY_MAX } from '@/lib/decimal-limits'
import { orderLineTotals } from '@/lib/order-line-pricing'
import { createProductApi, updateProductPriceApi } from './products/products.api'
import { createStockAdjustmentApi, setReorderThresholdApi } from './logistics/stock-items.api'
import { createManualQuarantineApi, resolveQuarantineApi } from './logistics/quarantine.api'
import { createVehicleApi, updateVehicleDetailsApi } from './logistics/delivery-vehicles.api'
import { completeIncomingDeliveryApi } from './logistics/incoming-deliveries.api'
import { dispatchDeliveryRunApi, reconcileRunMemberApi } from './logistics/delivery-runs.api'
import {
  createPurchaseOrderApi,
  updatePurchaseOrderDraftApi,
} from './logistics/purchase-orders.api'
import { createSalesOrderApi, updateSalesOrderDraftApi } from './crm/sales-orders.api'
import { validateIncomingReceipt } from './logistics/incoming-receiving'
import { outgoingPlanningErrors } from './logistics/outgoing-planning'
import { updateOutgoingDeliveryDraftApi } from './logistics/outgoing-deliveries.api'
import type { SalesOrderRecord } from './crm/sales-orders.types'
import type { PurchaseOrderRecord } from './logistics/purchase-orders.types'
import type { OutgoingPlanningOption } from './logistics/outgoing-deliveries.types'

const Q = '9999999999.99',
  M = '999999999999.99',
  aboveQ = '10000000000.00'
const original = apiClient.defaults.adapter
const calls: { url?: string; body: Record<string, unknown> }[] = []
const requestId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
beforeEach(() => {
  calls.length = 0
  apiClient.defaults.adapter = async (config) => {
    const body = JSON.parse(config.data)
    calls.push({ url: config.url, body })
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: {
        ...body,
        stockItemId: 1,
        submittedQuantity: body.quantity,
        beforeRevision: body.expectedRevision,
        afterRevision: body.expectedRevision + 1,
      },
    }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
it('checks exact decimal bounds without rounding, including malformed and zero quantities', () => {
  expect(decimalLimitError(Q)).toBeUndefined()
  expect(decimalLimitError(M, false, MONEY_MAX)).toBeUndefined()
  expect(decimalLimitError('0')).toBeUndefined()
  expect(decimalLimitError('0', true)).toBeTruthy()
  for (const value of [aboveQ, '1.001', '-1', '1e3', '', undefined])
    expect(decimalLimitError(value as string)).toBeTruthy()
})
it('preserves catalog price and nullable reorder threshold bounds and decimal strings', async () => {
  await createProductApi({ name: 'Rice', unit: 'kg', unitPrice: Q })
  await updateProductPriceApi(1, '0')
  await setReorderThresholdApi(1, { reorderThreshold: Q })
  await setReorderThresholdApi(1, { reorderThreshold: null })
  expect(calls.map((call) => call.body)).toMatchObject([
    { unitPrice: Q },
    { unitPrice: '0.00' },
    { reorderThreshold: Q },
    { reorderThreshold: null },
  ])
  await expect(updateProductPriceApi(1, aboveQ)).rejects.toThrow()
  await expect(setReorderThresholdApi(1, { reorderThreshold: aboveQ })).rejects.toThrow()
  expect(calls).toHaveLength(4)
})
it('accepts SET zero and maximum adjustments, rejecting zero increases/decreases and overflow', async () => {
  const payload = {
    kind: 'SET' as const,
    quantity: '0',
    expectedRevision: 1,
    requestId,
    reason: 'Physical count',
  }
  await createStockAdjustmentApi(1, payload)
  await createStockAdjustmentApi(1, { ...payload, kind: 'INCREASE', quantity: Q })
  for (const kind of ['INCREASE', 'DECREASE'] as const)
    await expect(createStockAdjustmentApi(1, { ...payload, kind })).rejects.toThrow()
  await expect(createStockAdjustmentApi(1, { ...payload, quantity: aboveQ })).rejects.toThrow()
  expect(calls).toHaveLength(2)
})
it('requires positive non-null vehicle capacity and preserves explicit clearing', async () => {
  await createVehicleApi({ plateNumber: 'ABC123', vehicleType: 'Truck', capacityKg: Q })
  await updateVehicleDetailsApi(1, { capacityKg: null })
  expect(calls[1].body).toEqual({ capacityKg: null })
  for (const capacityKg of ['0', aboveQ, '1.001'])
    await expect(updateVehicleDetailsApi(1, { capacityKg })).rejects.toThrow()
  expect(calls).toHaveLength(2)
})
it('bounds manual quarantine tagging and resolution without changing CLEAR/REMOVE bodies', async () => {
  const tag = {
    stockItemId: 1,
    condition: 'DAMAGED' as const,
    quantity: Q,
    requestId,
    reason: 'Inspected',
  }
  await createManualQuarantineApi(tag)
  for (const action of ['CLEAR', 'REMOVE'] as const)
    await resolveQuarantineApi(1, {
      action,
      quantity: Q,
      reason: 'Inspected',
      expectedRevision: 1,
      requestId,
    })
  for (const quantity of ['0', aboveQ, '1.001']) {
    await expect(createManualQuarantineApi({ ...tag, quantity })).rejects.toThrow()
    await expect(
      resolveQuarantineApi(1, {
        action: 'CLEAR',
        quantity,
        reason: 'Inspected',
        expectedRevision: 1,
        requestId,
      }),
    ).rejects.toThrow()
  }
  expect(calls).toHaveLength(3)
})
it('bounds each incoming receipt count while preserving zero damage', async () => {
  const payload = {
    expectedRevision: 1,
    items: [{ purchaseOrderItemId: 2, receivedQuantity: Q, damagedQuantity: '0.00' }],
  }
  await completeIncomingDeliveryApi(1, payload)
  for (const field of ['receivedQuantity', 'damagedQuantity'] as const)
    await expect(
      completeIncomingDeliveryApi(1, {
        ...payload,
        items: [{ ...payload.items[0], [field]: aboveQ }],
      }),
    ).rejects.toThrow()
  const item = { id: 2 } as PurchaseOrderRecord['items'][number]
  const result = validateIncomingReceipt([{ item, outstanding: 2_000_000_000_000n }], {
    2: { received: aboveQ, damaged: '0' },
  })
  expect(result.errors[2].received).toMatch(/exceeds/)
  expect(calls).toHaveLength(1)
})
it('bounds outgoing planning at the input and API, independently of aggregate availability', async () => {
  const order = { items: [{ id: 2, inventoryItemId: 3 }] } as SalesOrderRecord
  const options = [
    {
      salesOrderItemId: 2,
      inventoryItemId: 3,
      maximumPlannableQuantity: '20000000000.00',
      remainingToPlanQuantity: '20000000000.00',
    },
  ] as OutgoingPlanningOption[]
  expect(outgoingPlanningErrors(order, options, { 2: Q })).toEqual({})
  expect(outgoingPlanningErrors(order, options, { 2: aboveQ })['quantity-2']).toMatch(/exceeds/)
  await updateOutgoingDeliveryDraftApi(1, {
    expectedRevision: 1,
    warehouseId: 1,
    notes: null,
    plannedItems: [{ salesOrderItemId: 2, plannedQuantity: Q }],
  })
  for (const plannedQuantity of ['0', aboveQ, '1.001'])
    await expect(
      updateOutgoingDeliveryDraftApi(1, {
        expectedRevision: 1,
        warehouseId: 1,
        notes: null,
        plannedItems: [{ salesOrderItemId: 2, plannedQuantity }],
      }),
    ).rejects.toThrow()
  expect(calls).toHaveLength(1)
})
it('bounds every dispatch/reconciliation quantity and loaded weight, preserving zero outcome fields', async () => {
  const dispatch = {
    expectedRevision: 1,
    loadedWeightKg: Q,
    loads: [
      {
        deliveryId: 2,
        expectedRevision: 1,
        items: [{ salesOrderItemId: 3, stockItemId: 1, loadedQuantity: Q }],
      },
    ],
  }
  await dispatchDeliveryRunApi(1, dispatch)
  await expect(dispatchDeliveryRunApi(1, { ...dispatch, loadedWeightKg: aboveQ })).rejects.toThrow()
  await expect(
    dispatchDeliveryRunApi(1, {
      ...dispatch,
      loads: [
        {
          ...dispatch.loads[0],
          items: [{ ...dispatch.loads[0].items[0], loadedQuantity: aboveQ }],
        },
      ],
    }),
  ).rejects.toThrow()
  const item = {
    outgoingDeliveryItemId: 3,
    deliveredQuantity: Q,
    returnedSellableQuantity: '0.00',
    returnedDamagedQuantity: '0.00',
    missingQuantity: '0.00',
    discrepancyReason: 'Checked',
  }
  await reconcileRunMemberApi(1, 2, { expectedRevision: 1, items: [item] })
  for (const field of [
    'deliveredQuantity',
    'returnedSellableQuantity',
    'returnedDamagedQuantity',
    'missingQuantity',
  ] as const)
    await expect(
      reconcileRunMemberApi(1, 2, { expectedRevision: 1, items: [{ ...item, [field]: aboveQ }] }),
    ).rejects.toThrow()
  expect(calls).toHaveLength(2)
})
it('validates independent line components for create and draft edits even with 100% discounts', async () => {
  const valid = { inventoryItemId: 1, quantity: '1.00', unitPrice: M }
  await createPurchaseOrderApi({ supplierId: 1, items: [valid] })
  await createSalesOrderApi({ clientId: 1, items: [valid] })
  expect(calls[0].body.items).toEqual([valid])
  for (const items of [
    [{ ...valid, quantity: '2', discountRate: '100' }],
    [{ ...valid, taxRate: '12' }],
    [{ ...valid, unitPrice: '1000000000000.00' }],
  ]) {
    await expect(createPurchaseOrderApi({ items })).rejects.toThrow()
    await expect(createSalesOrderApi({ clientId: 1, items })).rejects.toThrow()
    await expect(updatePurchaseOrderDraftApi(1, { expectedRevision: 1, items })).rejects.toThrow()
    await expect(updateSalesOrderDraftApi(1, { expectedRevision: 1, items })).rejects.toThrow()
  }
  expect(orderLineTotals([valid, valid])?.total).toBe('1999999999999.98')
  expect(calls).toHaveLength(2)
})
