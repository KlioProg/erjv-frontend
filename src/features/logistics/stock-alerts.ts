import type { InventoryItemResponse } from '../products/products.types'
import type { StockItemWithRelations } from './stock-items.types'
import type { Warehouse } from './warehouses.types'
import { parseStockCents } from './stock-display.ts'

export type StockAlert = {
  id: string
  type: 'stock'
  kind: 'out-of-stock'
  productId: number
  productName: string
  unit: string
  quantityCents: bigint
} & ({ scope: 'warehouse'; warehouseId: number; warehouseName: string } | { scope: 'overall' })

/** Input must be the complete, unpaginated backend stock list, never a warehouse/page slice. */
export function buildStockAlerts(
  stocks: StockItemWithRelations[],
  products: InventoryItemResponse[],
  warehouses: Warehouse[],
): StockAlert[] {
  const productMap = new Map(
    products.filter((product) => product.isActive === true).map((p) => [p.id, p]),
  )
  const warehouseMap = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]))
  const balances = new Map<string, { stock: StockItemWithRelations; quantity: bigint | null }>()

  for (const stock of stocks) {
    if (!productMap.has(stock.inventoryItemId)) continue
    const key = `${stock.inventoryItemId}:${stock.warehouseId}`
    const quantity = parseStockCents(stock.availableQuantity)
    const existing = balances.get(key)
    // The backend enforces one allocation per product/warehouse. Fail closed on conflicting data.
    balances.set(key, {
      stock,
      quantity: existing && existing.quantity !== quantity ? null : quantity,
    })
  }

  const alerts: StockAlert[] = []
  const totals = new Map<number, bigint | null>()
  for (const { stock, quantity } of balances.values()) {
    const product = productMap.get(stock.inventoryItemId)!
    const warehouse = warehouseMap.get(stock.warehouseId)
    if (warehouse?.isActive === false) continue
    const previous = totals.get(product.id) ?? 0n
    totals.set(
      product.id,
      totals.get(product.id) === null ||
        !warehouse ||
        warehouse.isActive !== true ||
        quantity === null
        ? null
        : previous + quantity,
    )
    if (warehouse?.isActive === true && quantity === 0n) {
      alerts.push({
        id: `stock:warehouse:${product.id}:${warehouse.id}:out-of-stock`,
        type: 'stock',
        kind: 'out-of-stock',
        scope: 'warehouse',
        productId: product.id,
        productName: product.name,
        unit: product.unit || 'units',
        quantityCents: quantity,
        warehouseId: warehouse.id,
        warehouseName: warehouse.name,
      })
    }
  }
  // Only products with tracked stock in active warehouses qualify. Unstocked catalog items do not.
  for (const [productId, quantity] of totals) {
    if (quantity !== 0n) continue
    const product = productMap.get(productId)!
    alerts.push({
      id: `stock:overall:${productId}:out-of-stock`,
      type: 'stock',
      kind: 'out-of-stock',
      scope: 'overall',
      productId,
      productName: product.name,
      unit: product.unit || 'units',
      quantityCents: quantity,
    })
  }
  return alerts.sort(
    (a, b) =>
      a.scope.localeCompare(b.scope) ||
      a.productName.localeCompare(b.productName) ||
      a.id.localeCompare(b.id),
  )
}
