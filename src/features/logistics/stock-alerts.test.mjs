import assert from 'node:assert/strict'
import test from 'node:test'
import { buildStockAlerts } from './stock-alerts.ts'

const product = (id, isActive = true) => ({ id, name: `Product ${id}`, unit: 'kg', isActive })
const warehouse = (id, isActive = true) => ({ id, name: `Warehouse ${id}`, isActive })
const stock = (productId, warehouseId, quantity, id = warehouseId) => ({
  id,
  inventoryItemId: productId,
  warehouseId,
  quantity,
})
const products = [product(1), product(2), product(3, false)]
const warehouses = [warehouse(1), warehouse(2), warehouse(3, false)]

test('warehouse stockouts remain actionable when other locations have stock', () => {
  const alerts = buildStockAlerts(
    [stock(1, 1, '100.00'), stock(1, 2, '0.00')],
    products,
    warehouses,
  )
  assert.equal(alerts.length, 1)
  assert.equal(alerts[0].scope, 'warehouse')
  assert.equal(alerts[0].warehouseId, 2)
  assert.equal(alerts[0].quantityCents, 0n)
})

test('overall stockout requires confirmed zero across tracked active warehouses', () => {
  const alerts = buildStockAlerts(
    [stock(1, 1, '0.00'), stock(1, 2, '0.00'), stock(1, 3, '100.00')],
    products,
    warehouses,
  )
  assert.equal(alerts.filter((alert) => alert.scope === 'overall').length, 1)
  assert.equal(alerts.filter((alert) => alert.scope === 'warehouse').length, 2)
  assert.equal(
    alerts.some((alert) => alert.productId === 2),
    false,
    'Unstocked catalog item is not depleted',
  )
})

test('invalid quantities and unknown warehouse eligibility cannot confirm overall depletion', () => {
  for (const quantity of [undefined, null, '', 'bad', '-1', '0.001']) {
    const alerts = buildStockAlerts([stock(1, 1, '0'), stock(1, 2, quantity)], products, warehouses)
    assert.equal(alerts.length, 1)
    assert.equal(alerts[0].scope, 'warehouse')
  }
  const alerts = buildStockAlerts([stock(1, 1, '0'), stock(1, 99, '0')], products, warehouses)
  assert.equal(
    alerts.some((alert) => alert.scope === 'overall'),
    false,
  )
})

test('archived products and warehouses do not generate active alerts', () => {
  assert.deepEqual(buildStockAlerts([stock(3, 1, '0'), stock(1, 3, '0')], products, warehouses), [])
})

test('stable scoped identities deduplicate refreshes; conflicting duplicate allocations fail closed', () => {
  const records = [stock(1, 1, '0'), stock(1, 1, '0')]
  const alerts = buildStockAlerts(records, products, warehouses)
  assert.equal(alerts.length, 2)
  assert.equal(new Set(alerts.map((alert) => alert.id)).size, 2)
  assert.deepEqual(buildStockAlerts([...records].reverse(), products, warehouses), alerts)
  assert.deepEqual(buildStockAlerts([...records, stock(1, 1, '5')], products, warehouses), [])
})

test('replenishment resolves alerts and positive balances never use an invented low-stock threshold', () => {
  const before = buildStockAlerts([stock(1, 1, '0')], products, warehouses)
  assert.equal(before.length, 2)
  for (const quantity of ['0.01', '8', '20', '100']) {
    assert.deepEqual(buildStockAlerts([stock(1, 1, quantity)], products, warehouses), [])
  }
})
