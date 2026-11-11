import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPurchaseOrderProgressDisplay,
  getPurchaseOrderDetailProgress,
  purchaseOrderActions,
  purchaseReceivingProgress,
} from './purchase-orders.presentation.ts'

test('purchase lifecycle distinguishes a scheduled arrival from physical receipt', () => {
  const saved = { id: 1, status: 'CONFIRMED' }
  assert.equal(
    getPurchaseOrderProgressDisplay(saved, [{ purchaseOrderId: 1, status: 'SCHEDULED' }]).label,
    'Arrival Scheduled',
  )
  assert.equal(
    getPurchaseOrderProgressDisplay(saved, [{ purchaseOrderId: 1, status: 'COMPLETED' }]).label,
    'Confirmed',
  )
  assert.equal(
    getPurchaseOrderProgressDisplay(saved, [{ purchaseOrderId: 2, status: 'SCHEDULED' }]).label,
    'Confirmed',
  )
  assert.equal(getPurchaseOrderProgressDisplay(saved, [], false).label, 'Confirmed')
  assert.equal(
    getPurchaseOrderProgressDisplay({ ...saved, status: 'PARTIALLY_RECEIVED' }, []).label,
    'Partially Received',
  )
  assert.equal(
    getPurchaseOrderProgressDisplay({ ...saved, status: 'RECEIVED' }, []).label,
    'Received',
  )
  assert.equal(
    getPurchaseOrderProgressDisplay({ ...saved, status: 'CANCELLED' }, []).milestones[0].state,
    'cancelled',
  )
})

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
  items: [
    {
      id: id * 100,
      purchaseOrderItemId: lineId,
      receivedQuantity: quantity,
      acceptedQuantity: quantity,
    },
  ],
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

test('backend accepted quantities preserve the outstanding balance for damaged receipts', () => {
  const receipt = delivery(1, 'COMPLETED', 11, '50')
  receipt.items[0].acceptedQuantity = '45'
  receipt.items[0].damagedQuantity = '5'
  const [row] = purchaseReceivingProgress(order, [receipt])
  assert.equal(row.received, 4500n)
  assert.equal(row.remaining, 500n)
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

test('detail lifecycle keeps scheduled arrivals out of the Receiving milestone', () => {
  const order = { id: 1, status: 'CONFIRMED' }
  const scheduled = { purchaseOrderId: 1, status: 'SCHEDULED', items: [{ receivedQuantity: '5' }] }
  const result = getPurchaseOrderDetailProgress(order, [scheduled])
  assert.equal(result.label, 'Confirmed')
  assert.deepEqual(
    result.milestones.map((step) => step.state),
    ['complete', 'current', 'upcoming', 'upcoming'],
  )
  assert.match(result.explanation, /arrival is scheduled/)
})
test('detail lifecycle reviews actual receipt activity across multiple arrivals', () => {
  const order = { id: 1, status: 'CONFIRMED' }
  const receipt = { purchaseOrderId: 1, status: 'COMPLETED', items: [{ receivedQuantity: '2' }] }
  assert.equal(getPurchaseOrderDetailProgress(order, [receipt]).milestones[2].state, 'current')
  for (const ignored of [
    { ...receipt, status: 'CANCELLED' },
    { ...receipt, purchaseOrderId: 2 },
    { ...receipt, items: [{ receivedQuantity: '0' }] },
    { ...receipt, items: null },
  ]) {
    assert.equal(getPurchaseOrderDetailProgress(order, [ignored]).milestones[2].state, 'upcoming')
  }
  const partial = getPurchaseOrderDetailProgress({ ...order, status: 'PARTIALLY_RECEIVED' }, [
    receipt,
    { ...receipt, status: 'SCHEDULED' },
  ])
  assert.equal(partial.milestones[2].state, 'current')
  assert.equal(partial.milestones[3].state, 'upcoming')
  assert.match(partial.explanation, /arrival is scheduled/)
})
test('details use saved completion and cancellation and keep unavailable receipt activity unknown', () => {
  const order = { id: 1, status: 'CONFIRMED' }
  assert.ok(
    getPurchaseOrderDetailProgress({ ...order, status: 'RECEIVED' }, []).milestones.every(
      (step) => step.state === 'complete',
    ),
  )
  assert.equal(
    getPurchaseOrderDetailProgress({ ...order, status: 'CANCELLED' }, []).milestones[0].state,
    'cancelled',
  )
  const unavailable = getPurchaseOrderDetailProgress(order, [], false)
  assert.deepEqual(
    unavailable.milestones.map((step) => step.label),
    ['Draft', 'Confirmed'],
  )
  assert.match(unavailable.explanation, /unavailable/)
})
