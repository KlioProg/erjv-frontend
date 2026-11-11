import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSalesOrderProgressDisplay,
  getSalesOrderDetailProgress,
  getSalesOrderDeliveryDisplay,
  salesDeliveryProgress,
} from './sales-orders.presentation.ts'

test('record progress reviews all deliveries and keeps partial fulfillment authoritative', () => {
  const saved = { id: 1, status: 'CONFIRMED' }
  const records = [
    { salesOrderId: 1, status: 'READY' },
    { salesOrderId: 1, status: 'DISPATCHED' },
  ]
  assert.equal(getSalesOrderProgressDisplay(saved, records).label, 'In Transit')
  assert.equal(getSalesOrderProgressDisplay(saved, records.slice(0, 1)).label, 'Preparing')
  const partial = getSalesOrderProgressDisplay({ ...saved, status: 'PARTIALLY_DELIVERED' }, records)
  assert.equal(partial.label, 'Partially Delivered')
  assert.deepEqual(partial.milestones, [])
  assert.equal(getSalesOrderProgressDisplay(saved, [], false).label, 'Confirmed')
  assert.doesNotMatch(getSalesOrderProgressDisplay(saved, [], false).explanation, /not started/i)
})

test('record progress never infers order completion from a reconciled shipment', () => {
  const saved = { id: 1, status: 'CONFIRMED' }
  assert.equal(
    getSalesOrderProgressDisplay(saved, [{ salesOrderId: 1, status: 'RECONCILED' }]).label,
    'Confirmed',
  )
  assert.equal(
    getSalesOrderProgressDisplay({ ...saved, status: 'DELIVERED' }, []).label,
    'Completed',
  )
  assert.equal(
    getSalesOrderProgressDisplay({ ...saved, status: 'CANCELLED' }, []).milestones[0].state,
    'cancelled',
  )
})

test('sales progress uses confirmed delivered quantities, excluding returned and merely loaded goods', () => {
  const order = { id: 1, items: [{ id: 11, quantity: '10' }] }
  const delivered = {
    id: 1,
    salesOrderId: 1,
    status: 'RECONCILED',
    items: [{ id: 101, salesOrderItemId: 11, quantity: '10', deliveredQuantity: '7.25' }],
  }
  const [row] = salesDeliveryProgress(order, [delivered, { ...delivered, status: 'DISPATCHED' }])
  assert.equal(row.delivered, 725n)
  assert.equal(row.remaining, 275n)
  delete delivered.items[0].deliveredQuantity
  assert.equal(salesDeliveryProgress(order, [delivered])[0].delivered, null)
})

const order = { id: 1, status: 'DRAFT', completedAt: null, cancelledAt: null }
const delivery = {
  id: 1,
  salesOrderId: 1,
  status: 'READY',
  runId: null,
  scheduledAt: '2026-10-05T09:00:00',
  reconciledAt: null,
}

test('distinguishes an unconfirmed order from one ready for delivery', () => {
  assert.equal(getSalesOrderDeliveryDisplay(order, undefined, []).supportingText, 'No delivery yet')
  assert.equal(
    getSalesOrderDeliveryDisplay({ ...order, status: 'CONFIRMED' }, undefined, []).supportingText,
    'Ready for delivery',
  )
})

test('shows READY separately from trip assignment', () => {
  const display = getSalesOrderDeliveryDisplay(order, delivery, [delivery])
  assert.equal(display.label, 'Ready')
  assert.equal(display.supportingText, 'Awaiting trip assignment')
  assert.equal(
    getSalesOrderDeliveryDisplay(order, { ...delivery, runId: 7 }, []).supportingText,
    'Assigned to Trip #7',
  )
})

test('retains the active delivery state on partially delivered orders', () => {
  const partial = { ...order, status: 'PARTIALLY_DELIVERED' }
  assert.equal(getSalesOrderDeliveryDisplay(partial, delivery, [delivery]).label, 'Ready')
  const dispatched = { ...delivery, status: 'DISPATCHED' }
  const display = getSalesOrderDeliveryDisplay(partial, dispatched, [])
  assert.equal(display.label, 'Dispatched')
  assert.equal(display.supportingText, 'Departure recorded')
})

test('counts only this order’s uncancelled deliveries', () => {
  const partial = { ...order, status: 'PARTIALLY_DELIVERED' }
  const completed = { ...delivery, status: 'RECONCILED' }
  const records = [
    completed,
    { ...delivery, id: 2 },
    { ...delivery, id: 3, status: 'CANCELLED' },
    { ...delivery, id: 4, salesOrderId: 2 },
  ]
  assert.equal(
    getSalesOrderDeliveryDisplay(partial, completed, records).supportingText,
    '1 of 2 completed',
  )
  assert.equal(
    getSalesOrderDeliveryDisplay(partial, completed, [completed]).supportingText,
    '1 delivery completed',
  )
  assert.equal(
    getSalesOrderDeliveryDisplay(partial, undefined, []).supportingText,
    'More items to deliver',
  )
})

test('uses order completion or the latest recorded delivery, without inventing dates', () => {
  const completedOrder = { ...order, status: 'DELIVERED' }
  const completed = { ...delivery, status: 'RECONCILED', reconciledAt: '2026-10-02T12:00:00' }
  const later = { ...completed, id: 2, reconciledAt: '2026-10-03T12:00:00' }
  assert.equal(
    getSalesOrderDeliveryDisplay(completedOrder, completed, [completed, later]).supportingText,
    'Completed Oct 3, 2026',
  )
  assert.equal(
    getSalesOrderDeliveryDisplay(
      { ...completedOrder, completedAt: '2026-10-04T12:00:00' },
      completed,
      [completed, later],
    ).supportingText,
    'Completed Oct 4, 2026',
  )
  assert.equal(
    getSalesOrderDeliveryDisplay(completedOrder, undefined, []).supportingText,
    undefined,
  )
})

test('completed and cancelled orders take precedence over active delivery records', () => {
  assert.equal(
    getSalesOrderDeliveryDisplay({ ...order, status: 'DELIVERED' }, delivery, []).label,
    'Delivered',
  )
  const cancelled = { ...order, status: 'CANCELLED', cancelledAt: '2026-10-02T12:00:00' }
  assert.equal(getSalesOrderDeliveryDisplay(cancelled, delivery, []).label, 'Cancelled')
  assert.equal(
    getSalesOrderDeliveryDisplay(cancelled, delivery, []).supportingText,
    'Cancelled Oct 2, 2026',
  )
})

test('detail milestones keep READY before departure and use authoritative completion', () => {
  const order = { id: 1, status: 'CONFIRMED' }
  const ready = { salesOrderId: 1, status: 'READY' }
  const pending = getSalesOrderDetailProgress(order, [ready])
  assert.equal(pending.label, 'Preparing')
  assert.equal(pending.milestones[1].state, 'current')
  assert.deepEqual(
    pending.milestones.map((step) => step.label),
    ['Draft', 'Confirmed', 'In Transit', 'Delivered'],
  )
  assert.equal(pending.milestones[2].state, 'upcoming')
  const departed = getSalesOrderDetailProgress(order, [
    ready,
    { salesOrderId: 1, status: 'DISPATCHED' },
  ])
  assert.equal(departed.milestones[2].state, 'current')
  assert.equal(departed.milestones[3].state, 'upcoming')
  assert.deepEqual(
    getSalesOrderDetailProgress({ ...order, status: 'PARTIALLY_DELIVERED' }, [ready]).milestones,
    [],
  )
  assert.ok(
    getSalesOrderDetailProgress({ ...order, status: 'DELIVERED' }, []).milestones.every(
      (step) => step.state === 'complete',
    ),
  )
  assert.equal(
    getSalesOrderDetailProgress({ ...order, status: 'CANCELLED' }, []).milestones[0].state,
    'cancelled',
  )
})
