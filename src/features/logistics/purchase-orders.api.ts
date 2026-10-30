import { fetchCursorList } from '@/lib/cursor-pagination'
import { apiClient, requireRevision } from '@/lib/api-client'
import { serializeLineDiscount } from '@/lib/order-line-pricing'
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrderFilter,
  PurchaseOrderRecord,
  UpdatePurchaseOrderDraftPayload,
} from './purchase-orders.types'

export async function fetchPurchaseOrdersApi(filter?: PurchaseOrderFilter, signal?: AbortSignal): Promise<PurchaseOrderRecord[]> {
  const { status, ...filters } = filter ?? {}
  return fetchCursorList<PurchaseOrderRecord>('/purchase-orders', { ...filters, ...(status ? { statuses: [status] } : {}) }, signal)
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
  if (!Number.isInteger(payload.expectedRevision) || payload.expectedRevision < 1)
    throw new Error('A valid saved revision is required. Reload this draft.')
  const cleanPayload = {
    expectedRevision: payload.expectedRevision,
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
            ...(item.notes !== undefined ? { notes: item.notes?.trim() || null } : {}),
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

export async function confirmPurchaseOrderApi(id: number, expectedRevision: number): Promise<PurchaseOrderRecord> {
  const { data } = await apiClient.patch<PurchaseOrderRecord>(`/purchase-orders/${id}/confirm`, { expectedRevision: requireRevision(expectedRevision) })
  return data
}

export async function cancelPurchaseOrderApi(id: number, expectedRevision: number): Promise<PurchaseOrderRecord> {
  const { data } = await apiClient.patch<PurchaseOrderRecord>(`/purchase-orders/${id}/cancel`, { expectedRevision: requireRevision(expectedRevision) })
  return data
}
