import { apiClient, extractArray, type FetchParams } from '@/lib/api-client'
import type {
  CreateInventoryItemPayload,
  InventoryItemResponse,
  UpdateInventoryItemDetailsPayload,
} from './products.types'

export async function fetchProductsApi(params?: FetchParams): Promise<InventoryItemResponse[]> {
  const response = await apiClient.get('/inventory-items', { params })
  return extractArray<InventoryItemResponse>(response.data)
}

export async function fetchProductByIdApi(id: number): Promise<InventoryItemResponse> {
  const { data } = await apiClient.get<InventoryItemResponse>(`/inventory-items/${id}`)
  return data
}

export async function fetchProductByNameApi(name: string): Promise<InventoryItemResponse | null> {
  if (!name || !name.trim()) return null
  try {
    const { data } = await apiClient.get<InventoryItemResponse>(
      `/inventory-items/name/${encodeURIComponent(name.trim())}`,
    )
    if (data && typeof data === 'object' && 'id' in data && data.id) {
      return data
    }
    return null
  } catch {
    return null
  }
}

export async function createProductApi(
  payload: CreateInventoryItemPayload,
): Promise<InventoryItemResponse> {
  const cleanPayload = {
    name: payload.name.trim(),
    unit: payload.unit?.trim() || 'kg',
    unitPrice:
      typeof payload.unitPrice === 'number'
        ? payload.unitPrice.toFixed(2)
        : String(payload.unitPrice).trim(),
    ...(payload.variety?.trim() ? { variety: payload.variety.trim() } : {}),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : { isActive: true }),
  }

  const { data } = await apiClient.post<InventoryItemResponse>('/inventory-items', cleanPayload)
  return data
}

export async function updateProductDetailsApi(
  id: number,
  payload: UpdateInventoryItemDetailsPayload,
): Promise<InventoryItemResponse> {
  const cleanPayload = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.unit ? { unit: payload.unit.trim() } : {}),
    ...(payload.variety !== undefined ? { variety: payload.variety?.trim() || null } : {}),
    ...(payload.description !== undefined
      ? { description: payload.description?.trim() || null }
      : {}),
  }

  const { data } = await apiClient.patch<InventoryItemResponse>(
    `/inventory-items/${id}/details`,
    cleanPayload,
  )
  return data
}

export async function updateProductPriceApi(
  id: number,
  unitPrice: number | string,
): Promise<InventoryItemResponse> {
  const { data } = await apiClient.patch<InventoryItemResponse>(
    `/inventory-items/${id}/unit-price`,
    {
      unitPrice: typeof unitPrice === 'number' ? unitPrice.toFixed(2) : String(unitPrice).trim(),
    },
  )
  return data
}

export async function deactivateProductApi(id: number): Promise<InventoryItemResponse> {
  const { data } = await apiClient.delete<InventoryItemResponse>(`/inventory-items/${id}`)
  return data
}

export async function reactivateProductApi(id: number): Promise<InventoryItemResponse> {
  const { data } = await apiClient.patch<InventoryItemResponse>(`/inventory-items/${id}/reactivate`)
  return data
}
