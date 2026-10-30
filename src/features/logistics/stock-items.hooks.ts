import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createStockItemApi,
  deleteStockItemApi,
  fetchStockItemByPairApi,
  fetchStockItemByIdApi,
  setReorderThresholdApi,
  createStockAdjustmentApi,
} from './stock-items.api'
import type {
  CreateStockItemPayload,
  SetReorderThresholdPayload,
  StockAdjustmentPayload,
  StockItemWithRelations,
  StockItemWithInventoryItem,
  StockItemWithWarehouse,
} from './stock-items.types'
import { getErrorMessage } from '@/lib/api-client'
import { useCursorLookup } from '@/lib/use-cursor-lookup'
import { parseStockCents } from './stock-display'

export const STOCK_ITEMS_QUERY_KEY = ['stock-items'] as const

export function useStockItems(filter: { q?: string } = {}) {
  const query = useCursorLookup<StockItemWithRelations>('/stock-items', filter)
  return { ...query, data: query.items }
}
export function useWarehouseStock(warehouseId?: number, filter: { q?: string } = {}) {
  const query = useCursorLookup<StockItemWithInventoryItem>(`/stock-items/warehouses/${warehouseId}`, filter, warehouseId !== undefined)
  return { ...query, data: query.items }
}
export function useItemStock(inventoryItemId?: number, filter: { q?: string } = {}) {
  const query = useCursorLookup<StockItemWithWarehouse>(`/stock-items/inventory-items/${inventoryItemId}`, filter, inventoryItemId !== undefined)
  return { ...query, data: query.items }
}

export function useStockItemByPair(inventoryItemId?: number, warehouseId?: number) {
  return useQuery({
    queryKey: [...STOCK_ITEMS_QUERY_KEY, 'pair', inventoryItemId, warehouseId],
    queryFn: () =>
      inventoryItemId && warehouseId
        ? fetchStockItemByPairApi(inventoryItemId, warehouseId)
        : Promise.resolve(null),
    enabled: Boolean(inventoryItemId && warehouseId && inventoryItemId > 0 && warehouseId > 0),
  })
}

export function useStockItemById(id?: number) {
  return useQuery({
    queryKey: [...STOCK_ITEMS_QUERY_KEY, 'detail', id],
    queryFn: () => fetchStockItemByIdApi(id!),
    enabled: id !== undefined,
  })
}

export function useCreateStockItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      payload,
    }: {
      payload: CreateStockItemPayload
      itemName?: string
      whName?: string
    }) => createStockItemApi(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Stock registered in warehouse successfully')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCreateStockAdjustment() {
  const client = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: ({ id, payload }: { id: number; payload: StockAdjustmentPayload }) => createStockAdjustmentApi(id, payload),
    onSettled: async () => {
      await Promise.all(['stock-items', 'products', 'warehouses', 'quarantine-lots', 'outgoing-deliveries', 'delivery-runs'].map((key) => client.invalidateQueries({ queryKey: [key] })))
    },
    onSuccess: () => toast.success('Stock adjustment recorded'),
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}

export function useSetReorderThreshold() {
  const queryClient = useQueryClient()
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
    ])
  return useMutation({
    retry: false,
    mutationFn: async ({ id, payload }: { id: number; payload: SetReorderThresholdPayload }) => {
      const saved = await setReorderThresholdApi(id, payload)
      if (
        saved?.id !== id ||
        !(
          saved.reorderThreshold === null ||
          (typeof saved.reorderThreshold === 'string' &&
            parseStockCents(saved.reorderThreshold) !== null)
        )
      ) {
        await refresh()
        throw new Error(
          'We could not confirm the saved threshold. Refresh the stock list and review it before trying again.',
        )
      }
      return saved
    },
    onSuccess: async () => {
      await refresh()
      toast.success('Reorder threshold updated')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeleteStockItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteStockItemApi(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Warehouse stock allocation removed')
    },
    onError: (err: unknown) => {
      const msg = getErrorMessage(err)
      if (
        msg.toLowerCase().includes('internal server error') ||
        (typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          (err as { response?: { status?: number } }).response?.status === 500)
      ) {
        toast.error(
          'Cannot remove allocation: this product has delivery or movement history in this warehouse. In ERP systems, items with audit history must remain as Out of Stock (0 units).',
          { duration: 6000 },
        )
      } else {
        toast.error(msg)
      }
    },
  })
}
