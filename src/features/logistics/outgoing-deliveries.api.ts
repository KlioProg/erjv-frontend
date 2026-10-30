import { fetchCursorList } from '@/lib/cursor-pagination'
import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateOutgoingDeliveryPayload,
  CreateOutgoingDeliveryDraftPayload,
  UpdateOutgoingDeliveryDraftPayload,
  OutgoingPlanningOption,
  OutgoingDeliveryFilter,
  OutgoingDeliveryRecord,
} from './outgoing-deliveries.types'

export async function fetchOutgoingDeliveriesApi(filter?: OutgoingDeliveryFilter, signal?: AbortSignal): Promise<OutgoingDeliveryRecord[]> {
  const { status, ...filters } = filter ?? {}
  return fetchCursorList<OutgoingDeliveryRecord>(
    '/outgoing-deliveries',
    { ...filters, ...(status && !filters.statuses ? { statuses: [status] } : {}) },
    signal,
  )
}

export async function fetchOutgoingDeliveryByIdApi(
  id: number,
): Promise<OutgoingDeliveryRecord | null> {
  const { data } = await apiClient.get<OutgoingDeliveryRecord>(`/outgoing-deliveries/${id}`)
  return data
}

export async function fetchOutgoingDeliveryByNumberApi(
  deliveryNumber: string,
): Promise<OutgoingDeliveryRecord | null> {
  const { data } = await apiClient.get<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/number/${encodeURIComponent(deliveryNumber.trim())}`,
  )
  return data
}

export async function createOutgoingDeliveryApi(
  payload: CreateOutgoingDeliveryPayload,
): Promise<OutgoingDeliveryRecord> {
  const cleanPayload: Record<string, unknown> = {
    salesOrderId: payload.salesOrderId,
    ...(payload.notes?.trim() ? { notes: payload.notes.trim() } : {}),
  }

  const { data } = await apiClient.post<OutgoingDeliveryRecord>(
    '/outgoing-deliveries',
    cleanPayload,
  )
  return data
}

export async function createOutgoingDeliveryDraftApi(
  payload: CreateOutgoingDeliveryDraftPayload,
): Promise<OutgoingDeliveryRecord> {
  return createOutgoingDeliveryApi(payload)
}

export async function updateOutgoingDeliveryDraftApi(
  id: number,
  payload: UpdateOutgoingDeliveryDraftPayload,
): Promise<OutgoingDeliveryRecord> {
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/draft`,
    payload,
  )
  return data
}

export async function fetchOutgoingPlanningOptionsApi(
  salesOrderId: number,
  warehouseId: number,
): Promise<OutgoingPlanningOption[]> {
  const { data } = await apiClient.get('/outgoing-deliveries/planning-options', {
    params: { salesOrderId, warehouseId },
  })
  return extractArray<OutgoingPlanningOption>(data)
}

export async function readyOutgoingDeliveryApi(
  id: number,
  expectedRevision: number,
): Promise<OutgoingDeliveryRecord> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    throw new Error('Refresh the saved delivery before marking it ready.')
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/ready`,
    { expectedRevision },
  )
  return data
}

export async function reopenOutgoingDeliveryApi(
  id: number,
  expectedRevision: number,
): Promise<OutgoingDeliveryRecord> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    throw new Error('Refresh the saved delivery before reopening it.')
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/reopen`,
    { expectedRevision },
  )
  return data
}

export async function cancelOutgoingDeliveryApi(
  id: number,
  expectedRevision: number,
): Promise<OutgoingDeliveryRecord> {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
    throw new Error('Refresh the saved delivery before cancelling it.')
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/cancel`,
    { expectedRevision },
  )
  return data
}
