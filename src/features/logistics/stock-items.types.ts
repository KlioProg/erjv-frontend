export type InventoryItemSummary = {
  id: number
  name: string
  unit?: string
  variety?: string | null
  unitPrice?: string
}

export type WarehouseSummary = {
  id: number
  name: string
  address?: string
}

export type StockItem = {
  id: number
  quantity: string
  reservedQuantity?: string
  damagedQuantity?: string
  quarantinedQuantity?: string
  conditionQuantities?: { DAMAGED: string; SPOILED: string }
  availableQuantity?: string
  reorderThreshold?: string | null
  stockStatus?: 'NORMAL' | 'LOW' | 'OUT' | 'UNCONFIGURED'
  inventoryItemId: number
  warehouseId: number
  createdAt: string
  updatedAt: string
}

export type StockItemWithRelations = StockItem & {
  inventoryItem: InventoryItemSummary
  warehouse: WarehouseSummary
}

export type StockItemWithInventoryItem = StockItem & {
  inventoryItem: InventoryItemSummary
}

export type StockItemWithWarehouse = StockItem & {
  warehouse: WarehouseSummary
}

export type CreateStockItemPayload = {
  inventoryItemId: number
  warehouseId: number
  quantity?: string
}

export type SetStockQuantityPayload = {
  quantity: string
}

export type AdjustStockQuantityPayload = {
  amount: string
}

export type SetReorderThresholdPayload = {
  reorderThreshold: string | null
}

export type QuarantineCondition = 'DAMAGED' | 'SPOILED'
export type QuarantineAction = 'CLEAR' | 'REMOVE'
export type ManualQuarantinePayload = {
  stockItemId: number
  condition: QuarantineCondition
  quantity: string
  reason: string
  requestId: string
}
export type QuarantineFilter = {
  stockItemId?: number
  condition?: QuarantineCondition
  openOnly?: boolean
}
export type QuarantineConditionPayload = { condition: QuarantineCondition; reason: string }
export type QuarantineResolutionPayload = { action: QuarantineAction; quantity: string; reason: string }
export type QuarantineResolution = QuarantineResolutionPayload & {
  id: number
  lotId: number
  actorUserId: number
  createdAt: string
}
export type QuarantineLot = {
  id: number
  stockItemId: number
  sourceKind: 'MANUAL' | 'INCOMING_DELIVERY' | 'OUTGOING_DELIVERY'
  condition: QuarantineCondition
  reportedCondition: QuarantineCondition
  initialQuantity: string
  remainingQuantity: string
  incomingDeliveryItemId: number | null
  outgoingDeliveryItemId: number | null
  taggedByUserId: number | null
  tagReason: string | null
  requestId: string | null
  createdAt: string
  conditionChanges: { id: number; fromCondition: QuarantineCondition; toCondition: QuarantineCondition; reason: string; actorUserId: number; createdAt: string }[]
  resolutions: QuarantineResolution[]
}
