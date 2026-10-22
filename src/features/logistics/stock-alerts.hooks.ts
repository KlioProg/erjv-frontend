import { useMemo } from 'react'
import { useAllProducts } from '../products/products.hooks'
import { useAllWarehouses } from './warehouses.hooks'
import { useStockItems } from './stock-items.hooks'
import { buildStockAlerts } from './stock-alerts'

const ALERT_REFRESH_INTERVAL = 30_000

/** Live active conditions share the existing query cache and stock invalidations; no inbox writes. */
export function useStockAlerts() {
  const stockQuery = useStockItems(undefined, ALERT_REFRESH_INTERVAL)
  const productsQuery = useAllProducts(ALERT_REFRESH_INTERVAL)
  const warehousesQuery = useAllWarehouses(ALERT_REFRESH_INTERVAL)
  const verified = stockQuery.isSuccess && productsQuery.isSuccess && warehousesQuery.isSuccess
  const alerts = useMemo(
    () =>
      verified
        ? buildStockAlerts(stockQuery.data!, productsQuery.data!, warehousesQuery.data!)
        : [],
    [verified, stockQuery.data, productsQuery.data, warehousesQuery.data],
  )
  return {
    alerts,
    verified,
    isLoading: stockQuery.isLoading || productsQuery.isLoading || warehousesQuery.isLoading,
    isFetching: stockQuery.isFetching || productsQuery.isFetching || warehousesQuery.isFetching,
    error: stockQuery.error || productsQuery.error || warehousesQuery.error,
    refresh: () =>
      Promise.all([stockQuery.refetch(), productsQuery.refetch(), warehousesQuery.refetch()]),
  }
}
