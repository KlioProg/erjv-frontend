export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'CONFIRMED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'

export interface PurchaseOrderItemRecord {
  id: number
  purchaseOrderId: number
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
}

export interface PurchaseOrderRecord {
  id: number
  orderNumber: string
  status: PurchaseOrderStatus
  supplierId: number
  orderedAt: string
  expectedAt: string | null
  confirmedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  externalReference: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items: PurchaseOrderItemRecord[]
}

export interface PurchaseOrderLineCommand {
  inventoryItemId: number
  quantity: number | string
  unitPrice: number | string
  discountRate?: number | string
  taxRate?: number | string
  notes?: string | null
}

export interface CreatePurchaseOrderPayload {
  supplierId: number
  expectedAt?: string | Date | null
  externalReference?: string | null
  notes?: string | null
  items: PurchaseOrderLineCommand[]
}

export interface PurchaseOrderFilter {
  status?: PurchaseOrderStatus
  supplierId?: number
}
