import type { DeliveryVehicle, VehicleCondition, VehicleStatus } from './delivery-vehicles.types'
import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'

export const ACTIVE_ASSIGNMENT_STATUSES = ['DRAFT', 'SCHEDULED', 'DISPATCHED'] as const

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
  if (vehicle.status === 'MAINTENANCE' || vehicle.status === 'OUT_OF_SERVICE') return vehicle.status
  return 'OPERATIONAL'
}

export function getVehicleAssignments(
  vehicleId: number,
  deliveries: OutgoingDeliveryRecord[],
): OutgoingDeliveryRecord[] {
  return deliveries.filter(
    (delivery) =>
      delivery.deliveryVehicleId === vehicleId && isActiveDeliveryStatus(delivery.status),
  )
}

/** Availability is a view derived from condition and active delivery references. */
export function getVehicleAvailabilityStatus(
  vehicle: DeliveryVehicle,
  deliveries: OutgoingDeliveryRecord[],
): VehicleStatus | 'ARCHIVED' {
  const condition = getVehicleCondition(vehicle)
  if (condition !== 'OPERATIONAL') return condition
  return getVehicleAssignments(vehicle.id, deliveries).length > 0 ? 'IN_DELIVERY' : 'AVAILABLE'
}
