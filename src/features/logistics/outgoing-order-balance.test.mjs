import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canPrepareOutgoing,
  outgoingOrderBalances,
  outgoingLinesForAvailableSources,
  outgoingLinesForSources,
  remainingOutgoingItemCount,
} from './outgoing-order-balance.ts'

const order = {
  id: 1,
  status: 'CONFIRMED',
  items: [
    { id: 10, inventoryItemId: 1, quantity: '100' },
    { id: 20, inventoryItemId: 2, quantity: '0.25' },
  ],
}
const delivery = (status, salesOrderItemId, stockItemId, quantity, salesOrderId = 1) => ({
  salesOrderId,
  status,
  items: [{ salesOrderItemId, stockItemId, quantity }],
})
const stock = (id, warehouseId, inventoryItemId, availableQuantity, inTransitQuantity = '0') => ({
  id, revision: 1, warehouseId, inventoryItemId,
  onHandQuantity: availableQuantity, availableQuantity, inTransitQuantity,
  quarantinedQuantity: '0', conditionQuantities: { DAMAGED: '0', SPOILED: '0' },
  reorderThreshold: null, stockStatus: availableQuantity === '0' ? 'OUT' : 'UNCONFIGURED',
  createdAt: '', updatedAt: '',
})
const stocks = [stock(1, 1, 1, '60', '40'), stock(2, 2, 1, '100'), stock(3, 1, 2, '0.20')]

const warehouses = [
  { id: 1, isActive: true },
  { id: 2, isActive: true },
]

test('outgoing eligibility follows deliverable states, not display labels', () => {
  for (const status of ['CONFIRMED', 'PARTIALLY_DELIVERED'])
    assert.equal(canPrepareOutgoing({ status }), true)
  for (const status of ['DRAFT', 'CANCELLED', 'DELIVERED'])
    assert.equal(canPrepareOutgoing({ status }), false)
})

test('every non-cancelled delivery counts against its sales-order item', () => {
  const balances = outgoingOrderBalances(order, [
    delivery('READY', 10, 1, '10'),
    delivery('SCHEDULED', 10, 1, '20'),
    delivery('DISPATCHED', 10, 1, '10'),
    delivery('RECONCILED', 10, 2, '20'),
    delivery('CANCELLED', 10, 2, '20'),
    delivery('SCHEDULED', 10, 1, '100', 99),
    delivery('RECONCILED', 20, 3, '0.20'),
  ], stocks, warehouses)

  assert.equal(balances[0].committed, '60.00')
  assert.equal(balances[0].remaining, '40.00')
  assert.equal(balances[1].remaining, '0.05')
  assert.equal(remainingOutgoingItemCount(balances), 2)
  assert.equal(balances[0].sources[0].remaining, '40.00')
  assert.equal(balances[0].sources[1].remaining, '40.00')
})

test('cancelled deliveries restore ordered quantities and source choices allow split fulfillment', () => {
  const arranged = [
    delivery('READY', 10, 1, '60'),
    delivery('SCHEDULED', 10, 2, '40'),
    delivery('DISPATCHED', 20, 3, '0.25'),
  ]
  assert.equal(remainingOutgoingItemCount(outgoingOrderBalances(order, arranged, stocks, warehouses)), 0)
  arranged[0].status = 'CANCELLED'
  const [firstBalance] = outgoingOrderBalances(order, arranged, stocks, warehouses)
  assert.equal(firstBalance.remaining, '60.00')
  assert.deepEqual(
    outgoingLinesForSources(firstBalance, [
      { stockItemId: 1, quantity: '30' },
      { stockItemId: 2, quantity: '30' },
    ]),
    [
      { salesOrderItemId: 10, stockItemId: 1, quantity: '30.00' },
      { salesOrderItemId: 10, stockItemId: 2, quantity: '30.00' },
    ],
  )
})

test('source selection validates aggregate quantities, per-source availability and duplicates', () => {
  const [balance] = outgoingOrderBalances(order, [], stocks, warehouses)
  assert.throws(() =>
    outgoingLinesForSources(balance, [
      { stockItemId: 1, quantity: '61' },
    ]),
  )
  assert.throws(() =>
    outgoingLinesForSources(balance, [
      { stockItemId: 1, quantity: '60' },
      { stockItemId: 2, quantity: '41' },
    ]),
  )
  assert.throws(() =>
    outgoingLinesForSources(balance, [
      { stockItemId: 1, quantity: '10' },
      { stockItemId: 1, quantity: '10' },
    ]),
  )
  assert.throws(() =>
    outgoingLinesForSources(balance, [
      { stockItemId: 99, quantity: '1' },
    ]),
  )
  assert.deepEqual(outgoingLinesForAvailableSources(balance), [
    { salesOrderItemId: 10, stockItemId: 1, quantity: '60.00' },
    { salesOrderItemId: 10, stockItemId: 2, quantity: '40.00' },
  ])
})

test('unknown, malformed and very large quantities stay exact and block unsafe scheduling', () => {
  const unknown = outgoingOrderBalances(
    order,
    [delivery('SCHEDULED', 10, 1, 'bad')],
    stocks,
    warehouses,
  )
  assert.equal(unknown[0].remaining, null)
  assert.equal(remainingOutgoingItemCount(unknown), 1)
  assert.throws(() =>
    outgoingLinesForSources(unknown[0], [{ stockItemId: 1, quantity: '1' }]),
  )

  const largeOrder = {
    id: 2,
    status: 'CONFIRMED',
    items: [{ id: 30, inventoryItemId: 3, quantity: '9999999999999999.99' }],
  }
  const large = outgoingOrderBalances(largeOrder, [], [
    stock(4, 1, 3, '9999999999999999.99'),
  ], warehouses)
  assert.equal(large[0].remaining, '9999999999999999.99')
  assert.deepEqual(
    outgoingLinesForSources(large[0], [
      { stockItemId: 4, quantity: '9999999999999999.99' },
    ]),
    [
      {
        salesOrderItemId: 30,
        stockItemId: 4,
        quantity: '9999999999999999.99',
      },
    ],
  )
})
