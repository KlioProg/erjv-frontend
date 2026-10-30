import { useCursorLookup } from '@/lib/use-cursor-lookup'
import type { InventoryItemResponse } from '../products/products.types'
import type { Warehouse } from './warehouses.types'
import { useStockItems } from './stock-items.hooks'

export function useStockNotificationRecords() {
  const stocks = useStockItems()
  const products = useCursorLookup<InventoryItemResponse>('/inventory-items', { includeInactive: 'false' })
  const warehouses = useCursorLookup<Warehouse>('/warehouses', { includeInactive: 'true' })
  const queries = [stocks, products, warehouses]
  const loading = queries.some((query) => query.isPending)
  const unavailable = queries.some((query) => query.isError)
  const hasMore = queries.some((query) => query.hasNextPage)
  return {
    stocks: stocks.data,
    products: products.items,
    warehouses: warehouses.items,
    loading,
    unavailable,
    error: queries.find((query) => query.isError)?.error,
    complete: !loading && !unavailable && !hasMore,
    hasMore,
    refreshing: queries.some((query) => query.isFetching),
    loadNext: () => Promise.all(queries.filter((query) => query.hasNextPage).map((query) => query.fetchNextPage())),
    refresh: () => Promise.all(queries.map((query) => query.reload())),
  }
}
