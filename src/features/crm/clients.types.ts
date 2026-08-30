export type Client = {
  id: number
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateClientPayload = {
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address: string
  isActive?: boolean
}

export type UpdateClientDetailsPayload = {
  name?: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address?: string
}
