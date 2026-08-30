import { apiClient, extractArray } from '@/lib/api-client'
import type {
  AdjustStockQuantityPayload,
  CreateStockItemPayload,
  SetStockQuantityPayload,
  StockItem,
  StockItemWithRelations,
} from './stock-items.types'

export async function fetchStockItemsApi(): Promise<StockItemWithRelations[]> {
  const response = await apiClient.get('/stock-items')
  return extractArray<StockItemWithRelations>(response.data)
}

export async function fetchStockByWarehouseApi(
  warehouseId: number
): Promise<StockItemWithRelations[]> {
  const { data } = await apiClient.get<StockItemWithRelations[]>(
    `/stock-items/warehouses/${warehouseId}`
  )
  return extractArray<StockItemWithRelations>(data)
}

export async function fetchStockByItemApi(
  inventoryItemId: number
): Promise<StockItemWithRelations[]> {
  const { data } = await apiClient.get<StockItemWithRelations[]>(
    `/stock-items/inventory-items/${inventoryItemId}`
  )
  return extractArray<StockItemWithRelations>(data)
}

export async function createStockItemApi(
  payload: CreateStockItemPayload
): Promise<StockItemWithRelations> {
  const cleanPayload = {
    inventoryItemId: Number(payload.inventoryItemId),
    warehouseId: Number(payload.warehouseId),
    quantity: payload.quantity ? parseFloat(payload.quantity).toFixed(2) : '0.00',
  }

  const { data } = await apiClient.post<StockItemWithRelations>('/stock-items', cleanPayload)
  return data
}

export async function setStockQuantityApi(
  id: number,
  payload: SetStockQuantityPayload
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/quantity`, {
    quantity: parseFloat(payload.quantity).toFixed(2),
  })
  return data
}

export async function increaseStockQuantityApi(
  id: number,
  payload: AdjustStockQuantityPayload
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(
    `/stock-items/${id}/quantity/increase`,
    {
      amount: parseFloat(payload.amount).toFixed(2),
    }
  )
  return data
}

export async function decreaseStockQuantityApi(
  id: number,
  payload: AdjustStockQuantityPayload
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(
    `/stock-items/${id}/quantity/decrease`,
    {
      amount: parseFloat(payload.amount).toFixed(2),
    }
  )
  return data
}

export async function deleteStockItemApi(id: number): Promise<void> {
  await apiClient.delete(`/stock-items/${id}`)
}
