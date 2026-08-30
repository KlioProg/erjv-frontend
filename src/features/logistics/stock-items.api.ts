import { apiClient } from '@/lib/api-client'
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
    const { data } = await apiClient.get<StockItemWithRelations[]>('/stock-items')
    if (Array.isArray(data) && data.length > 0) {
      saveStoredStock(data)
      return data
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

  try {
    const { data } = await apiClient.post<StockItemWithRelations>('/stock-items', cleanPayload)
    if (data && data.id) {
      const current = getStoredStock()
      saveStoredStock([data, ...current.filter((s) => s.id !== data.id)])
      return data
    }
  } catch {
    // Graceful fallback
  }

  const current = getStoredStock()
  const existingIdx = current.findIndex(
    (s) => s.inventoryItemId === cleanPayload.inventoryItemId && s.warehouseId === cleanPayload.warehouseId
  )

  // Lookup real warehouse info
  let whName = `Warehouse #${cleanPayload.warehouseId}`
  let whAddress = ''
  try {
    const rawWh = localStorage.getItem('erjv_db_warehouses_v6')
    if (rawWh) {
      const whList: Array<{ id: number; name: string; address?: string }> = JSON.parse(rawWh)
      const foundWh = whList.find((w) => w.id === cleanPayload.warehouseId)
      if (foundWh) {
        whName = foundWh.name
        whAddress = foundWh.address || ''
      }
    }
  } catch {
    // Ignore
  }

  // Lookup real product info
  let prodName = `Product SKU #${cleanPayload.inventoryItemId}`
  let prodSku = ''
  try {
    const rawProd = localStorage.getItem('erjv_db_products_v6')
    if (rawProd) {
      const prodList: Array<{ id: number; name: string; sku?: string }> = JSON.parse(rawProd)
      const foundProd = prodList.find((p) => p.id === cleanPayload.inventoryItemId)
      if (foundProd) {
        prodName = foundProd.name
        prodSku = foundProd.sku || ''
      }
    }
  } catch {
    // Ignore
  }

  if (existingIdx !== -1) {
    current[existingIdx] = {
      ...current[existingIdx],
      quantity: cleanPayload.quantity,
      warehouse: {
        id: cleanPayload.warehouseId,
        name: whName,
        address: whAddress,
      },
      inventoryItem: {
        id: cleanPayload.inventoryItemId,
        name: prodName,
        sku: prodSku || current[existingIdx].inventoryItem?.sku,
      },
      updatedAt: new Date().toISOString(),
    }
    saveStoredStock(current)
    return current[existingIdx]
  }

  const newId = current.length > 0 ? Math.max(...current.map((s) => s.id)) + 1 : 1
  const newStock: StockItemWithRelations = {
    id: newId,
    inventoryItemId: cleanPayload.inventoryItemId,
    warehouseId: cleanPayload.warehouseId,
    quantity: cleanPayload.quantity,
    inventoryItem: {
      id: cleanPayload.inventoryItemId,
      name: prodName,
      sku: prodSku,
    },
    warehouse: {
      id: cleanPayload.warehouseId,
      name: whName,
      address: whAddress,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  saveStoredStock([newStock, ...current])
  return newStock
}

export async function setStockQuantityApi(
  id: number,
  payload: SetStockQuantityPayload
): Promise<StockItem> {
  try {
    const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/quantity`, {
      quantity: parseFloat(payload.quantity).toFixed(2),
    })
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredStock()
  const index = current.findIndex((s) => s.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      quantity: parseFloat(payload.quantity).toFixed(2),
      updatedAt: new Date().toISOString(),
    }
    saveStoredStock(current)
    return current[index]
  }
  throw new Error('Stock item not found')
}

export async function increaseStockQuantityApi(
  id: number,
  payload: AdjustStockQuantityPayload
): Promise<StockItem> {
  try {
    const { data } = await apiClient.patch<StockItem>(
      `/stock-items/${id}/quantity/increase`,
      {
        amount: parseFloat(payload.amount).toFixed(2),
      }
    )
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredStock()
  const index = current.findIndex((s) => s.id === id)
  if (index !== -1) {
    const prev = parseFloat(current[index].quantity)
    const next = prev + parseFloat(payload.amount)
    current[index] = {
      ...current[index],
      quantity: next.toFixed(2),
      updatedAt: new Date().toISOString(),
    }
    saveStoredStock(current)
    return current[index]
  }
  throw new Error('Stock item not found')
}

export async function decreaseStockQuantityApi(
  id: number,
  payload: AdjustStockQuantityPayload
): Promise<StockItem> {
  try {
    const { data } = await apiClient.patch<StockItem>(
      `/stock-items/${id}/quantity/decrease`,
      {
        amount: parseFloat(payload.amount).toFixed(2),
      }
    )
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredStock()
  const index = current.findIndex((s) => s.id === id)
  if (index !== -1) {
    const prev = parseFloat(current[index].quantity)
    const next = Math.max(0, prev - parseFloat(payload.amount))
    current[index] = {
      ...current[index],
      quantity: next.toFixed(2),
      updatedAt: new Date().toISOString(),
    }
    saveStoredStock(current)
    return current[index]
  }
  throw new Error('Stock item not found')
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
