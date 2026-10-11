import type { InventoryItemResponse } from './products.types'
import type { StockItem } from '../logistics/stock-items.types'
import { parseStockCents } from '../logistics/stock-display.ts'

export function filterCatalogProducts(products: InventoryItemResponse[], query: string) {
  const term = query.trim().toLocaleLowerCase()
  return term
    ? products.filter((product) =>
        [product.name, product.variety, product.description].some((value) =>
          value?.toLocaleLowerCase().includes(term),
        ),
      )
    : products
}

export function buildCatalogStockMap<T extends StockItem>(stocks: T[]) {
  const map = new Map<
    number,
    {
      totalCents: bigint | null
      availableCents: bigint | null
      warehouseCount: number
      allocations: T[]
    }
  >()
  for (const stock of stocks) {
    const current = map.get(stock.inventoryItemId) ?? {
      totalCents: 0n,
      availableCents: 0n,
      warehouseCount: 0,
      allocations: [],
    }
    const physical = parseStockCents(stock.quantity)
    const reserved = parseStockCents(stock.reservedQuantity ?? '0')
    const available =
      physical === null || reserved === null ? null : physical > reserved ? physical - reserved : 0n
    current.totalCents =
      current.totalCents === null || physical === null ? null : current.totalCents + physical
    current.availableCents =
      current.availableCents === null || available === null
        ? null
        : current.availableCents + available
    current.warehouseCount += 1
    current.allocations.push(stock)
    map.set(stock.inventoryItemId, current)
  }
  return map
}
