import { useResourcePage } from '@/lib/use-cursor-page'
import { useRecordsById } from '@/lib/use-records-by-id'
import { parseStockCents } from '@/features/logistics/stock-display'
import type { StockItemWithInventoryItem } from '@/features/logistics/stock-items.types'
import type { InventoryItemResponse } from '@/features/products/products.types'

export function useTransferCatalog(source: string, search: string) {
  const stock = useResourcePage<StockItemWithInventoryItem>(
    `/stock-items/warehouses/${source}`,
    { q: search.trim() || undefined },
    !!source,
    source,
  )
  const products = useRecordsById<InventoryItemResponse>(
    '/inventory-items',
    stock.items.map((item) => item.inventoryItemId),
  )
  const rows = stock.items.flatMap((item) => {
    const product = products.data.find((product) => product.id === item.inventoryItemId)
    const available = parseStockCents(item.availableQuantity)
    return item.warehouseId === Number(source) && product?.isActive
      ? [{ stock: item, product, available }]
      : []
  })
  return {
    stock,
    products,
    rows,
    isLoading: stock.isLoading || products.isPending,
    isError: stock.isError || products.isError,
  }
}
