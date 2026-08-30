export type InventoryItemResponse = {
  id: number
  name: string
  sku?: string
  variety?: string | null
  unit?: string
  unitPrice: number
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateInventoryItemPayload = {
  name: string
  sku?: string
  variety?: string | null
  unit?: string
  unitPrice: number | string
  description?: string | null
}

export type UpdateInventoryItemDetailsPayload = {
  name?: string
  sku?: string
  variety?: string | null
  unit?: string
  description?: string | null
}
