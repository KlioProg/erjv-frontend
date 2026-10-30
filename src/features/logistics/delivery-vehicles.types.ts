// These are condition commands supported by the current API. Assignment is never manual.
export const OPERATIONAL_STATUSES = ['SERVICEABLE', 'MAINTENANCE', 'OUT_OF_SERVICE'] as const

export type VehicleOperationalStatus = (typeof OPERATIONAL_STATUSES)[number]

export type VehicleCondition = 'OPERATIONAL' | 'MAINTENANCE' | 'OUT_OF_SERVICE' | 'ARCHIVED'

export const VEHICLE_STATUSES = [
  'AVAILABLE',
  'IN_DELIVERY',
  'MAINTENANCE',
  'OUT_OF_SERVICE',
] as const

export type VehicleStatus = (typeof VEHICLE_STATUSES)[number]

export type DeliveryVehicle = {
  id: number
  plateNumber: string
  vehicleType: string
  model: string | null
  capacityKg: string | null
  operationalStatus: VehicleOperationalStatus
  isAvailable: boolean
  activeRunId?: number | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateDeliveryVehiclePayload = {
  plateNumber: string
  vehicleType: string
  model?: string | null
  capacityKg?: string | null
  operationalStatus?: VehicleOperationalStatus
  isActive?: boolean
}

export type UpdateDeliveryVehicleDetailsPayload = {
  plateNumber?: string
  vehicleType?: string
  model?: string | null
  capacityKg?: string | null
}

export type UpdateDeliveryVehicleStatusPayload = {
  operationalStatus: VehicleOperationalStatus
}
