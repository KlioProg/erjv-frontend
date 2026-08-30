import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateDeliveryVehiclePayload,
  DeliveryVehicle,
  UpdateDeliveryVehicleDetailsPayload,
  VehicleStatus,
} from './delivery-vehicles.types'

const STORAGE_KEY = 'erjv_db_vehicles_v6'

const INITIAL_VEHICLES: DeliveryVehicle[] = []

function getStoredVehicles(): DeliveryVehicle[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Ignore JSON parse error
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_VEHICLES))
  return INITIAL_VEHICLES
}

function saveStoredVehicles(items: DeliveryVehicle[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export async function fetchDeliveryVehiclesApi(): Promise<DeliveryVehicle[]> {
  try {
    const response = await apiClient.get('/delivery-vehicles')
    const list = extractArray<DeliveryVehicle>(response.data)
    if (Array.isArray(response.data) || list.length > 0) {
      saveStoredVehicles(list)
      return list
    }
  } catch {
    // Graceful fallback
  }
  return getStoredVehicles().filter((v) => v.isActive)
}

export async function fetchAvailableVehiclesApi(): Promise<DeliveryVehicle[]> {
  try {
    const response = await apiClient.get('/delivery-vehicles/available')
    const list = extractArray<DeliveryVehicle>(response.data)
    if (Array.isArray(response.data) || list.length > 0) {
      return list
    }
  } catch {
    // Graceful fallback
  }
  return getStoredVehicles().filter((v) => v.status === 'AVAILABLE' && v.isActive)
}

export async function fetchVehicleByIdApi(id: number): Promise<DeliveryVehicle> {
  try {
    const { data } = await apiClient.get<DeliveryVehicle>(`/delivery-vehicles/${id}`)
    return data
  } catch {
    const found = getStoredVehicles().find((v) => v.id === id)
    if (found) return found
    throw new Error('Vehicle not found')
  }
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
  if (data && data.id) {
    const current = getStoredVehicles()
    saveStoredVehicles([data, ...current.filter((v) => v.id !== data.id)])
    return data
  }
  throw new Error('Failed to create vehicle in database')
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
  if (data && data.id) {
    const current = getStoredVehicles()
    saveStoredVehicles(current.map((v) => (v.id === id ? data : v)))
    return data
  }
  throw new Error('Failed to update vehicle in database')
}

export async function updateVehicleStatusApi(
  id: number,
  status: VehicleStatus
): Promise<DeliveryVehicle> {
  const { data } = await apiClient.patch<DeliveryVehicle>(`/delivery-vehicles/${id}/status`, {
    status,
  })
  if (data && data.id) {
    const current = getStoredVehicles()
    saveStoredVehicles(current.map((v) => (v.id === id ? data : v)))
    return data
  }
  throw new Error('Failed to update vehicle status in database')
}

export async function deactivateVehicleApi(id: number): Promise<DeliveryVehicle> {
  try {
    const { data } = await apiClient.delete<DeliveryVehicle>(`/delivery-vehicles/${id}`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredVehicles()
  const index = current.findIndex((v) => v.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      isActive: false,
      updatedAt: new Date().toISOString(),
    }
    saveStoredVehicles(current)
    return current[index]
  }
  throw new Error('Vehicle not found')
}

export async function reactivateVehicleApi(id: number): Promise<DeliveryVehicle> {
  try {
    const { data } = await apiClient.patch<DeliveryVehicle>(`/delivery-vehicles/${id}/reactivate`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredVehicles()
  const index = current.findIndex((v) => v.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      isActive: true,
      updatedAt: new Date().toISOString(),
    }
    saveStoredVehicles(current)
    return current[index]
  }
  throw new Error('Vehicle not found')
}
