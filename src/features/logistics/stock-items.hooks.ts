import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createStockItemApi,
  decreaseStockQuantityApi,
  deleteStockItemApi,
  fetchStockByItemApi,
  fetchStockByWarehouseApi,
  fetchStockItemsApi,
  increaseStockQuantityApi,
  setStockQuantityApi,
} from './stock-items.api'
import type {
  AdjustStockQuantityPayload,
  CreateStockItemPayload,
  SetStockQuantityPayload,
} from './stock-items.types'
import { getErrorMessage } from '@/lib/api-client'

export const STOCK_ITEMS_QUERY_KEY = ['stock-items'] as const

export function useStockItems() {
  return useQuery({
    queryKey: STOCK_ITEMS_QUERY_KEY,
    queryFn: fetchStockItemsApi,
  })
}

export function useWarehouseStock(warehouseId?: number) {
  return useQuery({
    queryKey: [...STOCK_ITEMS_QUERY_KEY, 'warehouse', warehouseId],
    queryFn: () => (warehouseId ? fetchStockByWarehouseApi(warehouseId) : fetchStockItemsApi()),
    enabled: warehouseId !== undefined,
  })
}

export function useItemStock(inventoryItemId?: number) {
  return useQuery({
    queryKey: [...STOCK_ITEMS_QUERY_KEY, 'item', inventoryItemId],
    queryFn: () => (inventoryItemId ? fetchStockByItemApi(inventoryItemId) : fetchStockItemsApi()),
    enabled: inventoryItemId !== undefined,
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

export function useSetStockQuantity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SetStockQuantityPayload }) =>
      setStockQuantityApi(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Stock quantity updated')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useIncreaseStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AdjustStockQuantityPayload }) =>
      increaseStockQuantityApi(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Stock increased successfully')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDecreaseStock() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: AdjustStockQuantityPayload }) =>
      decreaseStockQuantityApi(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      toast.success('Stock decreased successfully')
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
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
