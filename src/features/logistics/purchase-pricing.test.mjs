import assert from 'node:assert/strict'
import test from 'node:test'
import {
  purchaseDecimal,
  purchaseLineTotal,
  purchaseTotal,
  formatPurchaseMoney,
  supplierReferenceCost,
  repricePurchaseLines,
  storedPurchaseTotal,
} from './purchase-pricing.ts'

test('one product supports different supplier references and agreed line costs', () => {
  const pricesA = [{ inventoryItemId: 1, latestUnitCost: '25.00' }]
  const pricesB = [{ inventoryItemId: 1, latestUnitCost: '30.00' }]
  assert.equal(supplierReferenceCost(pricesA, 1), '25.00')
  assert.equal(supplierReferenceCost(pricesB, 1), '30.00')
  assert.equal(purchaseLineTotal({ quantity: '100.00', unitCost: '25.00' }), 250000n)
  assert.equal(purchaseLineTotal({ quantity: '50.00', unitCost: '30.00' }), 150000n)
})

test('missing, unavailable and invalid reference prices stay empty; explicit zero is valid', () => {
  for (const latestUnitCost of [null, undefined, '-1', '1.234', '1000000000000.00']) {
    assert.equal(supplierReferenceCost([{ inventoryItemId: 1, latestUnitCost }], 1), '')
  }
  assert.equal(supplierReferenceCost([], 1), '')
  assert.equal(supplierReferenceCost([{ inventoryItemId: 1, latestUnitCost: '0' }], 1), '0.00')
  assert.equal(purchaseLineTotal({ quantity: '1', unitCost: '' }), null)
  assert.equal(purchaseLineTotal({ quantity: '1', unitCost: '0' }), 0n)
})

test('money uses exact cents and backend half-up per-line rounding', () => {
  assert.equal(purchaseLineTotal({ quantity: '0.05', unitCost: '0.10' }), 1n)
  assert.equal(
    purchaseTotal([
      { quantity: '0.05', unitCost: '0.10' },
      { quantity: '0.05', unitCost: '0.10' },
    ]),
    2n,
  )
  assert.equal(formatPurchaseMoney(purchaseLineTotal({ quantity: '3', unitCost: '0.10' })), '₱0.30')
  assert.equal(formatPurchaseMoney(99999999999999n), '₱999,999,999,999.99')
})

test('invalid quantities, overprecision and monetary overflow cannot form a valid order', () => {
  for (const quantity of ['', '0', '-1', '1e2', '1.001', '10000000000']) {
    assert.equal(purchaseLineTotal({ quantity, unitCost: '25' }), null)
  }
  assert.equal(purchaseDecimal('1000000000000'), null)
  assert.equal(purchaseLineTotal({ quantity: '2', unitCost: '999999999999.99' }), null)
  assert.equal(purchaseTotal([{ quantity: '1', unitCost: '' }]), null)
})

test('explicit supplier repricing clears unknown costs and never mutates agreed lines', () => {
  const lines = [
    { id: 'a', inventoryItemId: 1, quantity: '100', unitCost: '24' },
    { id: 'b', inventoryItemId: 2, quantity: '50', unitCost: '40' },
  ]
  const repriced = repricePurchaseLines(lines, [{ inventoryItemId: 1, latestUnitCost: '30' }])
  assert.deepEqual(
    repriced.map((line) => line.unitCost),
    ['30.00', ''],
  )
  assert.deepEqual(
    lines.map((line) => line.unitCost),
    ['24', '40'],
  )
  assert.equal(purchaseTotal(repriced), null)
})

test('historical totals use stored amounts and never reconstruct missing totals', () => {
  assert.equal(
    storedPurchaseTotal([
      { totalAmount: '2500.00', unitPrice: '99' },
      { totalAmount: '1500.00', unitPrice: '1' },
    ]),
    400000n,
  )
  assert.equal(
    storedPurchaseTotal([{ totalAmount: undefined, quantity: '100', unitPrice: '25' }]),
    null,
  )
})
