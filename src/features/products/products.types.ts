export type InventoryItemResponse = {
  id: number
  name: string
  sku: string
  unitPrice: number
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateInventoryItemPayload = {
  name: string
  sku: string
  unitPrice: number
  description?: string | null
}

export type UpdateInventoryItemDetailsPayload = {
  name?: string
  sku?: string
  description?: string | null
}
