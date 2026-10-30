import { useQuery } from '@tanstack/react-query'
import { fetchStockItemByIdApi } from './stock-items.api'
import { fetchProductByIdApi } from '@/features/products/products.api'
import { fetchWarehouseByIdApi } from './warehouses.api'

/** Selected records are resolved independently of searchable collection pages. */
export function useStockMetadata(id?: number) {
  return useQuery({
    queryKey: ['stock-items', 'metadata', id],
    enabled: Boolean(id && id > 0),
    queryFn: async () => {
      const stock = await fetchStockItemByIdApi(id!)
      if (!stock || stock.id !== id) throw Error('The selected stock record could not be verified.')
      const [inventoryItem, warehouse] = await Promise.all([
        fetchProductByIdApi(stock.inventoryItemId),
        fetchWarehouseByIdApi(stock.warehouseId),
      ])
      if (!inventoryItem || inventoryItem.id !== stock.inventoryItemId || !warehouse || warehouse.id !== stock.warehouseId)
        throw Error('The selected product or warehouse could not be verified.')
      return { ...stock, inventoryItem, warehouse }
    },
  })
}
