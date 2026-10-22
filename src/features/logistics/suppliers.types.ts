export type Supplier = {
  id: number
  code: string
  name: string
  contactPerson: string | null
  phone: string | null
  email: string | null
  address: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateSupplierPayload = {
  code: string
  name: string
  contactPerson?: string | null
  phone?: string | null
  email?: string | null
  address: string
}

export type UpdateSupplierPayload = Partial<CreateSupplierPayload>
