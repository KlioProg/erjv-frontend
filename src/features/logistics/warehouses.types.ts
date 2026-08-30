export type Warehouse = {
  id: number
  name: string
  address: string
  contactNumber: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateWarehousePayload = {
  name: string
  address: string
  contactNumber?: string | null
  isActive?: boolean
}

export type UpdateWarehouseDetailsPayload = {
  name?: string
  address?: string
  contactNumber?: string | null
}
