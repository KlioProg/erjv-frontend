export type Supplier = {
  id: number
  code: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateSupplierPayload = {
  code: string
  name: string
  contactPerson?: string
  phone?: string
  email?: string
  address?: string
}

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>
