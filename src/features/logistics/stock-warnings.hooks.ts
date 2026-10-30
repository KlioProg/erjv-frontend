import { buildStockWarnings } from './stock-warnings'
import { useStockNotificationRecords } from './use-stock-notification-records'

/** Warnings describe loaded records until every stock and metadata page is complete. */
export function useStockWarnings() {
  const records = useStockNotificationRecords()
  return {
    ...records,
    warehouses: records.warehouses.filter((warehouse) => warehouse.isActive),
    warnings: records.loading || records.unavailable
      ? [] : buildStockWarnings(records.products, records.stocks, records.warehouses),
  }
}
