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

test('catalog totals physical stock independently from backend availability with exact decimal arithmetic', () => {
  const stocks = [
    {
      id: 1,
      warehouseId: 1,
      inventoryItemId: 1,
      onHandQuantity: '12.25',
      inTransitQuantity: '2.10',
      quarantinedQuantity: '1.25',
      availableQuantity: '8.90',
    },
    {
      id: 2,
      warehouseId: 2,
      inventoryItemId: 1,
      onHandQuantity: '0.10',
      inTransitQuantity: '0',
      quarantinedQuantity: '0',
      availableQuantity: '0.10',
    },
  ]
  const entry = buildCatalogStockMap(stocks).get(1)
  assert.equal(entry.totalCents, 1235n)
  assert.equal(entry.availableCents, 900n)
  assert.equal(entry.inTransitCents, 210n)
  assert.equal(entry.quarantinedCents, 125n)
  assert.equal(entry.warehouseCount, 2)
  assert.deepEqual(entry.allocations, stocks)
})

test('missing stock fields remain unknown without recalculating backend availability', () => {
  const entry = buildCatalogStockMap([
    { id: 1, inventoryItemId: 1, warehouseId: 1, onHandQuantity: '10' },
  ]).get(1)
  assert.equal(entry.totalCents, 1000n)
  assert.equal(entry.availableCents, null)
  assert.equal(entry.inTransitCents, null)
  assert.equal(entry.quarantinedCents, null)
})

test('unknown balances stay unknown and large supported values never lose precision', () => {
  assert.equal(
    buildCatalogStockMap([{ inventoryItemId: 1, onHandQuantity: 'unknown' }]).get(1).totalCents,
    null,
  )
  const malformedReservation = buildCatalogStockMap([
    { inventoryItemId: 1, onHandQuantity: '10', inTransitQuantity: 'invalid' },
  ]).get(1)
  assert.equal(malformedReservation.totalCents, 1000n)
  assert.equal(malformedReservation.availableCents, null)
  assert.equal(
    buildCatalogStockMap([
      { inventoryItemId: 1, onHandQuantity: '9999999999.99' },
      { inventoryItemId: 1, onHandQuantity: '0.01' },
    ]).get(1).totalCents,
    1000000000000n,
  )
  assert.equal(buildCatalogStockMap([]).size, 0)
})
