export type IncomingDeliveryStatus = 'DRAFT' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

export interface IncomingDeliveryItemRecord {
  id: number
  incomingDeliveryId: number
  purchaseOrderItemId: number
  receivedQuantity: string
  createdAt: string
  updatedAt: string
  purchaseOrderItem?: {
    inventoryItemId: number
    quantity: string
  }
}

export interface IncomingDeliveryRecord {
  id: number
  deliveryNumber: string
  purchaseOrderId: number
  warehouseId: number
  status: IncomingDeliveryStatus
  scheduledAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  supplierReference: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items: IncomingDeliveryItemRecord[]
}

export interface IncomingDeliveryLineCommand {
  purchaseOrderItemId: number
  receivedQuantity: number | string
}

export interface CreateIncomingDeliveryPayload {
  purchaseOrderId: number
  warehouseId: number
  scheduledAt?: string | Date | null
  supplierReference?: string | null
  notes?: string | null
  items: IncomingDeliveryLineCommand[]
}

export interface IncomingDeliveryFilter {
  status?: IncomingDeliveryStatus
  purchaseOrderId?: number
  warehouseId?: number
}
