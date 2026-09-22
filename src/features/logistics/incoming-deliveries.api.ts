import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateIncomingDeliveryPayload,
  IncomingDeliveryFilter,
  IncomingDeliveryRecord,
} from './incoming-deliveries.types'

export async function fetchIncomingDeliveriesApi(
  filter?: IncomingDeliveryFilter,
): Promise<IncomingDeliveryRecord[]> {
  const response = await apiClient.get('/incoming-deliveries', { params: filter })
  return extractArray<IncomingDeliveryRecord>(response.data)
}

export async function fetchIncomingDeliveryByIdApi(id: number): Promise<IncomingDeliveryRecord> {
  const { data } = await apiClient.get<IncomingDeliveryRecord>(`/incoming-deliveries/${id}`)
  return data
}

export async function fetchIncomingDeliveryByNumberApi(
  deliveryNumber: string,
): Promise<IncomingDeliveryRecord | null> {
  try {
    const { data } = await apiClient.get<IncomingDeliveryRecord>(
      `/incoming-deliveries/number/${encodeURIComponent(deliveryNumber.trim())}`,
    )
    return data
  } catch {
    return null
  }
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
    items: payload.items.map((item) => ({
      purchaseOrderItemId: item.purchaseOrderItemId,
      receivedQuantity: String(item.receivedQuantity),
    })),
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

export async function completeIncomingDeliveryApi(id: number): Promise<IncomingDeliveryRecord> {
  const { data } = await apiClient.patch<IncomingDeliveryRecord>(
    `/incoming-deliveries/${id}/complete`,
  )
  return data
}

export async function cancelIncomingDeliveryApi(id: number): Promise<IncomingDeliveryRecord> {
  const { data } = await apiClient.patch<IncomingDeliveryRecord>(
    `/incoming-deliveries/${id}/cancel`,
  )
  return data
}
