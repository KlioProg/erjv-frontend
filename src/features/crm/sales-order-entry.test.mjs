import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSalesOrderPayload } from './sales-order-entry.utils.ts'
import { orderAmounts } from '../../lib/order-amounts.ts'

test('sales command retains edited decimals and delivery metadata without warehouse fields', () => {
  const lines = [
    {
      productId: 7,
      name: 'Test item',
      quantity: '0.30',
      unitPrice: '123.45',
      stockItemId: 9,
      warehouseId: 3,
    },
  ]
  const amounts = orderAmounts(lines, 'percentage', '10', '12.00')
  const payload = buildSalesOrderPayload({
    clientId: 4,
    clientName: 'Test client',
    deliveryAddress: 'Test address',
    expectedAt: '2026-10-15T00:00:00.000Z',
    externalReference: 'REF-1',
    notes: 'Test instructions',
    lines,
    discountType: 'percentage',
    discountValue: '10',
    discountRate: amounts.discountRate,
    taxRate: amounts.taxRate,
    total: amounts.total,
    itemSummary: '',
    status: 'Active',
    cashier: 'Test user',
  })
  assert.equal(payload.clientId, 4)
  assert.equal(payload.deliveryAddress, 'Test address')
  assert.equal(payload.expectedAt, '2026-10-15T00:00:00.000Z')
  assert.equal(payload.externalReference, 'REF-1')
  assert.equal(payload.notes, 'Test instructions')
  assert.equal(payload.items[0].quantity, '0.30')
  assert.equal(payload.items[0].unitPrice, '123.45')
  assert.equal(payload.items[0].discountRate, '10.00')
  assert.equal(payload.items[0].taxRate, '12.00')
  assert.equal('allocations' in payload.items[0], false)
  assert.equal('stockItemId' in payload.items[0], false)
  assert.equal('warehouseId' in payload.items[0], false)
  // 37.04 subtotal - 3.70 discount + 4.00 VAT, rounded per backend line.
  assert.equal(amounts.total, '37.34')
  assert.equal('cashier' in payload, false)
  assert.equal('total' in payload, false)
})

test('each product omits legacy sources and gets the supported line rates', () => {
  const payload = buildSalesOrderPayload({
    clientId: 4,
    clientName: 'Test client',
    deliveryAddress: 'Test address',
    lines: [
      { productId: 7, name: 'A', quantity: '2', unitPrice: '100', stockItemId: 9 },
      { productId: 8, name: 'B', quantity: '1.25', unitPrice: '50', stockItemId: 10 },
    ],
    discountType: 'peso',
    discountValue: '26.25',
    discountRate: '10.00',
    taxRate: '12.00',
    total: '264.60',
    itemSummary: '',
    status: 'Active',
    cashier: 'Test user',
  })
  assert.ok(payload.items.every((item) => !('allocations' in item)))
  assert.ok(
    payload.items.every((item) => item.discountRate === '10.00' && item.taxRate === '12.00'),
  )
  assert.equal(payload.notes, undefined)
})

const line = { productId: 7, quantity: '10.00', unitPrice: '20', name: 'Test item' }

test('sales payload leaves fulfillment source selection to delivery preparation', () => {
  const payload = buildSalesOrderPayload({
    clientId: 1,
    deliveryAddress: 'Address',
    discountRate: '10.00',
    taxRate: '12.00',
    lines: [
      line,
    ],
  })
  assert.equal(payload.items[0].quantity, '10.00')
  assert.equal('allocations' in payload.items[0], false)
  assert.equal('stockItemId' in payload.items[0], false)
  assert.equal('warehouseId' in payload.items[0], false)
})
