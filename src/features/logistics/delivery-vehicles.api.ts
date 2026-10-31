import { fetchCursorList } from '@/lib/cursor-pagination'
import { apiClient, type FetchParams } from '@/lib/api-client'
import { parseStockCents } from './stock-display'
import { decimalString } from './purchase-pricing'
import type {
  CreateDeliveryVehiclePayload,
  DeliveryVehicle,
  UpdateDeliveryVehicleDetailsPayload,
  VehicleOperationalStatus,
} from './delivery-vehicles.types'

export async function fetchDeliveryVehiclesApi(params?: FetchParams): Promise<DeliveryVehicle[]> {
  return fetchCursorList<DeliveryVehicle>('/delivery-vehicles', params)
}

export async function fetchAvailableVehiclesApi(): Promise<DeliveryVehicle[]> {
  return fetchCursorList<DeliveryVehicle>('/delivery-vehicles/available')
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

function vehicleCapacity(value: string | number | null | undefined): string | null {
  if (value == null || String(value).trim() === '') return null
  const parsed = parseStockCents(value)
  if (parsed === null || parsed > 999_999_999_999n)
    throw new Error('Capacity must be non-negative, with up to two decimals and 10 whole digits.')
  return decimalString(parsed)
}

export async function createVehicleApi(
  payload: CreateDeliveryVehiclePayload,
): Promise<DeliveryVehicle> {
  const parsedCap = vehicleCapacity(payload.capacityKg)
  const cleanPayload: Record<string, unknown> = {
    plateNumber: payload.plateNumber.trim().toUpperCase(),
    vehicleType: payload.vehicleType.trim(),
    ...(payload.model?.trim() ? { model: payload.model.trim() } : {}),
    ...(parsedCap !== null ? { capacityKg: parsedCap } : {}),
    ...(payload.operationalStatus ? { operationalStatus: payload.operationalStatus } : {}),
    isActive: true,
  }

  const { data } = await apiClient.post<DeliveryVehicle>('/delivery-vehicles', cleanPayload)
  return data
}

export async function updateVehicleDetailsApi(
  id: number,
  payload: UpdateDeliveryVehicleDetailsPayload,
): Promise<DeliveryVehicle> {
  const parsedCap = vehicleCapacity(payload.capacityKg)
  const cleanPayload: Record<string, unknown> = {
    ...(payload.plateNumber ? { plateNumber: payload.plateNumber.trim().toUpperCase() } : {}),
    ...(payload.vehicleType ? { vehicleType: payload.vehicleType.trim() } : {}),
    ...(payload.model !== undefined ? { model: payload.model?.trim() || null } : {}),
    ...(payload.capacityKg === null ? { capacityKg: null } : {}),
    ...(parsedCap !== null ? { capacityKg: parsedCap } : {}),
  }

  const { data } = await apiClient.patch<DeliveryVehicle>(
    `/delivery-vehicles/${id}/details`,
    cleanPayload,
  )
  return data
}

export async function updateVehicleStatusApi(
  id: number,
  operationalStatus: VehicleOperationalStatus,
): Promise<DeliveryVehicle> {
  if (!['SERVICEABLE', 'MAINTENANCE', 'OUT_OF_SERVICE'].includes(operationalStatus))
    throw new Error('Choose a supported vehicle operational status.')
  const { data } = await apiClient.patch<DeliveryVehicle>(`/delivery-vehicles/${id}/status`, {
    operationalStatus,
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
