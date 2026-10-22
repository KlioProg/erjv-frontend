import { useMemo } from 'react'
import { useProducts } from '../products/products.hooks'
import { useStockItems } from './stock-items.hooks'
import { useWarehouses } from './warehouses.hooks'
import { buildStockWarnings } from './stock-warnings'

/** Shares existing query caches and mutation invalidations; no notification persistence. */
export function useStockWarnings() {
  const products = useProducts()
  const stocks = useStockItems()
  const warehouses = useWarehouses()
  const unavailable = products.isError || stocks.isError || warehouses.isError
  const loading = products.isLoading || stocks.isLoading || warehouses.isLoading
  const warnings = useMemo(
    () =>
      unavailable || loading
        ? []
        : buildStockWarnings(products.data ?? [], stocks.data ?? [], warehouses.data ?? []),
    [products.data, stocks.data, warehouses.data, unavailable, loading],
  )
  return {
    warnings,
    warehouses: (warehouses.data ?? []).filter((warehouse) => warehouse.isActive),
    loading,
    unavailable,
    refreshing: products.isFetching || stocks.isFetching || warehouses.isFetching,
    refresh: () => Promise.all([products.refetch(), stocks.refetch(), warehouses.refetch()]),
  }
}
