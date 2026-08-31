export type InventoryItemResponse = {
  id: number
  name: string
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
  variety?: string | null
  unit?: string
  unitPrice: number | string
  description?: string | null
  isActive?: boolean
}

export type UpdateInventoryItemDetailsPayload = {
  name?: string
  variety?: string | null
  unit?: string
  description?: string | null
}
