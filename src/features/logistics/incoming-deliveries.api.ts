import { fetchCursorList } from '@/lib/cursor-pagination'
import { apiClient } from '@/lib/api-client'
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
  if (!Array.isArray(payload?.items) || (!payload.items.length && !payload.noReceiptReason?.trim()))
    throw new Error('Receipt items or an explicit no-receipt reason are required.')
  const { data } = await apiClient.patch<IncomingDeliveryRecord>(
    `/incoming-deliveries/${id}/complete`,
    payload,
  )
  return data
}

export async function cancelIncomingDeliveryApi(id: number): Promise<IncomingDeliveryRecord> {
  const { data } = await apiClient.patch<IncomingDeliveryRecord>(
    `/incoming-deliveries/${id}/cancel`,
  )
  return data
}
