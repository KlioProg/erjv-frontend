export type InventoryItemSummary = {
  id: number
  name: string
  unit?: string
  sku?: string
  unitPrice?: number
}

export type WarehouseSummary = {
  id: number
  name: string
  address?: string
}

export type StockItem = {
  id: number
  quantity: string
  inventoryItemId: number
  warehouseId: number
  createdAt: string
  updatedAt: string
}

export type StockItemWithRelations = StockItem & {
  inventoryItem: InventoryItemSummary
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
