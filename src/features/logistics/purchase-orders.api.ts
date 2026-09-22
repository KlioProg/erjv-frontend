import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrderFilter,
  PurchaseOrderRecord,
} from './purchase-orders.types'

export async function fetchPurchaseOrdersApi(
  filter?: PurchaseOrderFilter,
): Promise<PurchaseOrderRecord[]> {
  const response = await apiClient.get('/purchase-orders', { params: filter })
  return extractArray<PurchaseOrderRecord>(response.data)
}

export async function fetchPurchaseOrderByIdApi(id: number): Promise<PurchaseOrderRecord> {
  const { data } = await apiClient.get<PurchaseOrderRecord>(`/purchase-orders/${id}`)
  return data
}

export async function fetchPurchaseOrderByNumberApi(
  orderNumber: string,
): Promise<PurchaseOrderRecord | null> {
  try {
    const { data } = await apiClient.get<PurchaseOrderRecord>(
      `/purchase-orders/number/${encodeURIComponent(orderNumber.trim())}`,
    )
    return data
  } catch {
    return null
  }
}

export async function createPurchaseOrderApi(
  payload: CreatePurchaseOrderPayload,
): Promise<PurchaseOrderRecord> {
  const cleanPayload = {
    supplierId: payload.supplierId,
    ...(payload.expectedAt ? { expectedAt: new Date(payload.expectedAt).toISOString() } : {}),
    ...(payload.externalReference?.trim()
      ? { externalReference: payload.externalReference.trim() }
      : {}),
    ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
    items: payload.items.map((item) => ({
      inventoryItemId: item.inventoryItemId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      ...(item.discountRate !== undefined && item.discountRate !== ''
        ? { discountRate: String(item.discountRate) }
        : {}),
      ...(item.taxRate !== undefined && item.taxRate !== ''
        ? { taxRate: String(item.taxRate) }
        : {}),
      ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
    })),
  }

  const { data } = await apiClient.post<PurchaseOrderRecord>('/purchase-orders', cleanPayload)
  return data
}

export async function confirmPurchaseOrderApi(id: number): Promise<PurchaseOrderRecord> {
  const { data } = await apiClient.patch<PurchaseOrderRecord>(`/purchase-orders/${id}/confirm`)
  return data
}

export async function cancelPurchaseOrderApi(id: number): Promise<PurchaseOrderRecord> {
  const { data } = await apiClient.patch<PurchaseOrderRecord>(`/purchase-orders/${id}/cancel`)
  return data
}
