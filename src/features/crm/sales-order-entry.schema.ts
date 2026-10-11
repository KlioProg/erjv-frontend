import type { OrderLine } from './sales-order-entry.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { availableStock, decimalString, parseOrderDecimal } from '../../lib/order-amounts.ts'
import { quantityError } from '../../lib/order-entry.schema.ts'

export function eligibleSalesSources(
  productId: number,
  stocks: StockItem[],
  warehouses: Warehouse[],
) {
  return stocks.filter(
    (stock) =>
      stock.inventoryItemId === productId &&
      warehouses.some((warehouse) => warehouse.id === stock.warehouseId && warehouse.isActive) &&
      parseOrderDecimal(stock.quantity) !== null &&
      parseOrderDecimal(stock.reservedQuantity ?? '0') !== null &&
      availableStock(stock) > 0n,
  )
}

export function allocatedQuantity(line: OrderLine) {
  return (line.allocations ?? []).reduce(
    (sum, source) => sum + (parseOrderDecimal(source.quantity) ?? 0n),
    0n,
  )
}

export function salesAllocationError(
  line: OrderLine,
  stocks: StockItem[],
  warehouses: Warehouse[],
  complete = true,
) {
  const allocations = line.allocations ?? []
  const target = (key: number, field: 'source' | 'quantity', message: string) => ({
    message,
    focusId:
      field === 'quantity' && allocations.length === 1
        ? `order-quantity-${line.productId}`
        : `order-${field}-${line.productId}-${key}`,
  })
  if (!allocations.length)
    return complete
      ? {
          message: 'Select a stock source before confirming.',
          focusId: `order-source-${line.productId}-0`,
        }
      : undefined
  const eligible = eligibleSalesSources(line.productId, stocks, warehouses)
  const seen = new Set<number>()
  for (const source of allocations) {
    if (!source.stockItemId)
      return target(source.key, 'source', 'Select a warehouse for this source.')
    const stock = eligible.find((item) => item.id === source.stockItemId)
    if (!stock)
      return target(source.key, 'source', 'This source is unavailable. Choose another warehouse.')
    if (seen.has(source.stockItemId))
      return target(source.key, 'source', 'This warehouse is already selected.')
    seen.add(source.stockItemId)
    const invalid = quantityError(source.quantity)
    if (invalid) return target(source.key, 'quantity', invalid)
    if (parseOrderDecimal(source.quantity)! > availableStock(stock))
      return target(
        source.key,
        allocations.length === 1 ? 'source' : 'quantity',
        `Only ${decimalString(availableStock(stock))} is available from this warehouse.`,
      )
  }
  if (complete && allocatedQuantity(line) !== parseOrderDecimal(line.quantity))
    return target(
      allocations[0].key,
      allocations.length === 1 ? 'source' : 'quantity',
      'Source quantities must equal the ordered quantity.',
    )
}
