import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDeliveryRows,
  deliveryBelongsToView,
  formatDeliverySchedule,
  getDeliveryActions,
} from './delivery-workflow.ts'
import {
  deliveryQuantityError,
  remainingDeliveryQuantity,
  sumDeliveryQuantities,
} from './delivery-quantities.ts'
import { incomingOrderRemainingQuantity } from './incoming-order-balance.ts'

test('incoming order picker balance includes all arranged shipments except cancelled ones', () => {
  const order = { id: 2, items: [{ id: 20, quantity: '0.60' }] }
  const deliveries = ['DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED'].map((status) => ({
    purchaseOrderId: 2,
    status,
    items: [{ purchaseOrderItemId: 20, receivedQuantity: '0.20' }],
  }))
  assert.equal(incomingOrderRemainingQuantity(order, deliveries), '0.00')
  assert.equal(incomingOrderRemainingQuantity(order, deliveries.slice(1)), '0.20')
  assert.equal(
    incomingOrderRemainingQuantity(
      { id: 2, items: [{ id: 20, quantity: '0.25' }] },
      deliveries.slice(2),
    ),
    '0.05',
  )
})

test('incoming picker balances are per line and unknown values never become fully arranged', () => {
  const deliveries = [
    {
      purchaseOrderId: 2,
      status: 'SCHEDULED',
      items: [{ purchaseOrderItemId: 20, receivedQuantity: '2' }],
    },
  ]
  assert.equal(
    incomingOrderRemainingQuantity(
      {
        id: 2,
        items: [
          { id: 20, quantity: '1' },
          { id: 21, quantity: '1' },
        ],
      },
      deliveries,
    ),
    '1.00',
  )
  assert.equal(
    incomingOrderRemainingQuantity({ id: 3, items: [{ id: 20, quantity: '1' }] }, deliveries),
    '1.00',
  )
  assert.equal(incomingOrderRemainingQuantity({ id: 2, items: [] }, deliveries), '0.00')
  assert.equal(
    incomingOrderRemainingQuantity({ id: 2, items: [{ id: 20, quantity: 'bad' }] }, []),
    null,
  )
  deliveries[0].items[0].receivedQuantity = 'bad'
  assert.equal(
    incomingOrderRemainingQuantity({ id: 2, items: [{ id: 20, quantity: '1' }] }, deliveries),
    null,
  )
})

test('delivery views separate active directions from all terminal records', () => {
  for (const type of ['Incoming', 'Outgoing']) {
    for (const status of ['DRAFT', 'SCHEDULED', 'DISPATCHED']) {
      assert.equal(deliveryBelongsToView({ type, status }, 'history'), false)
      assert.equal(deliveryBelongsToView({ type, status }, type.toLowerCase()), true)
      assert.equal(
        deliveryBelongsToView({ type, status }, type === 'Incoming' ? 'outgoing' : 'incoming'),
        false,
      )
    }
    for (const status of ['COMPLETED', 'DELIVERED', 'CANCELLED']) {
      assert.equal(deliveryBelongsToView({ type, status }, 'history'), true)
      assert.equal(deliveryBelongsToView({ type, status }, type.toLowerCase()), false)
    }
  }
})

test('outgoing delivery rows show all source warehouses without assuming one delivery warehouse', () => {
  const [row] = buildDeliveryRows({
    incoming: [],
    outgoing: [
      {
        id: 3,
        deliveryNumber: 'OUT-3',
        salesOrderId: 8,
        status: 'SCHEDULED',
        deliveryVehicleId: null,
        driverEmployeeId: null,
        scheduledAt: null,
        items: [
          { stockItem: { warehouseId: 1 } },
          { stockItem: { warehouseId: 2 } },
          { stockItem: { warehouseId: 1 } },
        ],
      },
    ],
    purchaseOrders: [],
    salesOrders: [{ id: 8, orderNumber: 'SO-8', clientId: 6 }],
    suppliers: [],
    clients: [{ id: 6, name: 'Customer' }],
    warehouses: [
      { id: 1, name: 'Store' },
      { id: 2, name: 'Main Warehouse' },
    ],
    vehicles: [],
    employees: [],
  })
  assert.equal(row.warehouse, 'Store, Main Warehouse')
})

test('planned outgoing deliveries show their persisted warehouse before stock is loaded', () => {
  const [row] = buildDeliveryRows({
    incoming: [],
    outgoing: [{ id: 1, salesOrderId: 8, warehouseId: 2, items: [], status: 'DRAFT' }],
    purchaseOrders: [],
    salesOrders: [],
    suppliers: [],
    clients: [],
    warehouses: [{ id: 2, name: 'Main Warehouse' }],
    vehicles: [],
    employees: [],
  })
  assert.equal(row.warehouse, 'Main Warehouse')
})

test('only inspected backend transitions are exposed for each direction', () => {
  assert.deepEqual(getDeliveryActions({ type: 'Incoming', status: 'DRAFT' }), [
    'schedule',
    'cancel',
  ])
  assert.deepEqual(getDeliveryActions({ type: 'Incoming', status: 'SCHEDULED' }), [
    'receive',
    'cancel',
  ])
  assert.deepEqual(getDeliveryActions({ type: 'Incoming', status: 'DISPATCHED' }), [])
  assert.deepEqual(getDeliveryActions({ type: 'Outgoing', status: 'SCHEDULED' }), [
    'dispatch',
    'cancel',
  ])
  assert.deepEqual(getDeliveryActions({ type: 'Outgoing', status: 'DISPATCHED' }), [
    'complete',
    'cancel',
  ])
  for (const type of ['Incoming', 'Outgoing'])
    for (const status of ['COMPLETED', 'DELIVERED', 'CANCELLED'])
      assert.deepEqual(getDeliveryActions({ type, status }), [])
})

test('active dates are compact, history retains year, expected dates do not invent times', () => {
  const active = formatDeliverySchedule('2026-10-11T14:30:00', false)
  assert.equal(active.date, '11 Oct')
  assert.equal(active.time, '2:30 PM')
  assert.equal(formatDeliverySchedule('2026-10-11T14:30:00', true).date, '11 Oct 2026')
  assert.equal(formatDeliverySchedule('2026-10-11', false, false).time, 'Expected')
  for (const value of [null, 'bad-date'])
    assert.equal(formatDeliverySchedule(value, false).date, 'Not scheduled')
})

test('delivery balances retain fractional units and large quantities exactly', () => {
  assert.equal(remainingDeliveryQuantity('1.00', ['0.10', '0.20']), '0.70')
  assert.equal(remainingDeliveryQuantity('0.25', ['0.20']), '0.05')
  assert.equal(remainingDeliveryQuantity('9999999999999999.99', ['0.01']), '9999999999999999.98')
  assert.equal(sumDeliveryQuantities(['0.10', '0.20']), '0.30')
  assert.equal(remainingDeliveryQuantity('1', ['2']), '0.00')
})

test('unknown balances and malformed decimal quantities block delivery submission', () => {
  assert.equal(remainingDeliveryQuantity('bad', []), null)
  assert.equal(remainingDeliveryQuantity('1', ['bad']), null)
  assert.equal(sumDeliveryQuantities(['1', 'bad']), null)
  assert.ok(deliveryQuantityError('1', null))
  for (const value of ['', '-1', '0.001', '1e2', 'NaN'])
    assert.ok(deliveryQuantityError(value, '10'))
  assert.ok(deliveryQuantityError('0.06', '0.05'))
  assert.equal(deliveryQuantityError('0.05', '0.05'), null)
  assert.equal(deliveryQuantityError('0', '0.05'), null)
})
