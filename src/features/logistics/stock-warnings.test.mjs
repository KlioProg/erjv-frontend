import test from 'node:test'
import assert from 'node:assert/strict'
import { buildStockWarnings, stockCondition, stockConditionRank } from './stock-warnings.ts'
import { buildCatalogStockMap } from '../products/products.catalog.utils.ts'

test('low stock requires a configured threshold and never uses a universal default', () => {
  assert.equal(stockCondition(0n, 2000n), 'OUT')
  assert.equal(stockCondition(1n), 'NORMAL')
  assert.equal(stockCondition(2000n), 'NORMAL')
  assert.equal(stockCondition(2000n, 2000n), 'LOW')
  assert.equal(stockCondition(2001n, 2000n), 'NORMAL')
  assert.equal(stockCondition(100n, 50n), 'NORMAL')
  assert.equal(stockCondition(100n, 100n), 'LOW')
  assert.equal(stockCondition(null, 2000n), 'UNKNOWN')
  assert.ok(stockConditionRank.OUT < stockConditionRank.LOW)
  assert.ok(stockConditionRank.LOW < stockConditionRank.NORMAL)
})

test('warnings use real location IDs, exclude archived/unknown records and deduplicate', () => {
  const products = [
    { id: 1, name: 'Rice', unit: 'sacks', isActive: true },
    { id: 2, name: 'Archived rice', isActive: false },
  ]
  const warehouses = [
    { id: 1, name: 'Store', isActive: true },
    { id: 2, name: 'Warehouse', isActive: true },
    { id: 3, name: 'Archived location', isActive: false },
  ]
  const stock = { id: 1, inventoryItemId: 1, warehouseId: 1, quantity: '0.00' }
  const warnings = buildStockWarnings(
    products,
    [
      stock,
      { ...stock },
      { ...stock, warehouseId: 2, quantity: '0.01' },
      { ...stock, inventoryItemId: 2 },
      { ...stock, warehouseId: 3 },
      { ...stock, warehouseId: 99 },
      { ...stock, inventoryItemId: 99 },
      { ...stock, warehouseId: 2, quantity: 'bad' },
    ],
    warehouses,
  )
  assert.equal(warnings.length, 1)
  assert.deepEqual(warnings[0], {
    id: 'stock:1:1:OUT',
    productId: 1,
    warehouseId: 1,
    productName: 'Rice',
    locationName: 'Store',
    unit: 'sacks',
    quantityCents: 0n,
    severity: 'OUT',
  })
})

test('one empty location does not make a product globally out of stock', () => {
  const products = [{ id: 1, name: 'Rice', isActive: true }]
  const warehouses = [
    { id: 1, name: 'Store', isActive: true },
    { id: 2, name: 'Warehouse', isActive: true },
  ]
  const stocks = [
    { id: 1, inventoryItemId: 1, warehouseId: 1, quantity: '0' },
    { id: 2, inventoryItemId: 1, warehouseId: 2, quantity: '9999999999999999.99' },
  ]
  assert.equal(stockCondition(buildCatalogStockMap(stocks).get(1).totalCents), 'NORMAL')
  assert.equal(buildStockWarnings(products, stocks, warehouses)[0].warehouseId, 1)
  stocks[0].quantity = '0.01'
  assert.equal(buildStockWarnings(products, stocks, warehouses).length, 0)
})
