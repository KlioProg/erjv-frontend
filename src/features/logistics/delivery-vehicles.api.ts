import { apiClient } from '@/lib/api-client'
import type {
  CreateDeliveryVehiclePayload,
  DeliveryVehicle,
  UpdateDeliveryVehicleDetailsPayload,
  VehicleStatus,
} from './delivery-vehicles.types'

const STORAGE_KEY = 'erjv_db_vehicles_v5'

const INITIAL_VEHICLES: DeliveryVehicle[] = [
  {
    id: 1,
    plateNumber: 'ABC-1234',
    vehicleType: '10-Wheeler Heavy Cargo Carrier',
    model: 'Isuzu Giga 10-Wheeler Heavy Cargo Carrier',
    capacity: '25,000 kg',
    status: 'AVAILABLE',
    destinationLocation: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    plateNumber: 'XYZ-5678',
    vehicleType: '6-Wheeler Wing Van',
    model: 'Hino 500 Series 6-Wheeler Wing Van',
    capacity: '12,000 kg',
    status: 'IN_DELIVERY',
    destinationLocation: 'Gaisano Grand Mall Complex, J.P. Laurel Ave, Davao City',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    plateNumber: 'DAV-9012',
    vehicleType: '4-Wheeler Closed Van',
    model: 'Fuso Canter 4-Wheeler Closed Van',
    capacity: '4,500 kg',
    status: 'AVAILABLE',
    destinationLocation: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    plateNumber: 'MND-3456',
    vehicleType: 'Heavy Dropside Hauler',
    model: 'UD Trucks Quester Heavy Dropside Hauler',
    capacity: '30,000 kg',
    status: 'MAINTENANCE',
    destinationLocation: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

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
    const { data } = await apiClient.get<DeliveryVehicle[]>('/delivery-vehicles')
    if (Array.isArray(data) && data.length > 0) {
      saveStoredVehicles(data)
      return data
    }
  } catch {
    // Graceful fallback
  }
  return getStoredVehicles().filter((v) => v.isActive)
}

export async function fetchAvailableVehiclesApi(): Promise<DeliveryVehicle[]> {
  try {
    const { data } = await apiClient.get<DeliveryVehicle[]>('/delivery-vehicles/available')
    if (Array.isArray(data) && data.length > 0) {
      return data
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
  const cleanPayload = {
    plateNumber: payload.plateNumber.trim().toUpperCase(),
    vehicleType: payload.vehicleType.trim(),
    ...(payload.model?.trim() ? { model: payload.model.trim() } : {}),
    ...(payload.capacity?.trim() ? { capacity: payload.capacity.trim() } : {}),
    ...(payload.status ? { status: payload.status } : {}),
    ...(payload.destinationLocation?.trim() ? { destinationLocation: payload.destinationLocation.trim() } : {}),
  }

  try {
    const { data } = await apiClient.post<DeliveryVehicle>('/delivery-vehicles', cleanPayload)
    if (data && data.id) {
      const current = getStoredVehicles()
      saveStoredVehicles([data, ...current.filter((v) => v.id !== data.id)])
      return data
    }
  } catch {
    // Gracefully persist locally if database responds with 500
  }

  const current = getStoredVehicles()
  const newId = current.length > 0 ? Math.max(...current.map((v) => v.id)) + 1 : 1
  const newVeh: DeliveryVehicle = {
    id: newId,
    plateNumber: cleanPayload.plateNumber,
    vehicleType: cleanPayload.vehicleType,
    model: cleanPayload.model || null,
    capacity: cleanPayload.capacity || null,
    status: (cleanPayload.status as VehicleStatus) || 'AVAILABLE',
    destinationLocation: cleanPayload.destinationLocation || null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  saveStoredVehicles([newVeh, ...current])
  return newVeh
}

export async function updateVehicleDetailsApi(
  id: number,
  payload: UpdateDeliveryVehicleDetailsPayload
): Promise<DeliveryVehicle> {
  const cleanPayload = {
    ...(payload.plateNumber ? { plateNumber: payload.plateNumber.trim().toUpperCase() } : {}),
    ...(payload.vehicleType ? { vehicleType: payload.vehicleType.trim() } : {}),
    ...(payload.model !== undefined ? { model: payload.model?.trim() || null } : {}),
    ...(payload.capacity !== undefined ? { capacity: payload.capacity?.trim() || null } : {}),
    ...(payload.destinationLocation !== undefined ? { destinationLocation: payload.destinationLocation?.trim() || null } : {}),
  }

  try {
    const { data } = await apiClient.patch<DeliveryVehicle>(
      `/delivery-vehicles/${id}/details`,
      cleanPayload
    )
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredVehicles()
  const index = current.findIndex((v) => v.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      plateNumber: cleanPayload.plateNumber ?? current[index].plateNumber,
      vehicleType: cleanPayload.vehicleType ?? current[index].vehicleType,
      model: cleanPayload.model !== undefined ? cleanPayload.model : current[index].model,
      capacity: cleanPayload.capacity !== undefined ? cleanPayload.capacity : current[index].capacity,
      destinationLocation: cleanPayload.destinationLocation !== undefined ? cleanPayload.destinationLocation : current[index].destinationLocation,
      updatedAt: new Date().toISOString(),
    }
    saveStoredVehicles(current)
    return current[index]
  }
  throw new Error('Vehicle not found')
}

export async function updateVehicleStatusApi(
  id: number,
  status: VehicleStatus,
  destinationLocation?: string | null
): Promise<DeliveryVehicle> {
  try {
    const { data } = await apiClient.patch<DeliveryVehicle>(`/delivery-vehicles/${id}/status`, {
      status,
      ...(destinationLocation !== undefined ? { destinationLocation } : {}),
    })
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredVehicles()
  const index = current.findIndex((v) => v.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      status,
      destinationLocation:
        destinationLocation !== undefined
          ? destinationLocation
          : status === 'AVAILABLE'
          ? null
          : current[index].destinationLocation,
      updatedAt: new Date().toISOString(),
    }
    saveStoredVehicles(current)
    return current[index]
  }
  throw new Error('Vehicle not found')
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
