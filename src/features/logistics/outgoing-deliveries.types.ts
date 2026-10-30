import type { CursorParams } from '@/lib/cursor-pagination'

export type OutgoingDeliveryStatus =
  'DRAFT' | 'READY' | 'DISPATCHED' | 'RECONCILED' | 'CANCELLED'

export interface OutgoingDeliveryItemRecord {
  id: number
  outgoingDeliveryId: number
  salesOrderItemId: number
  stockItemId: number
  quantity: string
  legacyAllocation?: boolean
  loadedQuantity?: string
  deliveredQuantity?: string | null
  returnedSellableQuantity?: string | null
  returnedDamagedQuantity?: string | null
  missingQuantity?: string | null
  discrepancyReason?: string | null
  createdAt: string
  updatedAt: string
  salesOrderItem?: {
    inventoryItemId: number
    quantity: string
    unitPrice: string
  }
  stockItem?: { warehouseId: number }
}

export interface OutgoingDeliveryRecord {
  id: number
  deliveryNumber: string
  salesOrderId: number
  warehouseId: number | null
  revision: number
  plannedItems: OutgoingDeliveryPlanItemRecord[]
  runId: number | null
  reconciledAt: string | null
  reconciledByUserId: number | null
  fulfillmentOutcome: 'NONE' | 'PARTIAL' | 'FULL' | null
  hasDamage: boolean
  hasMissing: boolean
  status: OutgoingDeliveryStatus
  cancelledAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items: OutgoingDeliveryItemRecord[]
}

export interface OutgoingDeliveryLineCommand {
  salesOrderItemId: number
  stockItemId: number
  quantity: string
}

export interface OutgoingDeliveryPlanItemRecord {
  id: number
  outgoingDeliveryId: number
  salesOrderItemId: number
  plannedQuantity: string
  createdAt: string
  updatedAt: string
}

export interface CreateOutgoingDeliveryDraftPayload {
  salesOrderId: number
  notes?: string | null
}

export interface UpdateOutgoingDeliveryDraftPayload {
  expectedRevision: number
  warehouseId: number | null
  notes: string | null
  plannedItems: { salesOrderItemId: number; plannedQuantity: string }[]
}

export interface OutgoingPlanningOption {
  salesOrderItemId: number
  inventoryItemId: number
  orderedQuantity: string
  committedQuantity: string
  readyQuantity: string
  availableQuantity: string
  plannedQuantity: string
  maximumPlannableQuantity: string
  remainingToPlanQuantity: string
  shortfallQuantity: string
}

export type CreateOutgoingDeliveryPayload = CreateOutgoingDeliveryDraftPayload

export interface OutgoingDeliveryFilter extends CursorParams {
  status?: OutgoingDeliveryStatus
  statuses?: OutgoingDeliveryStatus[]
  q?: string
  salesOrderId?: number
  warehouseId?: number
  runId?: number
  unassigned?: 'true'
}
