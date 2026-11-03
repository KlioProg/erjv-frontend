import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { transferDraftErrors, transferReconciliationErrors } from './warehouse-transfers.validation'
import { fetchTransfer, writeTransfer } from './warehouse-transfers.api'
import { transferFixture } from './warehouse-transfers.fixtures'
import type { TransferOutcome } from './warehouse-transfers.types'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
const balanced = (): TransferOutcome => ({
  warehouseTransferItemId: 71,
  receivedQuantity: '6.00',
  damagedQuantity: '1.00',
  returnedSellableQuantity: '2.00',
  returnedDamagedQuantity: '1.00',
  missingQuantity: '1.00',
  discrepancyReason: 'Damaged and short shipment',
})
it('validates distinct warehouses, unique active-reference IDs, decimal limits and required lines', () => {
  expect(
    transferDraftErrors({ sourceWarehouseId: 1, destinationWarehouseId: 1, items: [] }),
  ).toHaveProperty('destinationWarehouseId')
  expect(
    transferDraftErrors({
      items: [
        { inventoryItemId: 10, quantity: '1.00' },
        { inventoryItemId: 10, quantity: '0' },
      ],
    }),
  ).toHaveProperty('items.1.inventoryItemId')
  for (const quantity of ['0', '-1', '1.001', '10000000000.00'])
    expect(transferDraftErrors({ items: [{ inventoryItemId: 10, quantity }] })).toHaveProperty(
      'items.0.quantity',
    )
  expect(
    transferDraftErrors({
      sourceWarehouseId: 1,
      destinationWarehouseId: 2,
      items: [{ inventoryItemId: 10, quantity: '9999999999.99' }],
    }),
  ).toEqual({})
  expect(transferDraftErrors({ scheduledDepartureAt: '2026-11-04T10:00' })).toHaveProperty(
    'scheduledDepartureAt',
  )
})
it('balances all five outcomes exactly with damage as a subset of received', () => {
  const lines = transferFixture().items
  expect(transferReconciliationErrors(lines, [balanced()])).toEqual({})
  expect(
    transferReconciliationErrors(lines, [{ ...balanced(), receivedQuantity: '5.00' }]),
  ).toHaveProperty('items.0.balance')
  expect(
    transferReconciliationErrors(lines, [{ ...balanced(), damagedQuantity: '7.00' }]),
  ).toHaveProperty('items.0.damagedQuantity')
  expect(
    transferReconciliationErrors(lines, [{ ...balanced(), discrepancyReason: ' ' }]),
  ).toHaveProperty('items.0.discrepancyReason')
  expect(transferReconciliationErrors(lines, [])).toHaveProperty('items')
  expect(transferReconciliationErrors(lines, [balanced(), balanced()])).toHaveProperty('items')
  expect(
    transferReconciliationErrors(lines, [{ ...balanced(), warehouseTransferItemId: 10 }]),
  ).toHaveProperty('items')
  expect(
    transferReconciliationErrors(lines, [{ ...balanced(), missingQuantity: '1.001' }]),
  ).toHaveProperty('items.0.missingQuantity')
})
it('sends only the documented draft fields, including explicit nulls and full item replacements', async () => {
  const bodies: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    bodies.push(JSON.parse(config.data))
    return {
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: { ...transferFixture(), revision: 2 },
    }
  }
  await writeTransfer({
    action: 'draft',
    id: 7,
    payload: { expectedRevision: 1, notes: null, scheduledDepartureAt: null },
  })
  expect(bodies[0]).toEqual({ expectedRevision: 1, notes: null, scheduledDepartureAt: null })
  await writeTransfer({
    action: 'draft',
    id: 7,
    payload: { expectedRevision: 1, items: [{ inventoryItemId: 10, quantity: '3.00' }] },
  })
  expect(bodies[1]).toEqual({
    expectedRevision: 1,
    items: [{ inventoryItemId: 10, quantity: '3.00' }],
  })
})
it('preserves original revision and all zero fields for accepted dispatch and reconciliation replays', async () => {
  const record = transferFixture()
  const outcome = balanced()
  const completed = {
    ...record,
    status: 'COMPLETED',
    revision: 3,
    items: [{ ...record.items[0], ...outcome }],
  }
  const calls: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    calls.push(JSON.parse(config.data))
    return { config, status: 200, statusText: 'OK', headers: {}, data: completed }
  }
  expect(
    (await writeTransfer({ action: 'dispatch', id: 7, payload: { expectedRevision: 1 } })).status,
  ).toBe('COMPLETED')
  await writeTransfer({
    action: 'reconcile',
    id: 7,
    payload: { expectedRevision: 2, items: [outcome] },
  })
  expect(calls).toEqual([{ expectedRevision: 1 }, { expectedRevision: 2, items: [outcome] }])
})
it('rejects an unconfirmed mutation response and mismatched detail ID', async () => {
  const request = vi.fn(async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: transferFixture(),
  }))
  apiClient.defaults.adapter = request
  await expect(
    writeTransfer({ action: 'dispatch', id: 7, payload: { expectedRevision: 1 } }),
  ).rejects.toThrow(/did not confirm/)
  await expect(fetchTransfer(8)).rejects.toThrow(/does not match/)
  expect(request).toHaveBeenCalledTimes(2)
})
