import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateInventoryItemPayload,
  InventoryItemResponse,
  UpdateInventoryItemDetailsPayload,
} from './products.types'

export async function fetchProductsApi(): Promise<InventoryItemResponse[]> {
  const response = await apiClient.get('/inventory-items')
  return extractArray<InventoryItemResponse>(response.data)
}

export async function fetchProductByIdApi(id: number): Promise<InventoryItemResponse> {
  const { data } = await apiClient.get<InventoryItemResponse>(`/inventory-items/${id}`)
  return data
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
  return data
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
  return data
}

export async function updateProductPriceApi(
  id: number,
  unitPrice: number
): Promise<InventoryItemResponse> {
  const { data } = await apiClient.patch<InventoryItemResponse>(
    `/inventory-items/${id}/unit-price`,
    { unitPrice: Number(unitPrice).toFixed(2) }
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
