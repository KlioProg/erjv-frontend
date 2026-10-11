import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSalesOrderPayload } from './sales-order-entry.utils.ts'
import { orderAmounts } from '../../lib/order-amounts.ts'
import { eligibleSalesSources, salesAllocationError } from './sales-order-entry.schema.ts'

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

const stocks = [
  { id: 11, inventoryItemId: 7, warehouseId: 1, quantity: '10.00', reservedQuantity: '2.50' },
  { id: 12, inventoryItemId: 7, warehouseId: 2, quantity: '5.00', reservedQuantity: '0' },
]
const warehouses = [
  { id: 1, isActive: true },
  { id: 2, isActive: true },
]
const line = { productId: 7, quantity: '10.00', unitPrice: '20', name: 'Test item' }

test('allocation validation permits unfinished drafts but requires complete sources for confirmation', () => {
  assert.equal(salesAllocationError(line, stocks, warehouses, false), undefined)
  assert.match(salesAllocationError(line, stocks, warehouses).message, /Select a stock source/)
  const split = {
    ...line,
    allocations: [
      { key: 1, stockItemId: 11, quantity: '7.50' },
      { key: 2, stockItemId: 12, quantity: '2.50' },
    ],
  }
  assert.equal(salesAllocationError(split, stocks, warehouses), undefined)
  split.allocations[1].quantity = '2.49'
  assert.match(
    salesAllocationError(split, stocks, warehouses).message,
    /equal the ordered quantity/,
  )
  split.allocations[1].stockItemId = 11
  assert.match(salesAllocationError(split, stocks, warehouses).message, /already selected/)
  split.allocations[0].quantity = '7.51'
  assert.match(salesAllocationError(split, stocks, warehouses).message, /Only 7.50/)
})

test('unknown, depleted, inactive and wrong-product sources are unavailable', () => {
  assert.deepEqual(
    eligibleSalesSources(
      7,
      [
        { ...stocks[0], quantity: 'unknown' },
        { ...stocks[0], reservedQuantity: 'unknown' },
        { ...stocks[0], reservedQuantity: '10' },
        { ...stocks[0], inventoryItemId: 8 },
        stocks[1],
      ],
      [{ id: 2, isActive: false }],
    ),
    [],
  )
})

test('sales payload preserves explicit decimal allocations without UI keys or warehouse IDs', () => {
  const payload = buildSalesOrderPayload({
    clientId: 1,
    deliveryAddress: 'Address',
    discountRate: '10.00',
    taxRate: '12.00',
    lines: [
      {
        ...line,
        allocations: [
          { key: 99, stockItemId: 11, quantity: '7.50' },
          { key: 100, stockItemId: 12, quantity: '2.50' },
        ],
      },
    ],
  })
  assert.deepEqual(payload.items[0].allocations, [
    { stockItemId: 11, quantity: '7.50' },
    { stockItemId: 12, quantity: '2.50' },
  ])
})
