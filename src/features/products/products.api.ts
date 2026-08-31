import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateInventoryItemPayload,
  InventoryItemResponse,
  UpdateInventoryItemDetailsPayload,
} from './products.types'

function normalizeProductItem(raw: unknown): InventoryItemResponse {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const id = Number(item.id) || 0
  const unitPrice = Number(item.unitPrice) || 0
  const name = String(item.name || '')
  return {
    id,
    name,
    sku: String(item.sku || `SKU-${name.replace(/\s+/g, '-').toUpperCase().slice(0, 8) || 'ITEM'}-${id}`),
    variety: item.variety ? String(item.variety) : null,
    unit: String(item.unit || 'kg'),
    unitPrice,
    description: item.description ? String(item.description) : null,
    isActive: item.isActive !== false,
    createdAt: String(item.createdAt || new Date().toISOString()),
    updatedAt: String(item.updatedAt || new Date().toISOString()),
  }
}

export async function fetchProductsApi(): Promise<InventoryItemResponse[]> {
  const response = await apiClient.get('/inventory-items')
  const rawList = extractArray(response.data)
  return rawList.map(normalizeProductItem)
}

export async function fetchProductByIdApi(id: number): Promise<InventoryItemResponse> {
  const { data } = await apiClient.get<InventoryItemResponse>(`/inventory-items/${id}`)
  return normalizeProductItem(data)
}

export async function fetchProductByNameApi(name: string): Promise<InventoryItemResponse | null> {
  try {
    const { data } = await apiClient.get<InventoryItemResponse>(`/inventory-items/name/${encodeURIComponent(name.trim())}`)
    return normalizeProductItem(data)
  } catch {
    return null
  }
}

export async function createProductApi(
  payload: CreateInventoryItemPayload
): Promise<InventoryItemResponse> {
  const numPrice = Number(payload.unitPrice) || 0
  const cleanPayload = {
    name: payload.name.trim(),
    unit: payload.unit?.trim() || 'kg',
    unitPrice: numPrice.toFixed(2),
    ...(payload.variety?.trim() ? { variety: payload.variety.trim() } : {}),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    isActive: true,
  }

  const { data } = await apiClient.post<InventoryItemResponse>('/inventory-items', cleanPayload)
  return normalizeProductItem(data)
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
  return normalizeProductItem(data)
}

export async function updateProductPriceApi(
  id: number,
  unitPrice: number
): Promise<InventoryItemResponse> {
  const { data } = await apiClient.patch<InventoryItemResponse>(
    `/inventory-items/${id}/unit-price`,
    { unitPrice: Number(unitPrice).toFixed(2) }
  )
  return normalizeProductItem(data)
}

export async function deactivateProductApi(id: number): Promise<InventoryItemResponse> {
  const { data } = await apiClient.delete<InventoryItemResponse>(`/inventory-items/${id}`)
  return normalizeProductItem(data)
}

export async function reactivateProductApi(id: number): Promise<InventoryItemResponse> {
  const { data } = await apiClient.patch<InventoryItemResponse>(`/inventory-items/${id}/reactivate`)
  return normalizeProductItem(data)
}
