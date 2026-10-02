import assert from 'node:assert/strict'
import test from 'node:test'
import { getSalesOrderDeliveryDisplay } from './sales-orders.presentation.ts'

const order = { id: 1, status: 'DRAFT', completedAt: null, cancelledAt: null }
const delivery = {
  id: 1,
  salesOrderId: 1,
  status: 'SCHEDULED',
  scheduledAt: '2026-10-05T09:00:00',
  deliveredAt: null,
}

test('distinguishes an unconfirmed order from one ready for delivery', () => {
  assert.equal(getSalesOrderDeliveryDisplay(order, undefined, []).supportingText, 'No delivery yet')
  assert.equal(
    getSalesOrderDeliveryDisplay({ ...order, status: 'CONFIRMED' }, undefined, []).supportingText,
    'Ready for delivery',
  )
})

test('shows the recorded schedule and omits absent or invalid dates', () => {
  const display = getSalesOrderDeliveryDisplay(order, delivery, [delivery])
  assert.equal(display.label, 'Scheduled')
  assert.match(display.supportingText, /Oct 5.*9:00 AM/)
  for (const scheduledAt of [null, 'invalid']) {
    assert.equal(
      getSalesOrderDeliveryDisplay(order, { ...delivery, scheduledAt }, []).supportingText,
      undefined,
    )
  }
})

test('retains the active delivery state on partially delivered orders', () => {
  const partial = { ...order, status: 'PARTIALLY_DELIVERED' }
  assert.equal(getSalesOrderDeliveryDisplay(partial, delivery, [delivery]).label, 'Scheduled')
  const dispatched = { ...delivery, status: 'DISPATCHED' }
  assert.equal(getSalesOrderDeliveryDisplay(partial, dispatched, []).supportingText, 'On the way')
})

test('counts only this order’s uncancelled deliveries', () => {
  const partial = { ...order, status: 'PARTIALLY_DELIVERED' }
  const completed = { ...delivery, status: 'DELIVERED' }
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
  const completed = { ...delivery, status: 'DELIVERED', deliveredAt: '2026-10-02T12:00:00' }
  const later = { ...completed, id: 2, deliveredAt: '2026-10-03T12:00:00' }
  assert.equal(
    getSalesOrderDeliveryDisplay(completedOrder, completed, [completed, later]).supportingText,
    'Completed Oct 3',
  )
  assert.equal(
    getSalesOrderDeliveryDisplay(
      { ...completedOrder, completedAt: '2026-10-04T12:00:00' },
      completed,
      [completed, later],
    ).supportingText,
    'Completed Oct 4',
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
    'Cancelled Oct 2',
  )
})
