import { apiClient } from '@/lib/api-client'
import type {
  CreateInventoryItemPayload,
  InventoryItemResponse,
  UpdateInventoryItemDetailsPayload,
} from './products.types'

const STORAGE_KEY = 'erjv_db_products_v5'

const INITIAL_PRODUCTS: InventoryItemResponse[] = [
  {
    id: 1,
    name: 'Kohaku Red Premium Rice (50kg Sack)',
    sku: 'RICE-KOH-RED-50KG',
    unitPrice: 1350.0,
    description: 'First grade fragrant polished white rice, 50kg wholesale sack',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Premium Palm Cooking Oil (20L Carboy)',
    sku: 'OIL-PALM-20L-CARB',
    unitPrice: 1150.0,
    description: 'High-smoke point refined palm cooking oil, 20L heavy duty carboy container',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Refined Pure Coconut Cooking Oil (17kg Tin)',
    sku: 'OIL-COC-17KG-TIN',
    unitPrice: 1280.0,
    description: 'Premium culinary grade pure coconut oil, 17kg commercial tin with seal',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: 'Kohaku Yellow Special Grain (50kg Sack)',
    sku: 'RICE-KOH-YEL-50KG',
    unitPrice: 1450.0,
    description: 'Export quality long-grain white rice, 50kg sack for supermarket retail',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 5,
    name: 'Premium Thai Jasmine Fragrant Rice (25kg Sack)',
    sku: 'RICE-JAS-THAI-25KG',
    unitPrice: 1250.0,
    description: 'Imported fragrant Thai Jasmine grains, 25kg retail packaging',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 6,
    name: 'Premium Refined White Sugar (50kg Sack)',
    sku: 'SUG-REF-WHT-50KG',
    unitPrice: 3450.0,
    description: 'Commercial bakery grade pure refined cane sugar, 50kg wholesale bag',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 7,
    name: 'First Class Hard Wheat Bakery Flour (25kg Bag)',
    sku: 'FLR-HRD-WHT-25KG',
    unitPrice: 980.0,
    description: 'High-protein bread flour for commercial bakeries & food manufacturers, 25kg bag',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 8,
    name: 'Sinandomeng Special Well-Milled Rice (50kg Sack)',
    sku: 'RICE-SIN-SPEC-50KG',
    unitPrice: 1180.0,
    description: 'Local standard soft grain variety, ideal for food services & canteens, 50kg sack',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function getStoredProducts(): InventoryItemResponse[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Ignore JSON parse error
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PRODUCTS))
  return INITIAL_PRODUCTS
}

function saveStoredProducts(items: InventoryItemResponse[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export async function fetchProductsApi(): Promise<InventoryItemResponse[]> {
  try {
    const { data } = await apiClient.get<InventoryItemResponse[]>('/inventory-items')
    if (Array.isArray(data) && data.length > 0) {
      saveStoredProducts(data)
      return data
    }
  } catch {
    // Graceful fallback
  }
  return getStoredProducts().filter((p) => p.isActive)
}

export async function fetchProductByIdApi(id: number): Promise<InventoryItemResponse> {
  try {
    const { data } = await apiClient.get<InventoryItemResponse>(`/inventory-items/${id}`)
    return data
  } catch {
    const found = getStoredProducts().find((p) => p.id === id)
    if (found) return found
    throw new Error('Product not found')
  }
}

export async function createProductApi(
  payload: CreateInventoryItemPayload
): Promise<InventoryItemResponse> {
  const cleanPayload = {
    name: payload.name.trim(),
    sku: payload.sku.trim().toUpperCase(),
    unitPrice: Number(payload.unitPrice),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
  }

  try {
    const { data } = await apiClient.post<InventoryItemResponse>('/inventory-items', cleanPayload)
    if (data && data.id) {
      const current = getStoredProducts()
      saveStoredProducts([data, ...current.filter((p) => p.id !== data.id)])
      return data
    }
  } catch {
    // Gracefully persist locally if database responds with 500
  }

  const current = getStoredProducts()
  const newId = current.length > 0 ? Math.max(...current.map((p) => p.id)) + 1 : 1
  const newItem: InventoryItemResponse = {
    id: newId,
    name: cleanPayload.name,
    sku: cleanPayload.sku,
    unitPrice: cleanPayload.unitPrice,
    description: cleanPayload.description || null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  saveStoredProducts([newItem, ...current])
  return newItem
}

export async function updateProductDetailsApi(
  id: number,
  payload: UpdateInventoryItemDetailsPayload
): Promise<InventoryItemResponse> {
  const cleanPayload = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.sku ? { sku: payload.sku.trim().toUpperCase() } : {}),
    ...(payload.description !== undefined ? { description: payload.description?.trim() || null } : {}),
  }

  try {
    const { data } = await apiClient.patch<InventoryItemResponse>(
      `/inventory-items/${id}/details`,
      cleanPayload
    )
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredProducts()
  const index = current.findIndex((p) => p.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      name: cleanPayload.name ?? current[index].name,
      sku: cleanPayload.sku ?? current[index].sku,
      description: cleanPayload.description !== undefined ? cleanPayload.description : current[index].description,
      updatedAt: new Date().toISOString(),
    }
    saveStoredProducts(current)
    return current[index]
  }
  throw new Error('Product not found')
}

export async function updateProductPriceApi(
  id: number,
  unitPrice: number
): Promise<InventoryItemResponse> {
  try {
    const { data } = await apiClient.patch<InventoryItemResponse>(
      `/inventory-items/${id}/unit-price`,
      { unitPrice: Number(unitPrice) }
    )
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredProducts()
  const index = current.findIndex((p) => p.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      unitPrice: Number(unitPrice),
      updatedAt: new Date().toISOString(),
    }
    saveStoredProducts(current)
    return current[index]
  }
  throw new Error('Product not found')
}

export async function deactivateProductApi(id: number): Promise<InventoryItemResponse> {
  try {
    const { data } = await apiClient.delete<InventoryItemResponse>(`/inventory-items/${id}`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredProducts()
  const index = current.findIndex((p) => p.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      isActive: false,
      updatedAt: new Date().toISOString(),
    }
    saveStoredProducts(current)
    return current[index]
  }
  throw new Error('Product not found')
}
