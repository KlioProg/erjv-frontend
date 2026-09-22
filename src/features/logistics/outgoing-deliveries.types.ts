export type OutgoingDeliveryStatus =
  'DRAFT' | 'SCHEDULED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED'

export interface OutgoingDeliveryAllocationSummary {
  stockItemId: number
  salesOrderItemId: number
  quantity: string
}

export interface OutgoingDeliveryItemRecord {
  id: number
  outgoingDeliveryId: number
  salesOrderAllocationId: number
  quantity: string
  createdAt: string
  updatedAt: string
  salesOrderAllocation: OutgoingDeliveryAllocationSummary
}

export interface OutgoingDeliveryRecord {
  id: number
  deliveryNumber: string
  salesOrderId: number
  warehouseId: number
  deliveryVehicleId: number | null
  driverEmployeeId: number | null
  status: OutgoingDeliveryStatus
  scheduledAt: string | null
  dispatchedAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  items: OutgoingDeliveryItemRecord[]
}

export interface OutgoingDeliveryLineCommand {
  salesOrderAllocationId: number
  quantity: string
}

export interface CreateOutgoingDeliveryPayload {
  salesOrderId: number
  warehouseId: number
  deliveryVehicleId?: number | null
  driverEmployeeId?: number | null
  scheduledAt?: string | Date | null
  notes?: string | null
  items: OutgoingDeliveryLineCommand[]
}

export interface DispatchOutgoingDeliveryPayload {
  deliveryVehicleId: number
  driverEmployeeId: number
}

export interface OutgoingDeliveryFilter {
  status?: OutgoingDeliveryStatus
  salesOrderId?: number
  warehouseId?: number
}
