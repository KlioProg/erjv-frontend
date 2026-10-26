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
  spoiledQuantity?: string
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

export type QuarantineAction = 'CLEAR' | 'REMOVE'
export type ResolveQuarantinePayload = {
  action: QuarantineAction
  quantity: string
  reason: string
}

export type QuarantineResolution = ResolveQuarantinePayload & {
  id: number
  lotId: number
  actorUserId: number
  createdAt: string
  purchaseOrderId: number | null
}

export type QuarantineLot = {
  id: number
  stockItemId: number
  incomingDeliveryItemId: number | null
  outgoingDeliveryItemId: number | null
  sourceKind: 'INCOMING_DELIVERY' | 'OUTGOING_DELIVERY' | 'MANUAL'
  condition: 'DAMAGED' | 'SPOILED'
  reportedCondition: 'DAMAGED' | 'SPOILED'
  taggedByUserId: number | null
  tagReason: string | null
  requestId: string | null
  initialQuantity: string
  remainingQuantity: string
  createdAt: string
  conditionChanges: {
    id: number
    fromCondition: 'DAMAGED' | 'SPOILED'
    toCondition: 'DAMAGED' | 'SPOILED'
    reason: string
    actorUserId: number
    createdAt: string
  }[]
  resolutions: Omit<QuarantineResolution, 'purchaseOrderId'>[]
}
