import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateDeliveryVehiclePayload,
  DeliveryVehicle,
  UpdateDeliveryVehicleDetailsPayload,
  VehicleStatus,
} from './delivery-vehicles.types'

export async function fetchDeliveryVehiclesApi(): Promise<DeliveryVehicle[]> {
  const response = await apiClient.get('/delivery-vehicles')
  return extractArray<DeliveryVehicle>(response.data)
}

export async function fetchAvailableVehiclesApi(): Promise<DeliveryVehicle[]> {
  const response = await apiClient.get('/delivery-vehicles/available')
  return extractArray<DeliveryVehicle>(response.data)
}

export async function fetchVehicleByIdApi(id: number): Promise<DeliveryVehicle> {
  const { data } = await apiClient.get<DeliveryVehicle>(`/delivery-vehicles/${id}`)
  return data
}

export async function createVehicleApi(
  payload: CreateDeliveryVehiclePayload
): Promise<DeliveryVehicle> {
  const parsedCap = payload.capacity ? parseFloat(String(payload.capacity)) : null
  const cleanPayload: Record<string, unknown> = {
    plateNumber: payload.plateNumber.trim().toUpperCase(),
    vehicleType: payload.vehicleType.trim(),
    ...(payload.model?.trim() ? { model: payload.model.trim() } : {}),
    ...(parsedCap !== null && !isNaN(parsedCap) ? { capacity: parsedCap.toFixed(2) } : {}),
    ...(payload.status ? { status: payload.status } : {}),
    isActive: true,
  }

  const { data } = await apiClient.post<DeliveryVehicle>('/delivery-vehicles', cleanPayload)
  return data
}

export async function updateVehicleDetailsApi(
  id: number,
  payload: UpdateDeliveryVehicleDetailsPayload
): Promise<DeliveryVehicle> {
  const parsedCap = payload.capacity ? parseFloat(String(payload.capacity)) : null
  const cleanPayload: Record<string, unknown> = {
    ...(payload.plateNumber ? { plateNumber: payload.plateNumber.trim().toUpperCase() } : {}),
    ...(payload.vehicleType ? { vehicleType: payload.vehicleType.trim() } : {}),
    ...(payload.model !== undefined ? { model: payload.model?.trim() || null } : {}),
    ...(parsedCap !== null && !isNaN(parsedCap) ? { capacity: parsedCap.toFixed(2) } : {}),
  }

  const { data } = await apiClient.patch<DeliveryVehicle>(
    `/delivery-vehicles/${id}/details`,
    cleanPayload
  )
  return data
}

export async function updateVehicleStatusApi(
  id: number,
  status: VehicleStatus
): Promise<DeliveryVehicle> {
  const { data } = await apiClient.patch<DeliveryVehicle>(`/delivery-vehicles/${id}/status`, {
    status,
  })
  return data
}

export async function deactivateVehicleApi(id: number): Promise<DeliveryVehicle> {
  const { data } = await apiClient.delete<DeliveryVehicle>(`/delivery-vehicles/${id}`)
  return data
}

export async function reactivateVehicleApi(id: number): Promise<DeliveryVehicle> {
  const { data } = await apiClient.patch<DeliveryVehicle>(`/delivery-vehicles/${id}/reactivate`)
  return data
}
