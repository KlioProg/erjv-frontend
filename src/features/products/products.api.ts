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
  const numPrice = Number(payload.unitPrice) || 0
  const cleanPayload = {
    name: payload.name.trim(),
    unit: (payload.unit?.trim() || 'kg'),
    unitPrice: numPrice.toFixed(2),
    ...(payload.variety?.trim() ? { variety: payload.variety.trim() } : {}),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    isActive: true,
  }

  const { data } = await apiClient.post<InventoryItemResponse>('/inventory-items', cleanPayload)
  if (data && data.id) {
    const current = getStoredProducts()
    saveStoredProducts([data, ...current.filter((p) => p.id !== data.id)])
    return data
  }
  throw new Error('Failed to create product in database')
}

export async function updateProductDetailsApi(
  id: number,
  payload: UpdateInventoryItemDetailsPayload
): Promise<InventoryItemResponse> {
  const cleanPayload = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.unit ? { unit: payload.unit.trim() } : {}),
    ...(payload.variety !== undefined ? { variety: payload.variety?.trim() || null } : {}),
    ...(payload.description !== undefined ? { description: payload.description?.trim() || null } : {}),
  }

  const { data } = await apiClient.patch<InventoryItemResponse>(
    `/inventory-items/${id}/details`,
    cleanPayload
  )
  if (data && data.id) {
    const current = getStoredProducts()
    saveStoredProducts(current.map((p) => (p.id === id ? data : p)))
    return data
  }
  throw new Error('Failed to update product in database')
}

export async function updateProductPriceApi(
  id: number,
  unitPrice: number
): Promise<InventoryItemResponse> {
  const { data } = await apiClient.patch<InventoryItemResponse>(
    `/inventory-items/${id}/unit-price`,
    { unitPrice: Number(unitPrice).toFixed(2) }
  )
  if (data && data.id) {
    const current = getStoredProducts()
    saveStoredProducts(current.map((p) => (p.id === id ? data : p)))
    return data
  }
  throw new Error('Failed to update product price in database')
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
