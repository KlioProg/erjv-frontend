import type { CursorParams } from '@/lib/cursor-pagination'

export type IncomingDeliveryStatus = 'DRAFT' | 'SCHEDULED' | 'COMPLETED' | 'CANCELLED'

export interface IncomingDeliveryItemRecord {
  id: number
  incomingDeliveryId: number
  purchaseOrderItemId: number
  receivedQuantity: string
  acceptedQuantity?: string | null
  damagedQuantity?: string | null
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
  outcome?: 'RECEIVED' | 'RECEIVED_WITH_DAMAGE' | 'NO_RECEIPT' | null
  noReceiptReason?: string | null
  confirmedByUserId?: number | null
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
  receivedQuantity: string
  damagedQuantity: string
}

export interface CompleteIncomingDeliveryPayload {
  items: IncomingDeliveryLineCommand[]
  noReceiptReason?: string
}

export interface CreateIncomingDeliveryPayload {
  purchaseOrderId: number
  warehouseId: number
  scheduledAt?: string | Date | null
  supplierReference?: string | null
  notes?: string | null
}

export interface IncomingDeliveryFilter extends CursorParams {
  status?: IncomingDeliveryStatus
  purchaseOrderId?: number
  warehouseId?: number
}
