import { apiClient, extractArray, type FetchParams } from '@/lib/api-client'
import { parseStockCents } from './stock-display'
import { decimalString } from '@/lib/order-amounts'
import type {
  CreateDeliveryVehiclePayload,
  DeliveryVehicle,
  UpdateDeliveryVehicleDetailsPayload,
  VehicleStatus,
} from './delivery-vehicles.types'

function capacityValue(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value
  const parsed = parseStockCents(value)
  if (parsed === null || parsed > 999_999_999_999n)
    throw new Error('Enter a non-negative capacity up to 9,999,999,999.99 with at most two decimal places.')
  return decimalString(parsed)
}

export async function fetchDeliveryVehiclesApi(params?: FetchParams): Promise<DeliveryVehicle[]> {
  const response = await apiClient.get('/delivery-vehicles', { params })
  return extractArray<DeliveryVehicle>(response.data)
}

export async function fetchAvailableVehiclesApi(): Promise<DeliveryVehicle[]> {
  const response = await apiClient.get('/delivery-vehicles/available')
  return extractArray<DeliveryVehicle>(response.data)
}

export async function fetchVehicleByIdApi(id: number): Promise<DeliveryVehicle | null> {
  const { data } = await apiClient.get<DeliveryVehicle>(`/delivery-vehicles/${id}`)
  return data
}

export async function fetchVehicleByPlateNumberApi(
  plateNumber: string,
): Promise<DeliveryVehicle | null> {
  const { data } = await apiClient.get<DeliveryVehicle>(
    `/delivery-vehicles/plate-number/${encodeURIComponent(plateNumber.trim())}`,
  )
  return data
}

export async function createVehicleApi(
  payload: CreateDeliveryVehiclePayload,
): Promise<DeliveryVehicle> {
  const capacity = capacityValue(payload.capacity)
  const cleanPayload: Record<string, unknown> = {
    plateNumber: payload.plateNumber.trim().toUpperCase(),
    vehicleType: payload.vehicleType.trim(),
    ...(payload.model?.trim() ? { model: payload.model.trim() } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
    ...(payload.status ? { status: payload.status } : {}),
    isActive: true,
  }

  const { data } = await apiClient.post<DeliveryVehicle>('/delivery-vehicles', cleanPayload)
  return data
}

export async function updateVehicleDetailsApi(
  id: number,
  payload: UpdateDeliveryVehicleDetailsPayload,
): Promise<DeliveryVehicle> {
  const capacity = capacityValue(payload.capacity)
  const cleanPayload: Record<string, unknown> = {
    ...(payload.plateNumber ? { plateNumber: payload.plateNumber.trim().toUpperCase() } : {}),
    ...(payload.vehicleType ? { vehicleType: payload.vehicleType.trim() } : {}),
    ...(payload.model !== undefined ? { model: payload.model?.trim() || null } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
  }

  const { data } = await apiClient.patch<DeliveryVehicle>(
    `/delivery-vehicles/${id}/details`,
    cleanPayload,
  )
  return data
}

export async function updateVehicleStatusApi(
  id: number,
  status: VehicleStatus,
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
