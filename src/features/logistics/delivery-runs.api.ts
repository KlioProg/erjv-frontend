import { apiClient, requireRevision } from '@/lib/api-client'
import { parseStockCents } from './stock-display'
import type {
  ChangeRunMembersPayload, CreateDeliveryRunPayload, DeliveryRunFilter, DeliveryRunPage,
  DeliveryRunRecord, DispatchDeliveryRunPayload, ReconcileRunMemberPayload,
  RunMemberActionPayload, RunMemberReconciliationResponse, RunMemberRevision,
  UpdateDeliveryRunDraftPayload,
} from './delivery-runs.types'

function requireId(id: number): number {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('A valid saved record ID is required.')
  return id
}

function decimal(value: string, positive = false): string {
  const cents = typeof value === 'string' ? parseStockCents(value) : null
  if (cents === null || (positive && cents <= 0n))
    throw new Error(`Enter ${positive ? 'positive' : 'non-negative'} decimal quantities with up to two decimal places.`)
  return value.trim()
}

function members(entries: RunMemberRevision[]): RunMemberRevision[] {
  if (entries.length > 100 || new Set(entries.map((entry) => entry.deliveryId)).size !== entries.length)
    throw new Error('Include each delivery only once, with at most 100 members.')
  return entries.map(({ deliveryId, expectedRevision }) => ({
    deliveryId: requireId(deliveryId), expectedRevision: requireRevision(expectedRevision),
  }))
}

function draftFields(payload: Partial<CreateDeliveryRunPayload>) {
  return {
    ...(payload.warehouseId !== undefined ? { warehouseId: requireId(payload.warehouseId) } : {}),
    ...(payload.driverEmployeeId !== undefined ? { driverEmployeeId: payload.driverEmployeeId === null ? null : requireId(payload.driverEmployeeId) } : {}),
    ...(payload.deliveryVehicleId !== undefined ? { deliveryVehicleId: payload.deliveryVehicleId === null ? null : requireId(payload.deliveryVehicleId) } : {}),
    ...(payload.scheduledDepartureAt !== undefined ? { scheduledDepartureAt: payload.scheduledDepartureAt === null ? null : new Date(payload.scheduledDepartureAt).toISOString() } : {}),
    ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
  }
}

export async function fetchDeliveryRunsPageApi(filter: DeliveryRunFilter = {}, signal?: AbortSignal): Promise<DeliveryRunPage> {
  const { limit = 50, cursor, statuses, warehouseId, driverEmployeeId, deliveryVehicleId, scheduledFrom, scheduledBefore, q } = filter
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error('Page size must be between 1 and 100.')
  const { data } = await apiClient.get<DeliveryRunPage>('/delivery-runs', {
    params: { limit, cursor, statuses, warehouseId, driverEmployeeId, deliveryVehicleId, scheduledFrom, scheduledBefore, q },
    paramsSerializer: { indexes: null },
    signal,
  })
  if (!Array.isArray(data?.items) || !(data.nextCursor === null || (typeof data.nextCursor === 'string' && data.nextCursor.length > 0 && data.nextCursor !== cursor)))
    throw new Error('The server returned an invalid run page. Reload before continuing.')
  return data
}

export async function fetchDeliveryRunByIdApi(id: number, signal?: AbortSignal): Promise<DeliveryRunRecord> {
  const { data } = await apiClient.get<DeliveryRunRecord>(`/delivery-runs/${requireId(id)}`, { signal })
  return data
}

export async function createDeliveryRunApi(payload: CreateDeliveryRunPayload): Promise<DeliveryRunRecord> {
  const { data } = await apiClient.post<DeliveryRunRecord>('/delivery-runs', {
    ...draftFields(payload), warehouseId: requireId(payload.warehouseId),
    ...(payload.deliveries !== undefined ? { deliveries: members(payload.deliveries) } : {}),
  })
  return data
}

export async function updateDeliveryRunDraftApi(id: number, payload: UpdateDeliveryRunDraftPayload): Promise<DeliveryRunRecord> {
  const { data } = await apiClient.patch<DeliveryRunRecord>(`/delivery-runs/${requireId(id)}/draft`, {
    expectedRevision: requireRevision(payload.expectedRevision), ...draftFields(payload),
  })
  return data
}

export async function changeRunMembersApi(id: number, payload: ChangeRunMembersPayload): Promise<DeliveryRunRecord> {
  const { data } = await apiClient.patch<DeliveryRunRecord>(`/delivery-runs/${requireId(id)}/deliveries`, {
    expectedRevision: requireRevision(payload.expectedRevision),
    ...(payload.add !== undefined ? { add: members(payload.add) } : {}),
    ...(payload.remove !== undefined ? { remove: members(payload.remove) } : {}),
  })
  return data
}

export async function reopenRunMemberApi(id: number, deliveryId: number, payload: RunMemberActionPayload): Promise<DeliveryRunRecord> {
  const { data } = await apiClient.patch<DeliveryRunRecord>(`/delivery-runs/${requireId(id)}/deliveries/${requireId(deliveryId)}/reopen`, {
    expectedRunRevision: requireRevision(payload.expectedRunRevision), expectedDeliveryRevision: requireRevision(payload.expectedDeliveryRevision),
  })
  return data
}

export async function cancelRunMemberApi(id: number, deliveryId: number, payload: RunMemberActionPayload): Promise<DeliveryRunRecord> {
  const { data } = await apiClient.patch<DeliveryRunRecord>(`/delivery-runs/${requireId(id)}/deliveries/${requireId(deliveryId)}/cancel`, {
    expectedRunRevision: requireRevision(payload.expectedRunRevision), expectedDeliveryRevision: requireRevision(payload.expectedDeliveryRevision),
  })
  return data
}

export async function cancelDeliveryRunApi(id: number, expectedRevision: number): Promise<DeliveryRunRecord> {
  const { data } = await apiClient.patch<DeliveryRunRecord>(`/delivery-runs/${requireId(id)}/cancel`, { expectedRevision: requireRevision(expectedRevision) })
  return data
}

export async function dispatchDeliveryRunApi(id: number, payload: DispatchDeliveryRunPayload): Promise<DeliveryRunRecord> {
  if (!payload.loads.length) throw new Error('Confirm a load for every run member.')
  members(payload.loads)
  const loads = payload.loads.map((load) => {
    if (!load.items.length) throw new Error('Each member needs at least one loaded item.')
    const seen = new Set<string>()
    return {
      deliveryId: requireId(load.deliveryId), expectedRevision: requireRevision(load.expectedRevision),
      items: load.items.map((item) => {
        const key = `${item.salesOrderItemId}:${item.stockItemId}`
        if (seen.has(key)) throw new Error('Include each order item and stock source only once per member.')
        seen.add(key)
        return { salesOrderItemId: requireId(item.salesOrderItemId), stockItemId: requireId(item.stockItemId), loadedQuantity: decimal(item.loadedQuantity, true) }
      }),
    }
  })
  const { data } = await apiClient.patch<DeliveryRunRecord>(`/delivery-runs/${requireId(id)}/dispatch`, {
    expectedRevision: requireRevision(payload.expectedRevision), loadedWeightKg: decimal(payload.loadedWeightKg, true), loads,
  })
  return data
}

export async function reconcileRunMemberApi(id: number, deliveryId: number, payload: ReconcileRunMemberPayload): Promise<RunMemberReconciliationResponse> {
  if (!payload.items.length || new Set(payload.items.map((item) => item.outgoingDeliveryItemId)).size !== payload.items.length)
    throw new Error('Account for each loaded item exactly once.')
  const items = payload.items.map((item) => {
    const returnedDamagedQuantity = decimal(item.returnedDamagedQuantity)
    const missingQuantity = decimal(item.missingQuantity)
    const reason = item.discrepancyReason?.trim()
    if ((parseStockCents(returnedDamagedQuantity)! > 0n || parseStockCents(missingQuantity)! > 0n) && !reason)
      throw new Error('Explain damaged or missing goods before reconciliation.')
    return {
      outgoingDeliveryItemId: requireId(item.outgoingDeliveryItemId),
      deliveredQuantity: decimal(item.deliveredQuantity), returnedSellableQuantity: decimal(item.returnedSellableQuantity),
      returnedDamagedQuantity, missingQuantity, ...(reason ? { discrepancyReason: reason } : {}),
    }
  })
  const { data } = await apiClient.patch<RunMemberReconciliationResponse>(`/delivery-runs/${requireId(id)}/deliveries/${requireId(deliveryId)}/reconcile`, {
    expectedRevision: requireRevision(payload.expectedRevision), items,
  })
  return data
}
