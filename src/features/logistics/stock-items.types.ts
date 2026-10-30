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
  revision: number
  onHandQuantity: string
  inTransitQuantity: string
  quarantinedQuantity: string
  conditionQuantities: { DAMAGED: string; SPOILED: string }
  availableQuantity: string
  reorderThreshold: string | null
  stockStatus: 'NORMAL' | 'LOW' | 'OUT' | 'UNCONFIGURED'
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
}

export type StockAdjustmentPayload = {
  kind: 'SET' | 'INCREASE' | 'DECREASE'
  quantity: string
  expectedRevision: number
  reason: string
  requestId: string
}

export type StockAdjustment = Omit<StockAdjustmentPayload, 'quantity'> & {
  id: number
  stockItemId: number
  submittedQuantity: string
  onHandDelta: string
  beforeOnHandQuantity: string
  afterOnHandQuantity: string
  beforeInTransitQuantity: string
  afterInTransitQuantity: string
  beforeQuarantinedQuantity: string
  afterQuarantinedQuantity: string
  beforeRevision: number
  afterRevision: number
  actorUserId: number
  movementId: number | null
  createdAt: string
}

export type SetReorderThresholdPayload = {
  reorderThreshold: string | null
}

export type * from './quarantine.types'
