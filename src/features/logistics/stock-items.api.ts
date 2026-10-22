import { apiClient, extractArray, type FetchParams } from '@/lib/api-client'
import type {
  AdjustStockQuantityPayload,
  CreateStockItemPayload,
  SetReorderThresholdPayload,
  SetStockQuantityPayload,
  StockItem,
  StockItemWithInventoryItem,
  StockItemWithRelations,
  StockItemWithWarehouse,
} from './stock-items.types'

export async function fetchStockItemsApi(params?: FetchParams): Promise<StockItemWithRelations[]> {
  const response = await apiClient.get('/stock-items', { params })
  return extractArray<StockItemWithRelations>(response.data)
}

export async function fetchStockByWarehouseApi(
  warehouseId: number,
): Promise<StockItemWithInventoryItem[]> {
  const { data } = await apiClient.get<StockItemWithInventoryItem[]>(
    `/stock-items/warehouses/${warehouseId}`,
  )
  return extractArray<StockItemWithInventoryItem>(data)
}

export async function fetchStockByItemApi(
  inventoryItemId: number,
): Promise<StockItemWithWarehouse[]> {
  const { data } = await apiClient.get<StockItemWithWarehouse[]>(
    `/stock-items/inventory-items/${inventoryItemId}`,
  )
  return extractArray<StockItemWithWarehouse>(data)
}

export async function fetchStockItemByPairApi(
  inventoryItemId: number,
  warehouseId: number,
): Promise<StockItem | null> {
  const { data } = await apiClient.get<StockItem>(
    `/stock-items/pair/${inventoryItemId}/${warehouseId}`,
  )
  if (!data || typeof data !== 'object' || !('id' in data)) {
    return null
  }
  return data
}

export async function fetchStockItemByIdApi(id: number): Promise<StockItem | null> {
  const { data } = await apiClient.get<StockItem>(`/stock-items/${id}`)
  if (!data || typeof data !== 'object' || !('id' in data)) {
    return null
  }
  return data
}

export async function createStockItemApi(payload: CreateStockItemPayload): Promise<StockItem> {
  const cleanPayload = {
    inventoryItemId: Number(payload.inventoryItemId),
    warehouseId: Number(payload.warehouseId),
    quantity: payload.quantity ? parseFloat(payload.quantity).toFixed(2) : '0.00',
  }

  const { data } = await apiClient.post<StockItem>('/stock-items', cleanPayload)
  return data
}

export async function setStockQuantityApi(
  id: number,
  payload: SetStockQuantityPayload,
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/quantity`, {
    quantity: parseFloat(payload.quantity).toFixed(2),
  })
  return data
}

export async function setReorderThresholdApi(
  id: number,
  payload: SetReorderThresholdPayload,
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/reorder-threshold`, {
    reorderThreshold:
      payload.reorderThreshold === null ? null : parseFloat(payload.reorderThreshold).toFixed(2),
  })
  return data
}

export async function increaseStockQuantityApi(
  id: number,
  payload: AdjustStockQuantityPayload,
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/quantity/increase`, {
    amount: parseFloat(payload.amount).toFixed(2),
  })
  return data
}

export async function decreaseStockQuantityApi(
  id: number,
  payload: AdjustStockQuantityPayload,
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/quantity/decrease`, {
    amount: parseFloat(payload.amount).toFixed(2),
  })
  return data
}

export async function deleteStockItemApi(id: number): Promise<void> {
  await apiClient.delete(`/stock-items/${id}`)
}
