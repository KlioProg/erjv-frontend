export type SalesOrderStatus =
  'DRAFT' | 'CONFIRMED' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'CANCELLED'

/** Future fulfillment intent; the current Sales Order API does not persist this yet. */
export type SalesOrderOutgoingMethod = 'CLIENT_PICKUP' | 'DELIVERY'

/**
 * Sales-to-Logistics handoff contract for the next phase, separate from API payloads.
 * Logistics resolves customer and destination from salesOrderId; stock sources
 * are selected per order item during delivery preparation.
 * Client Pickup requires no company vehicle; Delivery assigns one in Logistics.
 */
export interface SalesOrderFulfillmentPlan {
  salesOrderId: SalesOrderRecord['id']
  outgoingMethod: SalesOrderOutgoingMethod
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

export interface SalesOrderLineCommand {
  inventoryItemId: number
  quantity: string
  unitPrice: string
  discountRate?: string
  taxRate?: string
  notes?: string | null
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
