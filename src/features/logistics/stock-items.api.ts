import { apiClient, extractArray } from '@/lib/api-client'
import type {
  AdjustStockQuantityPayload,
  CreateStockItemPayload,
  SetStockQuantityPayload,
  StockItem,
  StockItemWithRelations,
} from './stock-items.types'

const STORAGE_KEY = 'erjv_db_stock_items_v6'

const INITIAL_STOCK_ITEMS: StockItemWithRelations[] = []

function getStoredStock(): StockItemWithRelations[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Ignore JSON error
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STOCK_ITEMS))
  return INITIAL_STOCK_ITEMS
}

function saveStoredStock(items: StockItemWithRelations[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export async function fetchStockItemsApi(): Promise<StockItemWithRelations[]> {
  try {
    const response = await apiClient.get('/stock-items')
    const list = extractArray<StockItemWithRelations>(response.data)
    if (Array.isArray(response.data) || list.length > 0) {
      saveStoredStock(list)
      return list
    }
  } catch {
    // Graceful fallback
  }
  return getStoredStock()
}

export async function fetchStockByWarehouseApi(
  warehouseId: number
): Promise<StockItemWithRelations[]> {
  try {
    const { data } = await apiClient.get<StockItemWithRelations[]>(
      `/stock-items/warehouses/${warehouseId}`
    )
    if (Array.isArray(data) && data.length > 0) return data
  } catch {
    // Graceful fallback
  }
  return getStoredStock().filter((s) => s.warehouseId === warehouseId)
}

export async function fetchStockByItemApi(
  inventoryItemId: number
): Promise<StockItemWithRelations[]> {
  try {
    const { data } = await apiClient.get<StockItemWithRelations[]>(
      `/stock-items/inventory-items/${inventoryItemId}`
    )
    if (Array.isArray(data) && data.length > 0) return data
  } catch {
    // Graceful fallback
  }
  return getStoredStock().filter((s) => s.inventoryItemId === inventoryItemId)
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
  if (data && data.id) {
    const current = getStoredStock()
    saveStoredStock([data, ...current.filter((s) => s.id !== data.id)])
    return data
  }
  throw new Error('Failed to create stock item in database')
}

export async function setStockQuantityApi(
  id: number,
  payload: SetStockQuantityPayload
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/quantity`, {
    quantity: parseFloat(payload.quantity).toFixed(2),
  })
  if (data && data.id) {
    const current = getStoredStock()
    saveStoredStock(current.map((s) => (s.id === id ? { ...s, quantity: data.quantity } : s)))
    return data
  }
  throw new Error('Failed to update stock quantity in database')
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
  if (data && data.id) {
    const current = getStoredStock()
    saveStoredStock(current.map((s) => (s.id === id ? { ...s, quantity: data.quantity } : s)))
    return data
  }
  throw new Error('Failed to increase stock quantity in database')
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
  if (data && data.id) {
    const current = getStoredStock()
    saveStoredStock(current.map((s) => (s.id === id ? { ...s, quantity: data.quantity } : s)))
    return data
  }
  throw new Error('Failed to decrease stock quantity in database')
}

export async function deleteStockItemApi(id: number): Promise<void> {
  try {
    await apiClient.delete(`/stock-items/${id}`)
  } catch {
    // Graceful fallback
  }

  const current = getStoredStock()
  const remaining = current.filter((s) => s.id !== id)
  saveStoredStock(remaining)
}
