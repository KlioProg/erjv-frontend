import assert from 'node:assert/strict'
import test from 'node:test'
import { purchaseOrderActions, purchaseReceivingProgress } from './purchase-orders.presentation.ts'

const order = {
  id: 1,
  items: [
    { id: 11, inventoryItemId: 1, quantity: '50.00' },
    { id: 12, inventoryItemId: 2, quantity: '20.00' },
  ],
}
const delivery = (id, status, lineId, quantity, purchaseOrderId = 1) => ({
  id,
  status,
  purchaseOrderId,
  items: [{ id: id * 100, purchaseOrderItemId: lineId, receivedQuantity: quantity, acceptedQuantity: quantity }],
})

test('only physically completed receipts contribute to receiving progress', () => {
  const progress = purchaseReceivingProgress(order, [
    delivery(1, 'COMPLETED', 11, '30'),
    delivery(2, 'SCHEDULED', 11, '20'),
    delivery(3, 'DRAFT', 12, '20'),
    delivery(4, 'CANCELLED', 12, '20'),
    delivery(5, 'COMPLETED', 11, '50', 2),
  ])
  assert.deepEqual(
    progress.map((row) => [row.ordered, row.received, row.remaining]),
    [
      [5000n, 3000n, 2000n],
      [2000n, 0n, 2000n],
    ],
  )
})

test('multiple completed receipts sum exactly per order line, without mixing products or units', () => {
  const progress = purchaseReceivingProgress(order, [
    delivery(1, 'COMPLETED', 11, '10.25'),
    delivery(2, 'COMPLETED', 11, '19.75'),
    delivery(3, 'COMPLETED', 12, '20'),
  ])
  assert.deepEqual(
    progress.map((row) => [row.received, row.remaining]),
    [
      [3000n, 2000n],
      [2000n, 0n],
    ],
  )
})

test('receiving progress counts backend accepted goods and excludes damaged quarantine', () => {
  const receipt = delivery(1, 'COMPLETED', 11, '30')
  receipt.items[0].acceptedQuantity = '25'
  receipt.items[0].damagedQuantity = '5'
  const [row] = purchaseReceivingProgress(order, [receipt])
  assert.equal(row.received, 2500n)
  assert.equal(row.remaining, 2500n)
})

test('missing accepted quantities stay unknown rather than falling back to received goods', () => {
  const receipt = delivery(1, 'COMPLETED', 11, '30')
  delete receipt.items[0].acceptedQuantity
  assert.ok(purchaseReceivingProgress(order, [receipt]).every((row) => row.received === null))
})

test('unavailable, malformed or duplicate receipt data never becomes confirmed zero', () => {
  for (const deliveries of [
    [{ id: 1, purchaseOrderId: 1, status: 'COMPLETED' }],
    [delivery(1, 'COMPLETED', 11, null)],
    [delivery(1, 'COMPLETED', 99, '1')],
    [delivery(1, 'COMPLETED', 11, '10'), delivery(1, 'COMPLETED', 11, '10')],
  ]) {
    assert.ok(
      purchaseReceivingProgress(order, deliveries).every(
        (row) => row.received === null && row.remaining === null,
      ),
    )
  }
})

test('a receipt larger than the order is shown without inventing a remaining balance', () => {
  const [row] = purchaseReceivingProgress(order, [delivery(1, 'COMPLETED', 11, '51')])
  assert.equal(row.received, 5100n)
  assert.equal(row.remaining, null)
})

test('workflow actions match the existing status lifecycle and management permissions', () => {
  assert.deepEqual(purchaseOrderActions('DRAFT', true, 1), { confirm: true, cancel: true })
  assert.deepEqual(purchaseOrderActions('DRAFT', true, 0), { confirm: false, cancel: true })
  assert.deepEqual(purchaseOrderActions('CONFIRMED', true, 1), { confirm: false, cancel: true })
  for (const status of ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'])
    assert.deepEqual(purchaseOrderActions(status, true, 1), { confirm: false, cancel: false })
  for (const status of ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'])
    assert.deepEqual(purchaseOrderActions(status, false, 1), { confirm: false, cancel: false })
})
