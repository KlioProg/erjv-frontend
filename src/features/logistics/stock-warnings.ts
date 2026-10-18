import type { InventoryItemResponse } from '../products/products.types'
import type { StockItem } from './stock-items.types'
import type { Warehouse } from './warehouses.types'
import { parseStockCents } from './stock-display.ts'

export type StockCondition = 'OUT' | 'LOW' | 'NORMAL' | 'UNKNOWN'
export type InventoryFocusTarget = { productId: number; warehouseId: number }
export type StockWarningFilter = 'ALL' | 'OUT' | 'LOW'
export type InventoryWarningTarget = { warningFilter: StockWarningFilter; warehouseId?: number }
export type InventoryNavigationTarget = InventoryFocusTarget | InventoryWarningTarget
export type StockWarning = InventoryFocusTarget & {
  id: string
  productName: string
  locationName: string
  unit: string
  quantityCents: bigint
  severity: 'OUT' | 'LOW'
  reorderThresholdCents?: bigint
}

export function filterStockWarnings(
  warnings: StockWarning[],
  { warningFilter, warehouseId }: InventoryWarningTarget,
): StockWarning[] {
  return warnings.filter(
    (warning) =>
      (warningFilter === 'ALL' || warning.severity === warningFilter) &&
      (warehouseId === undefined || warning.warehouseId === warehouseId),
  )
}

/** LOW is valid only with an authoritative threshold; today's API supplies none. */
export function stockCondition(
  quantity: bigint | null,
  reorderThreshold: bigint | null = null,
): StockCondition {
  if (quantity === null) return 'UNKNOWN'
  if (quantity === 0n) return 'OUT'
  return reorderThreshold !== null && reorderThreshold >= 0n && quantity <= reorderThreshold
    ? 'LOW'
    : 'NORMAL'
}

export const stockConditionRank: Record<StockCondition, number> = {
  OUT: 0,
  LOW: 1,
  NORMAL: 2,
  UNKNOWN: 3,
}

export function buildStockWarnings(
  products: InventoryItemResponse[],
  stocks: StockItem[],
  warehouses: Warehouse[],
): StockWarning[] {
  const productMap = new Map(
    products.filter((product) => product.isActive).map((product) => [product.id, product]),
  )
  const warehouseMap = new Map(
    warehouses
      .filter((warehouse) => warehouse.isActive)
      .map((warehouse) => [warehouse.id, warehouse]),
  )
  const warnings = new Map<string, StockWarning>()
  for (const stock of stocks) {
    const product = productMap.get(stock.inventoryItemId)
    const location = warehouseMap.get(stock.warehouseId)
    const quantity = parseStockCents(stock.quantity)
    const severity = stockCondition(quantity)
    if (!product || !location || quantity === null || (severity !== 'OUT' && severity !== 'LOW'))
      continue
    const id = `stock:${product.id}:${location.id}:${severity}`
    warnings.set(id, {
      id,
      productId: product.id,
      warehouseId: location.id,
      productName: product.name,
      locationName: location.name,
      unit: product.unit || 'units',
      quantityCents: quantity,
      severity,
    })
  }
  return [...warnings.values()].sort(
    (a, b) =>
      stockConditionRank[a.severity] - stockConditionRank[b.severity] ||
      a.productName.localeCompare(b.productName) ||
      a.locationName.localeCompare(b.locationName) ||
      a.productId - b.productId ||
      a.warehouseId - b.warehouseId,
  )
}
