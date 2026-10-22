import assert from 'node:assert/strict'
import test from 'node:test'
import {
  committedIncoming,
  committedOutgoing,
  salesDeliveryProgress,
} from './delivery-quantities.ts'
import {
  deliveryPrimaryAction,
  deliveryCanCancel,
  isDeliveryInSection,
} from './delivery-workflow.ts'

test('direct sections isolate operational queues and consolidate completed or cancelled history', () => {
  for (const [type, statuses] of [
    ['Incoming', ['DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED']],
    ['Outgoing', ['DRAFT', 'SCHEDULED', 'DISPATCHED', 'DELIVERED', 'CANCELLED']],
  ])
    for (const status of statuses) {
      const row = { type, status }
      assert.equal(
        ['incoming', 'outgoing', 'history'].filter((section) => isDeliveryInSection(row, section))
          .length,
        1,
      )
      assert.equal(isDeliveryInSection(row, type === 'Incoming' ? 'outgoing' : 'incoming'), false)
    }
})
test('only management roles see the next valid transition or cancellation', () => {
  assert.equal(deliveryPrimaryAction({ type: 'Incoming', status: 'SCHEDULED' }, true), 'receive')
  assert.equal(deliveryPrimaryAction({ type: 'Outgoing', status: 'SCHEDULED' }, true), 'dispatch')
  assert.equal(deliveryPrimaryAction({ type: 'Outgoing', status: 'DISPATCHED' }, true), 'deliver')
  for (const type of ['Incoming', 'Outgoing'])
    for (const status of [
      'DRAFT',
      'SCHEDULED',
      'DISPATCHED',
      'COMPLETED',
      'DELIVERED',
      'CANCELLED',
    ]) {
      assert.equal(deliveryPrimaryAction({ type, status }, false), null)
      assert.equal(deliveryCanCancel({ type, status }, false), false)
      if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(status)) {
        assert.equal(deliveryPrimaryAction({ type, status }, true), null)
        assert.equal(deliveryCanCancel({ type, status }, true), false)
      }
    }
})
test('shipment availability counts active commitments exactly and releases cancellations', () => {
  const deliveries = [
    { id: 1, status: 'SCHEDULED', items: [{ purchaseOrderItemId: 10, receivedQuantity: '60.25' }] },
    { id: 2, status: 'COMPLETED', items: [{ purchaseOrderItemId: 10, receivedQuantity: '10.75' }] },
    { id: 3, status: 'CANCELLED', items: [{ purchaseOrderItemId: 10, receivedQuantity: '10' }] },
  ]
  assert.equal(committedIncoming(10, deliveries), 7100n)
  assert.equal(committedIncoming(10, deliveries, 1), 1075n)
  assert.equal(
    committedOutgoing(10, [
      { status: 'DRAFT', items: [{ salesOrderAllocationId: 10, quantity: '60.25' }] },
    ]),
    6025n,
  )
  assert.equal(committedIncoming(10, [{ status: 'DRAFT' }]), null)
})
const order = { id: 1, items: [{ id: 10, quantity: '100', allocations: [{ id: 11 }, { id: 12 }] }] }
const delivery = (id, status, quantity, allocation = 11) => ({
  id,
  status,
  salesOrderId: 1,
  items: [{ id: id * 10, salesOrderAllocationId: allocation, quantity }],
})
test('sales progress counts delivered quantities across allocations, without treating dispatch as completion', () => {
  const [row] = salesDeliveryProgress(order, [
    delivery(1, 'DELIVERED', '60'),
    delivery(2, 'DISPATCHED', '40'),
  ])
  assert.deepEqual([row.ordered, row.delivered, row.remaining], [10000n, 6000n, 4000n])
  const [complete] = salesDeliveryProgress(order, [
    delivery(1, 'DELIVERED', '60'),
    delivery(2, 'DELIVERED', '40', 12),
  ])
  assert.deepEqual([complete.delivered, complete.remaining], [10000n, 0n])
})
test('invalid or duplicate delivered lines leave progress unknown', () => {
  for (const deliveries of [
    [delivery(1, 'DELIVERED', '1', 99)],
    [delivery(1, 'DELIVERED', null)],
    [delivery(1, 'DELIVERED', '1'), delivery(1, 'DELIVERED', '1')],
  ])
    assert.equal(salesDeliveryProgress(order, deliveries)[0].delivered, null)
})
