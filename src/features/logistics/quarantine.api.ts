import { apiClient } from '@/lib/api-client'
import { parseStockCents } from './stock-display'
import type {
  ManualQuarantinePayload,
  QuarantineLot,
  QuarantinePage,
  QuarantineFilter,
  QuarantineConditionPayload,
  QuarantineResolutionPayload,
  QuarantineResolution,
} from './quarantine.types'
function validateRevision(payload: { expectedRevision: number; requestId: string }) {
  if (
    !Number.isSafeInteger(payload.expectedRevision) ||
    payload.expectedRevision < 1 ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.requestId)
  )
    throw Error('Reload the lot before continuing: a revision and request UUID are required.')
}
export async function fetchQuarantineLotApi(id: number): Promise<QuarantineLot> {
  const { data } = await apiClient.get<QuarantineLot>(`/stock-items/quarantine-lots/${id}`)
  if (data?.id !== id || !Number.isSafeInteger(data.revision) || data.revision < 1)
    throw Error('Reload the lot: its current revision is unavailable.')
  return data
}
export async function fetchQuarantineLotsApi(
  filter?: QuarantineFilter,
): Promise<QuarantinePage<QuarantineLot>> {
  const { data } = await apiClient.get<QuarantinePage<QuarantineLot>>(
    '/stock-items/quarantine-lots',
    {
      params: filter,
    },
  )
  if (
    !Array.isArray(data?.items) ||
    !(data.nextCursor === null || typeof data.nextCursor === 'string')
  )
    throw Error('The server returned an invalid quarantine page. Reload before continuing.')
  return data
}

export async function createManualQuarantineApi(
  payload: ManualQuarantinePayload,
): Promise<QuarantineLot> {
  const quantity = parseStockCents(payload.quantity)
  if (quantity === null || quantity <= 0n || !payload.reason.trim())
    throw new Error(
      'Enter a positive quarantine quantity with up to two decimals and an inspection reason.',
    )
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.requestId))
    throw new Error(
      'The inspection request could not be identified. Reopen the form before continuing.',
    )
  const { data } = await apiClient.post<QuarantineLot>('/stock-items/quarantine-lots', {
    stockItemId: payload.stockItemId,
    condition: payload.condition,
    quantity: payload.quantity.trim(),
    reason: payload.reason.trim(),
    requestId: payload.requestId,
  })
  if (data?.stockItemId !== payload.stockItemId || data.requestId !== payload.requestId)
    throw new Error(
      'The server did not confirm the quarantine record. Refresh the lots before trying again.',
    )
  return data
}

export async function correctQuarantineConditionApi(
  lotId: number,
  payload: QuarantineConditionPayload,
): Promise<QuarantineLot> {
  validateRevision(payload)
  if (!payload.reason.trim()) throw new Error('Enter a reason for correcting the condition.')
  const { data } = await apiClient.patch<QuarantineLot>(
    `/stock-items/quarantine-lots/${lotId}/condition`,
    {
      condition: payload.condition,
      reason: payload.reason.trim(),
      expectedRevision: payload.expectedRevision,
      requestId: payload.requestId,
    },
  )
  if (data?.id !== lotId || data.condition !== payload.condition)
    throw new Error(
      'The server did not confirm the condition correction. Refresh the lot before trying again.',
    )
  return data
}

export async function resolveQuarantineApi(
  id: number,
  payload: QuarantineResolutionPayload,
): Promise<QuarantineResolution> {
  validateRevision(payload)
  const quantity = parseStockCents(payload.quantity)
  if (quantity === null || quantity <= 0n || !payload.reason.trim())
    throw Error('Enter a positive quantity with up to two decimals and a reason.')
  const { data } = await apiClient.post<QuarantineResolution>(
    `/stock-items/quarantine-lots/${id}/resolutions`,
    {
      expectedRevision: payload.expectedRevision,
      requestId: payload.requestId,
      action: payload.action,
      quantity: payload.quantity,
      reason: payload.reason.trim(),
    },
  )
  return data
}
