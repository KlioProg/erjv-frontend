import type { InventoryItemResponse } from './products.types'
import type { StockItem } from '../logistics/stock-items.types'
import { parseStockCents } from '../logistics/stock-display.ts'
import { stockConditionForItem, type StockCondition } from '../logistics/stock-warnings.ts'

/** Product availability is known only after every stock page in the displayed scope is loaded. */
export function catalogStockCondition(
  stock: { availableCents: bigint | null; allocations: StockItem[] } | undefined,
  complete: boolean,
): StockCondition | 'UNASSIGNED' {
  if (!complete) return 'UNKNOWN'
  if (!stock) return 'UNASSIGNED'
  if (
    stock.availableCents === null ||
    stock.allocations.some((item) => {
      if (stockConditionForItem(item) === 'UNKNOWN') return true
      if (item.stockStatus !== 'LOW') return false
      const threshold = parseStockCents(item.reorderThreshold)
      const available = parseStockCents(item.availableQuantity)
      return threshold === null || available === null || available <= 0n || available > threshold
    })
  )
    return 'UNKNOWN'
  if (stock.availableCents === 0n) return 'OUT'
  const positive = stock.allocations.filter(
    (item) => (parseStockCents(item.availableQuantity) ?? 0n) > 0n,
  )
  return positive.length && positive.every((item) => item.stockStatus === 'LOW') ? 'LOW' : 'NORMAL'
}

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
      inTransitCents: bigint | null
      quarantinedCents: bigint | null
      warehouseCount: number
      allocations: T[]
    }
  >()
  for (const stock of stocks) {
    const current = map.get(stock.inventoryItemId) ?? {
      totalCents: 0n,
      availableCents: 0n,
      inTransitCents: 0n,
      quarantinedCents: 0n,
      warehouseCount: 0,
      allocations: [],
    }
    const physical = parseStockCents(stock.onHandQuantity)
    const available = parseStockCents(stock.availableQuantity)
    const inTransit = parseStockCents(stock.inTransitQuantity)
    const quarantined = parseStockCents(stock.quarantinedQuantity)
    current.totalCents =
      current.totalCents === null || physical === null ? null : current.totalCents + physical
    current.availableCents =
      current.availableCents === null || available === null
        ? null
        : current.availableCents + available
    current.inTransitCents =
      current.inTransitCents === null || inTransit === null ? null : current.inTransitCents + inTransit
    current.quarantinedCents =
      current.quarantinedCents === null || quarantined === null ? null : current.quarantinedCents + quarantined
    current.warehouseCount += 1
    current.allocations.push(stock)
    map.set(stock.inventoryItemId, current)
  }
  return map
}
