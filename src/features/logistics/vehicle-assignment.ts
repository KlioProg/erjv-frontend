import type { DeliveryVehicle, VehicleCondition, VehicleStatus } from './delivery-vehicles.types'
import type { DeliveryRunRecord } from './delivery-runs.types'

export const ACTIVE_ASSIGNMENT_STATUSES = ['DISPATCHED'] as const

export const VEHICLE_CONDITION_LABELS = {
  OPERATIONAL: 'Operational',
  MAINTENANCE: 'Under Maintenance',
  OUT_OF_SERVICE: 'Out of Service',
  ARCHIVED: 'Archived',
} as const

export const VEHICLE_AVAILABILITY_LABELS = {
  AVAILABLE: 'Available',
  IN_DELIVERY: 'In Delivery',
  MAINTENANCE: 'Maintenance',
  OUT_OF_SERVICE: 'Out of Service',
  ARCHIVED: 'Archived',
} as const

export function isActiveDeliveryStatus(status: string): boolean {
  return ACTIVE_ASSIGNMENT_STATUSES.some((activeStatus) => activeStatus === status)
}

export function getVehicleCondition(vehicle: DeliveryVehicle): VehicleCondition {
  if (!vehicle.isActive) return 'ARCHIVED'
  if (vehicle.operationalStatus === 'MAINTENANCE' || vehicle.operationalStatus === 'OUT_OF_SERVICE') return vehicle.operationalStatus
  return 'OPERATIONAL'
}

export function getVehicleAssignments(
  vehicleId: number,
  deliveries: DeliveryRunRecord[],
): DeliveryRunRecord[] {
  return deliveries.filter(
    (delivery) =>
      delivery.deliveryVehicleId === vehicleId && isActiveDeliveryStatus(delivery.status),
  )
}

/** Availability is a view derived from condition and the authoritative availability and dispatched run references. */
export function getVehicleAvailabilityStatus(
  vehicle: DeliveryVehicle,
  deliveries: DeliveryRunRecord[],
): VehicleStatus | 'ARCHIVED' {
  const condition = getVehicleCondition(vehicle)
  if (condition !== 'OPERATIONAL') return condition
  return !vehicle.isAvailable || getVehicleAssignments(vehicle.id, deliveries).length > 0
    ? 'IN_DELIVERY' : 'AVAILABLE'
}
