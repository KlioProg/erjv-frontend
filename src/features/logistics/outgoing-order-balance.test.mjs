import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canPrepareOutgoing,
  outgoingOrderBalances,
  remainingOutgoingItemCount,
  outgoingSourceCapacity,
  outgoingLinesForQuantity,
} from './outgoing-order-balance.ts'

const order = {
  id: 1,
  status: 'CONFIRMED',
  items: [
    {
      id: 10,
      inventoryItemId: 1,
      quantity: '100',
      allocations: [
        { id: 11, stockItemId: 1, quantity: '60', releasedAt: null },
        { id: 12, stockItemId: 2, quantity: '40', releasedAt: null },
      ],
    },
    {
      id: 20,
      inventoryItemId: 2,
      quantity: '0.25',
      allocations: [{ id: 21, stockItemId: 3, quantity: '0.25', releasedAt: null }],
    },
  ],
}
const delivery = (status, allocationId, quantity, salesOrderId = 1) => ({
  salesOrderId,
  status,
  items: [{ salesOrderAllocationId: allocationId, quantity }],
})
const stocks = [
  { id: 1, warehouseId: 1, inventoryItemId: 1, quantity: '100', reservedQuantity: '100' },
  { id: 2, warehouseId: 2, inventoryItemId: 1, quantity: '100' },
  { id: 3, warehouseId: 1, inventoryItemId: 2, quantity: '0.20' },
]
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
test('every non-cancelled shipment counts, including drafts, with per-item balances', () => {
  const balances = outgoingOrderBalances(order, [
    delivery('DRAFT', 11, '10'),
    delivery('SCHEDULED', 11, '20'),
    delivery('DISPATCHED', 11, '10'),
    delivery('DELIVERED', 12, '20'),
    delivery('CANCELLED', 12, '20'),
    delivery('SCHEDULED', 11, '100', 99),
    delivery('DELIVERED', 21, '0.20'),
  ])
  assert.equal(balances[0].committed, '60.00')
  assert.equal(balances[0].remaining, '40.00')
  assert.equal(balances[1].remaining, '0.05')
  assert.equal(remainingOutgoingItemCount(balances), 2)
  assert.equal(outgoingSourceCapacity(balances[0], 1, stocks, warehouses), '20.00')
  assert.equal(outgoingSourceCapacity(balances[0], 2, stocks, warehouses), '20.00')
})
test('fully arranged differs from delivered and cancellation makes quantities eligible again', () => {
  const arranged = [
    delivery('DRAFT', 11, '60'),
    delivery('SCHEDULED', 12, '40'),
    delivery('DISPATCHED', 21, '0.25'),
  ]
  assert.equal(remainingOutgoingItemCount(outgoingOrderBalances(order, arranged)), 0)
  arranged[0].status = 'CANCELLED'
  assert.equal(remainingOutgoingItemCount(outgoingOrderBalances(order, arranged)), 1)
  assert.equal(order.status, 'CONFIRMED')
})
test('sources use their own saved allocation and physical stock without double-deducting reservations', () => {
  const balances = outgoingOrderBalances(order, [])
  assert.equal(outgoingSourceCapacity(balances[0], 1, stocks, warehouses), '60.00')
  assert.equal(outgoingSourceCapacity(balances[1], 1, stocks, warehouses), '0.20')
  assert.equal(outgoingSourceCapacity(balances[0], 99, stocks, warehouses), null)
  assert.deepEqual(outgoingLinesForQuantity(balances[0], 2, '0.05', stocks), [
    { salesOrderAllocationId: 12, quantity: '0.05' },
  ])
  assert.throws(() => outgoingLinesForQuantity(balances[0], 2, '40.01', stocks))
})
test('unknown and very large quantities remain exact and never become fully arranged', () => {
  const unknown = outgoingOrderBalances(order, [delivery('SCHEDULED', 11, 'bad')])
  assert.equal(unknown[0].remaining, null)
  assert.equal(outgoingSourceCapacity(unknown[0], 1, stocks, warehouses), null)
  const large = structuredClone(order)
  large.items[0].quantity = '9999999999999999.99'
  assert.equal(
    outgoingOrderBalances(large, [delivery('SCHEDULED', 11, '0.05')])[0].remaining,
    '9999999999999999.94',
  )
})
