import { buildStockAlerts } from './stock-alerts'
import { useStockNotificationRecords } from './use-stock-notification-records'

/** Global depletion is verified only against complete stock and metadata lists. */
export function useStockAlerts() {
  const records = useStockNotificationRecords()
  return {
    alerts: records.complete ? buildStockAlerts(records.stocks, records.products, records.warehouses) : [],
    verified: records.complete,
    isLoading: records.loading,
    isFetching: records.refreshing,
    error: records.error,
    hasMore: records.hasMore,
    loadNext: records.loadNext,
    refresh: records.refresh,
  }
}
