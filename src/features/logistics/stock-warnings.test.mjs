import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildStockWarnings,
  filterStockWarnings,
  stockCondition,
  stockConditionRank,
  stockConditionForItem,
} from './stock-warnings.ts'
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
  const stock = {
    id: 1,
    inventoryItemId: 1,
    warehouseId: 1,
    quantity: '0.00',
    availableQuantity: '0',
    stockStatus: 'OUT',
  }
  const warnings = buildStockWarnings(
    products,
    [
      stock,
      { ...stock },
      { ...stock, warehouseId: 2, quantity: '0.01', stockStatus: 'UNCONFIGURED' },
      { ...stock, inventoryItemId: 2 },
      { ...stock, warehouseId: 3 },
      { ...stock, warehouseId: 99 },
      { ...stock, inventoryItemId: 99 },
      { ...stock, warehouseId: 2, availableQuantity: 'bad' },
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
    {
      id: 1,
      inventoryItemId: 1,
      warehouseId: 1,
      quantity: '0',
      availableQuantity: '0',
      stockStatus: 'OUT',
    },
    {
      id: 2,
      inventoryItemId: 1,
      warehouseId: 2,
      quantity: '9999999999999999.99',
      availableQuantity: '9999999999999999.99',
      stockStatus: 'UNCONFIGURED',
    },
  ]
  assert.equal(stockCondition(buildCatalogStockMap(stocks).get(1).totalCents), 'NORMAL')
  assert.equal(buildStockWarnings(products, stocks, warehouses)[0].warehouseId, 1)
  stocks[0].quantity = '0.01'
  stocks[0].availableQuantity = '0.01'
  stocks[0].stockStatus = 'UNCONFIGURED'
  assert.equal(buildStockWarnings(products, stocks, warehouses).length, 0)
})

test('backend statuses are authoritative, including unconfigured and missing information', () => {
  for (const status of ['OUT', 'LOW', 'NORMAL', 'UNCONFIGURED']) {
    assert.equal(stockConditionForItem({ quantity: '0', stockStatus: status }), status)
  }
  assert.equal(stockConditionForItem({ quantity: '0', availableQuantity: '0' }), 'UNKNOWN')
})

test('warnings display backend available balances even when physical stock is positive', () => {
  const products = [{ id: 1, name: 'Rice', isActive: true }]
  const warehouses = [
    { id: 1, name: 'Store', isActive: true },
    { id: 2, name: 'Hub', isActive: true },
  ]
  const stock = {
    id: 1,
    inventoryItemId: 1,
    warehouseId: 1,
    quantity: '10',
    reservedQuantity: '6',
    damagedQuantity: '4',
    availableQuantity: '0',
    stockStatus: 'OUT',
  }
  const warnings = buildStockWarnings(
    products,
    [
      stock,
      { ...stock },
      {
        ...stock,
        warehouseId: 2,
        availableQuantity: '1.25',
        stockStatus: 'LOW',
        reorderThreshold: '2',
      },
    ],
    warehouses,
  )
  assert.equal(warnings.length, 2)
  assert.equal(warnings[0].quantityCents, 0n)
  assert.equal(warnings[1].quantityCents, 125n)
  assert.equal(filterStockWarnings(warnings, { warningFilter: 'LOW', warehouseId: 2 }).length, 1)
  assert.equal(
    buildStockWarnings(products, [{ ...stock, availableQuantity: undefined }], warehouses).length,
    0,
  )
})

test('filters warning categories independently for each warehouse without using global totals', () => {
  const warnings = [
    { productId: 1, warehouseId: 1, severity: 'OUT', quantityCents: 0n },
    {
      productId: 1,
      warehouseId: 2,
      severity: 'LOW',
      quantityCents: 100n,
      reorderThresholdCents: 200n,
    },
    {
      productId: 2,
      warehouseId: 1,
      severity: 'LOW',
      quantityCents: 200n,
      reorderThresholdCents: 200n,
    },
  ]
  assert.equal(stockCondition(warnings[1].quantityCents, warnings[1].reorderThresholdCents), 'LOW')
  assert.deepEqual(filterStockWarnings(warnings, { warningFilter: 'ALL' }), warnings)
  assert.deepEqual(filterStockWarnings(warnings, { warningFilter: 'LOW', warehouseId: 2 }), [
    warnings[1],
  ])
  assert.deepEqual(filterStockWarnings(warnings, { warningFilter: 'OUT', warehouseId: 1 }), [
    warnings[0],
  ])
  assert.deepEqual(filterStockWarnings(warnings, { warningFilter: 'OUT', warehouseId: 2 }), [])
})
