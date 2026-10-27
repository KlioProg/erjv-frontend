import { apiClient, extractArray, type FetchParams } from '@/lib/api-client'
import { parseStockCents } from './stock-display'
import { decimalString } from './purchase-pricing'
import type {
  AdjustStockQuantityPayload,
  CreateStockItemPayload,
  SetReorderThresholdPayload,
  SetStockQuantityPayload,
  StockItem,
  StockItemWithInventoryItem,
  StockItemWithRelations,
  StockItemWithWarehouse,
  ManualQuarantinePayload,
  QuarantineLot,
  QuarantineFilter,
  QuarantineConditionPayload,
  QuarantineResolutionPayload,
  QuarantineResolution,
} from './stock-items.types'

export async function fetchStockItemsApi(params?: FetchParams): Promise<StockItemWithRelations[]> {
  const response = await apiClient.get('/stock-items', { params })
  return extractArray<StockItemWithRelations>(response.data)
}

export async function fetchStockByWarehouseApi(
  warehouseId: number,
): Promise<StockItemWithInventoryItem[]> {
  const { data } = await apiClient.get<StockItemWithInventoryItem[]>(
    `/stock-items/warehouses/${warehouseId}`,
  )
  return extractArray<StockItemWithInventoryItem>(data)
}

export async function fetchStockByItemApi(
  inventoryItemId: number,
): Promise<StockItemWithWarehouse[]> {
  const { data } = await apiClient.get<StockItemWithWarehouse[]>(
    `/stock-items/inventory-items/${inventoryItemId}`,
  )
  return extractArray<StockItemWithWarehouse>(data)
}

export async function fetchStockItemByPairApi(
  inventoryItemId: number,
  warehouseId: number,
): Promise<StockItem | null> {
  const { data } = await apiClient.get<StockItem>(
    `/stock-items/pair/${inventoryItemId}/${warehouseId}`,
  )
  if (!data || typeof data !== 'object' || !('id' in data)) {
    return null
  }
  return data
}

export async function fetchStockItemByIdApi(id: number): Promise<StockItem | null> {
  const { data } = await apiClient.get<StockItem>(`/stock-items/${id}`)
  if (!data || typeof data !== 'object' || !('id' in data)) {
    return null
  }
  return data
}

export async function createStockItemApi(payload: CreateStockItemPayload): Promise<StockItem> {
  const cleanPayload = {
    inventoryItemId: Number(payload.inventoryItemId),
    warehouseId: Number(payload.warehouseId),
    quantity: payload.quantity ? parseFloat(payload.quantity).toFixed(2) : '0.00',
  }

  const { data } = await apiClient.post<StockItem>('/stock-items', cleanPayload)
  return data
}

export async function setStockQuantityApi(
  id: number,
  payload: SetStockQuantityPayload,
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/quantity`, {
    quantity: parseFloat(payload.quantity).toFixed(2),
  })
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

export async function increaseStockQuantityApi(
  id: number,
  payload: AdjustStockQuantityPayload,
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/quantity/increase`, {
    amount: parseFloat(payload.amount).toFixed(2),
  })
  return data
}

export async function decreaseStockQuantityApi(
  id: number,
  payload: AdjustStockQuantityPayload,
): Promise<StockItem> {
  const { data } = await apiClient.patch<StockItem>(`/stock-items/${id}/quantity/decrease`, {
    amount: parseFloat(payload.amount).toFixed(2),
  })
  return data
}

export async function deleteStockItemApi(id: number): Promise<void> {
  await apiClient.delete(`/stock-items/${id}`)
}

export async function fetchQuarantineLotsApi(filter?: QuarantineFilter): Promise<QuarantineLot[]> {
  const { data } = await apiClient.get<QuarantineLot[]>('/stock-items/quarantine-lots', {
    params: filter,
  })
  return data
}

export async function createManualQuarantineApi(
  payload: ManualQuarantinePayload,
): Promise<QuarantineLot> {
  const { data } = await apiClient.post<QuarantineLot>('/stock-items/quarantine-lots', {
    stockItemId: payload.stockItemId,
    condition: payload.condition,
    quantity: payload.quantity,
    reason: payload.reason,
    requestId: payload.requestId,
  })
  return data
}

export async function correctQuarantineConditionApi(
  id: number,
  payload: QuarantineConditionPayload,
): Promise<QuarantineLot> {
  const { data } = await apiClient.patch<QuarantineLot>(
    `/stock-items/quarantine-lots/${id}/condition`,
    {
      condition: payload.condition,
      reason: payload.reason.trim(),
    },
  )
  return data
}

export async function resolveQuarantineApi(
  id: number,
  payload: QuarantineResolutionPayload,
): Promise<QuarantineResolution> {
  const { data } = await apiClient.post<QuarantineResolution>(
    `/stock-items/quarantine-lots/${id}/resolutions`,
    {
      action: payload.action,
      quantity: payload.quantity,
      reason: payload.reason.trim(),
    },
  )
  return data
}
