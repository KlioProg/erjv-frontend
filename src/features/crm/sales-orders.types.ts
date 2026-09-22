export type SalesOrderStatus =
  'DRAFT' | 'CONFIRMED' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'CANCELLED'

export interface SalesOrderAllocationRecord {
  id: number
  salesOrderItemId: number
  stockItemId: number
  quantity: string
  releasedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface SalesOrderItemRecord {
  id: number
  salesOrderId: number
  lineNumber: number
  inventoryItemId: number
  quantity: string
  unitPrice: string
  discountRate: string
  discountAmount: string
  taxRate: string
  taxAmount: string
  subtotalAmount: string
  taxableAmount: string
  totalAmount: string
  notes: string | null
  createdAt: string
  updatedAt: string
  allocations: SalesOrderAllocationRecord[]
}

export interface SalesOrderRecord {
  id: number
  orderNumber: string
  status: SalesOrderStatus
  clientId: number
  deliveryAddress: string
  orderedAt: string
  expectedAt: string | null
  confirmedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  externalReference: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items: SalesOrderItemRecord[]
}

export interface SalesOrderAllocationCommand {
  stockItemId: number
  quantity: string
}

export interface SalesOrderLineCommand {
  inventoryItemId: number
  quantity: string
  unitPrice: string
  discountRate?: string
  taxRate?: string
  notes?: string | null
  allocations?: SalesOrderAllocationCommand[]
}

export interface CreateSalesOrderPayload {
  clientId: number
  deliveryAddress: string
  expectedAt?: string | Date | null
  externalReference?: string | null
  notes?: string | null
  items: SalesOrderLineCommand[]
}

export interface SalesOrderFilter {
  status?: SalesOrderStatus
  clientId?: number
}
