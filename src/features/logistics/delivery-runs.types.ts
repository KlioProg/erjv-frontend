import type { CursorParams } from '@/lib/cursor-pagination'
import type { OutgoingDeliveryRecord, OutgoingDeliveryStatus } from './outgoing-deliveries.types'

export type DeliveryRunStatus = 'DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED'
export interface DeliveryRunMember {
  id: number
  deliveryNumber: string
  revision: number
  status: OutgoingDeliveryStatus
  salesOrderId: number
  warehouseId: number | null
}
export interface DeliveryRunRecord {
  id: number
  runNumber: string
  revision: number
  status: DeliveryRunStatus
  warehouseId: number
  driverEmployeeId: number | null
  deliveryVehicleId: number | null
  scheduledDepartureAt: string | null
  dispatchedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  departureConfirmedByUserId: number | null
  loadedWeightKg: string | null
  capacityKgAtDeparture: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  deliveries: DeliveryRunMember[]
}
export interface DeliveryRunFilter extends CursorParams {
  statuses?: DeliveryRunStatus[]
  warehouseId?: number
  driverEmployeeId?: number
  deliveryVehicleId?: number
  scheduledFrom?: string
  scheduledBefore?: string
  q?: string
}
export interface DeliveryRunPage {
  items: DeliveryRunRecord[]
  nextCursor: string | null
}
export interface RunMemberRevision {
  deliveryId: number
  expectedRevision: number
}
export interface CreateDeliveryRunPayload {
  warehouseId: number
  scheduledDepartureAt?: string | null
  driverEmployeeId?: number | null
  deliveryVehicleId?: number | null
  notes?: string | null
  deliveries?: RunMemberRevision[]
}
export interface UpdateDeliveryRunDraftPayload extends Partial<Omit<CreateDeliveryRunPayload, 'deliveries'>> {
  expectedRevision: number
}
export interface ChangeRunMembersPayload {
  expectedRevision: number
  add?: RunMemberRevision[]
  remove?: RunMemberRevision[]
}
export interface RunMemberActionPayload {
  expectedRunRevision: number
  expectedDeliveryRevision: number
}
export interface RunLoad extends RunMemberRevision {
  items: { salesOrderItemId: number; stockItemId: number; loadedQuantity: string }[]
}
export interface DispatchDeliveryRunPayload {
  expectedRevision: number
  loadedWeightKg: string
  loads: RunLoad[]
}
export interface ReconcileRunMemberPayload {
  expectedRevision: number
  items: {
    outgoingDeliveryItemId: number
    deliveredQuantity: string
    returnedSellableQuantity: string
    returnedDamagedQuantity: string
    missingQuantity: string
    discrepancyReason?: string | null
  }[]
}
export interface RunMemberReconciliationResponse {
  delivery: OutgoingDeliveryRecord
  run: DeliveryRunRecord
}
