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
