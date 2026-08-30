import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateInventoryItemPayload,
  InventoryItemResponse,
  UpdateInventoryItemDetailsPayload,
} from './products.types'

const STORAGE_KEY = 'erjv_db_products_v6'

const INITIAL_PRODUCTS: InventoryItemResponse[] = []

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
    const response = await apiClient.get('/inventory-items')
    const list = extractArray<InventoryItemResponse>(response.data)
    if (Array.isArray(response.data) || list.length > 0) {
      saveStoredProducts(list)
      return list.filter((p) => p.isActive !== false)
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
