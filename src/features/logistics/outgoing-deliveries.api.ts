import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateOutgoingDeliveryPayload,
  DispatchOutgoingDeliveryPayload,
  OutgoingDeliveryFilter,
  OutgoingDeliveryRecord,
} from './outgoing-deliveries.types'

export async function fetchOutgoingDeliveriesApi(
  filter?: OutgoingDeliveryFilter,
): Promise<OutgoingDeliveryRecord[]> {
  const response = await apiClient.get('/outgoing-deliveries', {
    params: filter,
  })
  return extractArray<OutgoingDeliveryRecord>(response.data)
}

export async function fetchOutgoingDeliveryByIdApi(id: number): Promise<OutgoingDeliveryRecord> {
  const { data } = await apiClient.get<OutgoingDeliveryRecord>(`/outgoing-deliveries/${id}`)
  return data
}

export async function fetchOutgoingDeliveryByNumberApi(
  deliveryNumber: string,
): Promise<OutgoingDeliveryRecord | null> {
  try {
    const { data } = await apiClient.get<OutgoingDeliveryRecord>(
      `/outgoing-deliveries/number/${encodeURIComponent(deliveryNumber.trim())}`,
    )
    return data
  } catch {
    return null
  }
}

export async function createOutgoingDeliveryApi(
  payload: CreateOutgoingDeliveryPayload,
): Promise<OutgoingDeliveryRecord> {
  const cleanPayload: Record<string, unknown> = {
    salesOrderId: payload.salesOrderId,
    warehouseId: payload.warehouseId,
    ...(payload.deliveryVehicleId ? { deliveryVehicleId: payload.deliveryVehicleId } : {}),
    ...(payload.driverEmployeeId ? { driverEmployeeId: payload.driverEmployeeId } : {}),
    ...(payload.scheduledAt ? { scheduledAt: new Date(payload.scheduledAt).toISOString() } : {}),
    ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
    items: payload.items.map((item) => ({
      salesOrderAllocationId: item.salesOrderAllocationId,
      quantity: String(item.quantity),
    })),
  }

  const { data } = await apiClient.post<OutgoingDeliveryRecord>(
    '/outgoing-deliveries',
    cleanPayload,
  )
  return data
}

export async function scheduleOutgoingDeliveryApi(id: number): Promise<OutgoingDeliveryRecord> {
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/schedule`,
  )
  return data
}

export async function dispatchOutgoingDeliveryApi(
  id: number,
  payload: DispatchOutgoingDeliveryPayload,
): Promise<OutgoingDeliveryRecord> {
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/dispatch`,
    {
      deliveryVehicleId: payload.deliveryVehicleId,
      driverEmployeeId: payload.driverEmployeeId,
    },
  )
  return data
}

export async function completeOutgoingDeliveryApi(id: number): Promise<OutgoingDeliveryRecord> {
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/complete`,
  )
  return data
}

export async function cancelOutgoingDeliveryApi(id: number): Promise<OutgoingDeliveryRecord> {
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/cancel`,
  )
  return data
}
