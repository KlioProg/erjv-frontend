import { apiClient, extractArray } from '@/lib/api-client'
import { serializeLineDiscount } from '@/lib/order-line-pricing'
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrderFilter,
  PurchaseOrderRecord,
  UpdatePurchaseOrderDraftPayload,
} from './purchase-orders.types'

export async function fetchPurchaseOrdersApi(
  filter?: PurchaseOrderFilter,
): Promise<PurchaseOrderRecord[]> {
  const response = await apiClient.get('/purchase-orders', { params: filter })
  return extractArray<PurchaseOrderRecord>(response.data)
}

export async function fetchPurchaseOrderByIdApi(id: number): Promise<PurchaseOrderRecord | null> {
  const { data } = await apiClient.get<PurchaseOrderRecord>(`/purchase-orders/${id}`)
  return data
}

export async function fetchPurchaseOrderByNumberApi(
  orderNumber: string,
): Promise<PurchaseOrderRecord | null> {
  const { data } = await apiClient.get<PurchaseOrderRecord>(
    `/purchase-orders/number/${encodeURIComponent(orderNumber.trim())}`,
  )
  return data
}

export async function createPurchaseOrderApi(
  payload: CreatePurchaseOrderPayload,
): Promise<PurchaseOrderRecord> {
  const cleanPayload = {
    ...(payload.supplierId != null ? { supplierId: payload.supplierId } : {}),
    ...(payload.expectedAt ? { expectedAt: new Date(payload.expectedAt).toISOString() } : {}),
    ...(payload.externalReference?.trim()
      ? { externalReference: payload.externalReference.trim() }
      : {}),
    ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
    items: payload.items.map((item) => ({
      inventoryItemId: item.inventoryItemId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
      ...serializeLineDiscount(item),
      ...(item.taxRate !== undefined && item.taxRate !== ''
        ? { taxRate: String(item.taxRate) }
        : {}),
      ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
    })),
  }

  const { data } = await apiClient.post<PurchaseOrderRecord>('/purchase-orders', cleanPayload)
  return data
}

export async function updatePurchaseOrderDraftApi(
  id: number,
  payload: UpdatePurchaseOrderDraftPayload,
): Promise<PurchaseOrderRecord> {
  const cleanPayload = {
    ...(payload.supplierId !== undefined ? { supplierId: payload.supplierId } : {}),
    ...(payload.expectedAt !== undefined
      ? { expectedAt: payload.expectedAt ? new Date(payload.expectedAt).toISOString() : null }
      : {}),
    ...(payload.externalReference !== undefined
      ? { externalReference: payload.externalReference?.trim() || null }
      : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes?.trim() || null } : {}),
    ...(payload.items
      ? {
          items: payload.items.map((item) => ({
            inventoryItemId: item.inventoryItemId,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
            ...serializeLineDiscount(item),
            ...(item.taxRate !== undefined ? { taxRate: String(item.taxRate) } : {}),
            ...(item.notes !== undefined ? { notes: item.notes } : {}),
          })),
        }
      : {}),
  }
  const { data } = await apiClient.patch<PurchaseOrderRecord>(
    `/purchase-orders/${id}/draft`,
    cleanPayload,
  )
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
