import { apiClient, extractArray } from '@/lib/api-client'
import { parseStockCents } from './stock-display'
import type {
  CreateOutgoingDeliveryPayload,
  CompleteOutgoingDeliveryPayload,
  CreateOutgoingDeliveryDraftPayload,
  UpdateOutgoingDeliveryDraftPayload,
  OutgoingPlanningOption,
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
    ...(payload.scheduledAt ? { scheduledAt: new Date(payload.scheduledAt).toISOString() } : {}),
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

export async function scheduleOutgoingDeliveryApi(
  id: number,
  expectedRevision: number,
): Promise<OutgoingDeliveryRecord> {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 1)
    throw new Error('Refresh the saved delivery draft before scheduling it.')
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/schedule`,
    { expectedRevision },
  )
  return data
}

export async function dispatchOutgoingDeliveryApi(
  id: number,
  payload: DispatchOutgoingDeliveryPayload,
): Promise<OutgoingDeliveryRecord> {
  if (!Array.isArray(payload.items) || payload.items.length === 0)
    throw new Error('Confirm at least one positive loaded quantity before dispatching.')
  const items = payload.items.map((item) => {
    const quantity = parseStockCents(item.loadedQuantity)
    if (typeof item.loadedQuantity !== 'string' || quantity === null || quantity <= 0n)
      throw new Error('Loaded quantities must be positive numbers with up to two decimal places.')
    return {
      salesOrderItemId: item.salesOrderItemId,
      stockItemId: item.stockItemId,
      loadedQuantity: item.loadedQuantity.trim(),
    }
  })
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/dispatch`,
    {
      deliveryVehicleId: payload.deliveryVehicleId,
      driverEmployeeId: payload.driverEmployeeId,
      items,
    },
  )
  return data
}

export async function completeOutgoingDeliveryApi(
  id: number,
  payload: CompleteOutgoingDeliveryPayload,
): Promise<OutgoingDeliveryRecord> {
  if (!Array.isArray(payload.items) || payload.items.length === 0)
    throw new Error('Account for every loaded item before completing this delivery.')
  const seen = new Set<number>()
  const items = payload.items.map((line) => {
    if (
      !Number.isSafeInteger(line.outgoingDeliveryItemId) ||
      line.outgoingDeliveryItemId <= 0 ||
      seen.has(line.outgoingDeliveryItemId)
    )
      throw new Error('Each loaded delivery item must appear exactly once.')
    seen.add(line.outgoingDeliveryItemId)
    const fields = [
      'deliveredQuantity',
      'returnedSellableQuantity',
      'returnedDamagedQuantity',
      'missingQuantity',
    ] as const
    for (const field of fields)
      if (typeof line[field] !== 'string' || parseStockCents(line[field]) === null)
        throw new Error(
          'Enter non-negative quantities with up to two decimal places for every return category.',
        )
    const reason = line.discrepancyReason?.trim()
    if (
      (parseStockCents(line.returnedDamagedQuantity)! > 0n ||
        parseStockCents(line.missingQuantity)! > 0n) &&
      !reason
    )
      throw new Error('Explain damaged or missing goods before completing the delivery.')
    return {
      outgoingDeliveryItemId: line.outgoingDeliveryItemId,
      deliveredQuantity: line.deliveredQuantity.trim(),
      returnedSellableQuantity: line.returnedSellableQuantity.trim(),
      returnedDamagedQuantity: line.returnedDamagedQuantity.trim(),
      missingQuantity: line.missingQuantity.trim(),
      ...(reason ? { discrepancyReason: reason } : {}),
    }
  })
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/complete`,
    { items },
  )
  return data
}

export async function cancelOutgoingDeliveryApi(id: number): Promise<OutgoingDeliveryRecord> {
  const { data } = await apiClient.patch<OutgoingDeliveryRecord>(
    `/outgoing-deliveries/${id}/cancel`,
  )
  return data
}
