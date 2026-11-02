import { buildStockWarnings, stockConditionForItem } from './stock-warnings'
import { parseStockCents } from './stock-display'
import { useStockNotificationRecords } from './use-stock-notification-records'

/** Warnings describe loaded records until every stock and metadata page is complete. */
export function useStockWarnings() {
  const records = useStockNotificationRecords()
  const metadataValid = [...records.products, ...records.warehouses].every(
    (item) =>
      typeof item.name === 'string' &&
      item.name.trim().length > 0 &&
      typeof item.isActive === 'boolean',
  )
  const balancesValid = records.stocks.every(
    (stock) =>
      Number.isSafeInteger(stock.inventoryItemId) &&
      stock.inventoryItemId > 0 &&
      Number.isSafeInteger(stock.warehouseId) &&
      stock.warehouseId > 0 &&
      parseStockCents(stock.availableQuantity) !== null &&
      stockConditionForItem(stock) !== 'UNKNOWN',
  )
  const unavailable = records.unavailable || !metadataValid
  return {
    ...records,
    unavailable,
    complete: records.complete && metadataValid,
    verified: records.complete && metadataValid && balancesValid,
    warehouses: records.warehouses.filter((warehouse) => warehouse.isActive),
    warnings:
      records.loading || unavailable
        ? []
        : buildStockWarnings(records.products, records.stocks, records.warehouses),
  }
}
