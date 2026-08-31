export const OPERATIONAL_STATUSES = [
  'AVAILABLE',
  'IN_DELIVERY',
  'MAINTENANCE',
] as const

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
  capacity: string | null
  status: VehicleStatus
  destinationLocation?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type CreateDeliveryVehiclePayload = {
  plateNumber: string
  vehicleType: string
  model?: string | null
  capacity?: string | null
  status?: VehicleStatus
  destinationLocation?: string | null
  isActive?: boolean
}

export type UpdateDeliveryVehicleDetailsPayload = {
  plateNumber?: string
  vehicleType?: string
  model?: string | null
  capacity?: string | null
  destinationLocation?: string | null
}

export type UpdateDeliveryVehicleStatusPayload = {
  status: VehicleStatus
  destinationLocation?: string | null
}
