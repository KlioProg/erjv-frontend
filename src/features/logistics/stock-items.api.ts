import { apiClient, getApiError, requireRevision } from '@/lib/api-client'
import { parseStockCents } from './stock-display'
import { decimalString } from './purchase-pricing'
import type {
  CreateStockItemPayload,
  SetReorderThresholdPayload,
  StockItem,
  StockItemWithInventoryItem,
  StockItemWithRelations,
  StockItemWithWarehouse,
  StockAdjustmentPayload,
  StockAdjustment,
} from './stock-items.types'

import { fetchCursorList, type CursorParams } from '@/lib/cursor-pagination'

export type StockPageFilter = CursorParams & { q?: string }

// Complete traversal is reserved for explicit exports and empty-warehouse safety checks.
export function fetchStockItemsApi(params: StockPageFilter = {}): Promise<StockItemWithRelations[]> {
  return fetchCursorList('/stock-items', params)
}
export function fetchStockByWarehouseApi(warehouseId: number): Promise<StockItemWithInventoryItem[]> {
  return fetchCursorList(`/stock-items/warehouses/${warehouseId}`)
}
export function fetchStockByItemApi(inventoryItemId: number): Promise<StockItemWithWarehouse[]> {
  return fetchCursorList(`/stock-items/inventory-items/${inventoryItemId}`)
}

export async function fetchStockItemByPairApi(
  inventoryItemId: number,
  warehouseId: number,
): Promise<StockItem | null> {
  try {
    const { data } = await apiClient.get<StockItem>(
      `/stock-items/pair/${inventoryItemId}/${warehouseId}`,
    )
    if (!data || typeof data !== 'object' || !Number.isSafeInteger(data.id))
      throw Error('The stock balance could not be verified. Reload it before continuing.')
    return data
  } catch (error) {
    const problem = getApiError(error)
    if (problem?.status === 404 && problem.code === 'RESOURCE_NOT_FOUND') return null
    throw error
  }
}

export async function fetchStockItemByIdApi(id: number): Promise<StockItem | null> {
  const { data } = await apiClient.get<StockItem>(`/stock-items/${id}`)
  if (!data || typeof data !== 'object' || !('id' in data)) {
    throw Error('The stock balance could not be verified. Reload it before continuing.')
  }
  return data
}

export async function createStockItemApi(payload: CreateStockItemPayload): Promise<StockItem> {
  const cleanPayload = {
    inventoryItemId: Number(payload.inventoryItemId),
    warehouseId: Number(payload.warehouseId),
  }

  const { data } = await apiClient.post<StockItem>('/stock-items', cleanPayload)
  if (data?.inventoryItemId !== cleanPayload.inventoryItemId || data.warehouseId !== cleanPayload.warehouseId || !Number.isSafeInteger(data.id) || !Number.isSafeInteger(data.revision) || data.revision < 1)
    throw Error('The server did not confirm the allocation. Refresh and check the warehouse before creating it again.')
  return data
}

export async function createStockAdjustmentApi(id: number, payload: StockAdjustmentPayload): Promise<StockAdjustment> {
  const quantity = parseStockCents(payload.quantity)
  if (!['SET', 'INCREASE', 'DECREASE'].includes(payload.kind) || quantity === null || (payload.kind !== 'SET' && quantity <= 0n))
    throw Error('Enter a valid quantity with up to two decimals. Increases and decreases must be positive.')
  if (!payload.reason.trim()) throw Error('Enter a reason for this stock adjustment.')
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.requestId))
    throw Error('A valid adjustment request ID is required. Reopen the form.')
  const command = { kind: payload.kind, quantity: decimalString(quantity), expectedRevision: requireRevision(payload.expectedRevision), reason: payload.reason.trim(), requestId: payload.requestId.toLowerCase() }
  const { data } = await apiClient.post<StockAdjustment>(`/stock-items/${id}/adjustments`, command)
  if (data?.stockItemId !== id || data.requestId !== command.requestId || data.kind !== command.kind ||
      data.expectedRevision !== command.expectedRevision || data.beforeRevision !== command.expectedRevision ||
      !Number.isSafeInteger(data.afterRevision) || data.afterRevision <= data.beforeRevision ||
      data.submittedQuantity !== command.quantity || data.reason !== command.reason)
    throw Error('The server did not confirm the adjustment. Keep this request and review adjustment history before retrying.')
  return data
}

export async function setReorderThresholdApi(
  id: number,
  payload: SetReorderThresholdPayload,
): Promise<StockItem> {
  const threshold =
    payload.reorderThreshold === null ? null : parseStockCents(payload.reorderThreshold)
  if (payload.reorderThreshold !== null && (threshold === null || threshold > 999_999_999_999n))
    throw new Error(
      'Use a non-negative reorder threshold with up to two decimals and 10 whole digits.',
    )
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/reorder-threshold`, {
    reorderThreshold: threshold === null ? null : decimalString(threshold),
  })
  return data
}

export async function deleteStockItemApi(id: number): Promise<void> {
  await apiClient.delete(`/stock-items/${id}`)
}

export * from './quarantine.api'
