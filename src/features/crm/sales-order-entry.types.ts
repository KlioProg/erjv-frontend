export type OrderStatus = 'Completed' | 'Active' | 'Cancelled'
export type OrderLine = {
  productId: number
  name: string
  variety?: string | null
  unit?: string | null
  unitPrice: string
  quantity: string
}
export type OrderFormValues = {
  clientId: number
  clientName: string
  deliveryAddress: string
  expectedAt?: string
  externalReference?: string
  notes?: string
  itemSummary: string
  lines: OrderLine[]
  discountType: 'peso' | 'percentage'
  discountValue: string
  discountRate: string
  taxRate: string
  total: string
  status: OrderStatus
  cashier: string
}
export type EditableSalesOrder = {
  clientName: string
  lines: OrderLine[]
  discountType: 'peso' | 'percentage'
  discountValue: string
  status: OrderStatus
  deliveryAddress?: string
  expectedAt?: string
  externalReference?: string
  notes?: string
}
