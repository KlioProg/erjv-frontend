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
  isActive?: boolean
}

export type UpdateDeliveryVehicleDetailsPayload = {
  plateNumber?: string
  vehicleType?: string
  model?: string | null
  capacity?: string | null
}

export type UpdateDeliveryVehicleStatusPayload = {
  status: VehicleStatus
}
