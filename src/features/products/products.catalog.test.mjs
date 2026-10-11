import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCatalogStockMap, filterCatalogProducts } from './products.catalog.utils.ts'

test('catalog searches existing name, variety and description without mutating products', () => {
  const products = [
    { id: 1, name: 'Test Mango', variety: 'Carabao', description: 'Orchard harvest' },
    { id: 2, name: 'Test Banana', variety: null, description: null },
  ]
  for (const query of [' mango ', 'CARABAO', 'harvest'])
    assert.deepEqual(
      filterCatalogProducts(products, query).map((product) => product.id),
      [1],
    )
  assert.equal(filterCatalogProducts(products, ' '), products)
  assert.deepEqual(filterCatalogProducts(products, 'unknown'), [])
  assert.equal(products.length, 2)
})

test('catalog totals physical stock independently from unreserved availability with exact decimal arithmetic', () => {
  const stocks = [
    { id: 1, inventoryItemId: 1, quantity: '12.25', reservedQuantity: '2.10' },
    { id: 2, inventoryItemId: 1, quantity: '0.10', reservedQuantity: '0.20' },
  ]
  const entry = buildCatalogStockMap(stocks).get(1)
  assert.equal(entry.totalCents, 1235n)
  assert.equal(entry.availableCents, 1015n)
  assert.equal(entry.warehouseCount, 2)
  assert.deepEqual(entry.allocations, stocks)
})

test('unknown balances stay unknown and large supported values never lose precision', () => {
  assert.equal(
    buildCatalogStockMap([{ inventoryItemId: 1, quantity: 'unknown' }]).get(1).totalCents,
    null,
  )
  const malformedReservation = buildCatalogStockMap([
    { inventoryItemId: 1, quantity: '10', reservedQuantity: 'invalid' },
  ]).get(1)
  assert.equal(malformedReservation.totalCents, 1000n)
  assert.equal(malformedReservation.availableCents, null)
  assert.equal(
    buildCatalogStockMap([
      { inventoryItemId: 1, quantity: '9999999999.99' },
      { inventoryItemId: 1, quantity: '0.01' },
    ]).get(1).totalCents,
    1000000000000n,
  )
  assert.equal(buildCatalogStockMap([]).size, 0)
})
