import { apiClient } from '@/lib/api-client'
import { fetchCursorList } from '@/lib/cursor-pagination'
import { parseStockCents } from './stock-display'
import type {
  CreateIncomingDeliveryPayload,
  CompleteIncomingDeliveryPayload,
  IncomingDeliveryFilter,
  IncomingDeliveryRecord,
} from './incoming-deliveries.types'

export async function fetchIncomingDeliveriesApi(
  filter?: IncomingDeliveryFilter,
  signal?: AbortSignal,
): Promise<IncomingDeliveryRecord[]> {
  return fetchCursorList<IncomingDeliveryRecord>('/incoming-deliveries', filter, signal)
}

export async function fetchIncomingDeliveryByIdApi(
  id: number,
): Promise<IncomingDeliveryRecord | null> {
  const { data } = await apiClient.get<IncomingDeliveryRecord>(`/incoming-deliveries/${id}`)
  return data
}

export async function fetchIncomingDeliveryByNumberApi(
  deliveryNumber: string,
): Promise<IncomingDeliveryRecord | null> {
  const { data } = await apiClient.get<IncomingDeliveryRecord>(
    `/incoming-deliveries/number/${encodeURIComponent(deliveryNumber.trim())}`,
  )
  return data
}

export async function createIncomingDeliveryApi(
  payload: CreateIncomingDeliveryPayload,
): Promise<IncomingDeliveryRecord> {
  const cleanPayload = {
    purchaseOrderId: payload.purchaseOrderId,
    warehouseId: payload.warehouseId,
    ...(payload.scheduledAt ? { scheduledAt: new Date(payload.scheduledAt).toISOString() } : {}),
    ...(payload.supplierReference?.trim()
      ? { supplierReference: payload.supplierReference.trim() }
      : {}),
    ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
  }

  const { data } = await apiClient.post<IncomingDeliveryRecord>(
    '/incoming-deliveries',
    cleanPayload,
  )
  return data
}

export async function scheduleIncomingDeliveryApi(id: number): Promise<IncomingDeliveryRecord> {
  const { data } = await apiClient.patch<IncomingDeliveryRecord>(
    `/incoming-deliveries/${id}/schedule`,
  )
  return data
}

export async function completeIncomingDeliveryApi(
  id: number,
  payload: CompleteIncomingDeliveryPayload,
): Promise<IncomingDeliveryRecord> {
  if (!Array.isArray(payload.items))
    throw new Error('Confirm the actual receipt before continuing.')
  const reason = payload.noReceiptReason?.trim()
  if ((payload.items.length === 0 && !reason) || (payload.items.length > 0 && reason))
    throw new Error('Enter receipt quantities, or record no receipt with a reason.')
  const seen = new Set<number>()
  const items = payload.items.map((item) => {
    const received = parseStockCents(item.receivedQuantity)
    const damaged = parseStockCents(item.damagedQuantity)
    if (
      typeof item.receivedQuantity !== 'string' ||
      typeof item.damagedQuantity !== 'string' ||
      received === null ||
      received <= 0n ||
      damaged === null ||
      damaged > received ||
      !Number.isSafeInteger(item.purchaseOrderItemId) ||
      item.purchaseOrderItemId <= 0 ||
      seen.has(item.purchaseOrderItemId)
    )
      throw new Error(
        'Check the received and damaged quantities. Each order line must appear once, and damage cannot exceed the quantity received.',
      )
    seen.add(item.purchaseOrderItemId)
    return {
      purchaseOrderItemId: item.purchaseOrderItemId,
      receivedQuantity: item.receivedQuantity.trim(),
      damagedQuantity: item.damagedQuantity.trim(),
    }
  })
  const { data } = await apiClient.patch<IncomingDeliveryRecord>(
    `/incoming-deliveries/${id}/complete`,
    { items, ...(reason ? { noReceiptReason: reason } : {}) },
  )
  return data
}

export async function cancelIncomingDeliveryApi(id: number): Promise<IncomingDeliveryRecord> {
  const { data } = await apiClient.patch<IncomingDeliveryRecord>(
    `/incoming-deliveries/${id}/cancel`,
  )
  return data
}
