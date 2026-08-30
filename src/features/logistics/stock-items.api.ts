import { apiClient } from '@/lib/api-client'
import type {
  AdjustStockQuantityPayload,
  CreateStockItemPayload,
  SetStockQuantityPayload,
  StockItem,
  StockItemWithRelations,
} from './stock-items.types'

const STORAGE_KEY = 'erjv_db_stock_items_v5'

const INITIAL_STOCK_ITEMS: StockItemWithRelations[] = [
  {
    id: 1,
    quantity: '350.00',
    inventoryItemId: 1,
    warehouseId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inventoryItem: {
      id: 1,
      name: 'Kohaku Red Premium Rice (50kg Sack)',
      sku: 'RICE-KOH-RED-50KG',
      unitPrice: 1350.0,
    },
    warehouse: {
      id: 1,
      name: 'Central Logistics & Distribution Complex',
      address: 'Lanang Logistics Industrial Park, Davao City',
    },
  },
  {
    id: 2,
    quantity: '220.00',
    inventoryItemId: 2,
    warehouseId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inventoryItem: {
      id: 2,
      name: 'Premium Palm Cooking Oil (20L Carboy)',
      sku: 'OIL-PALM-20L-CARB',
      unitPrice: 1150.0,
    },
    warehouse: {
      id: 1,
      name: 'Central Logistics & Distribution Complex',
      address: 'Lanang Logistics Industrial Park, Davao City',
    },
  },
  {
    id: 3,
    quantity: '180.00',
    inventoryItemId: 3,
    warehouseId: 4,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inventoryItem: {
      id: 3,
      name: 'Refined Pure Coconut Cooking Oil (17kg Tin)',
      sku: 'OIL-COC-17KG-TIN',
      unitPrice: 1280.0,
    },
    warehouse: {
      id: 4,
      name: 'Matina Dry & Liquid Storage Facility',
      address: 'McArthur Highway, Matina Enclaves, Davao City',
    },
  },
  {
    id: 4,
    quantity: '290.00',
    inventoryItemId: 6,
    warehouseId: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inventoryItem: {
      id: 6,
      name: 'Premium Refined White Sugar (50kg Sack)',
      sku: 'SUG-REF-WHT-50KG',
      unitPrice: 3450.0,
    },
    warehouse: {
      id: 1,
      name: 'Central Logistics & Distribution Complex',
      address: 'Lanang Logistics Industrial Park, Davao City',
    },
  },
  {
    id: 5,
    quantity: '400.00',
    inventoryItemId: 7,
    warehouseId: 3,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    inventoryItem: {
      id: 7,
      name: 'First Class Hard Wheat Bakery Flour (25kg Bag)',
      sku: 'FLR-HRD-WHT-25KG',
      unitPrice: 980.0,
    },
    warehouse: {
      id: 3,
      name: 'Toril Wholesale Distribution Hub',
      address: 'Crossing Bayabas, Toril District, Davao City',
    },
  },
]

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
  const newId = current.length > 0 ? Math.max(...current.map((s) => s.id)) + 1 : 1
  const newStock: StockItemWithRelations = {
    id: newId,
    inventoryItemId: cleanPayload.inventoryItemId,
    warehouseId: cleanPayload.warehouseId,
    quantity: cleanPayload.quantity,
    inventoryItem: {
      id: cleanPayload.inventoryItemId,
      name: `Product SKU #${cleanPayload.inventoryItemId}`,
    },
    warehouse: {
      id: cleanPayload.warehouseId,
      name: `Warehouse #${cleanPayload.warehouseId}`,
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
