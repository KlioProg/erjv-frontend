import { apiClient } from '@/lib/api-client'
import type {
  CreateWarehousePayload,
  UpdateWarehouseDetailsPayload,
  Warehouse,
} from './warehouses.types'

const STORAGE_KEY = 'erjv_db_warehouses_v5'

const INITIAL_WAREHOUSES: Warehouse[] = [
  {
    id: 1,
    name: 'Central Logistics & Distribution Complex',
    address: 'Lanang Logistics Industrial Park, Davao City',
    contactNumber: '+63 (82) 234-5678',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    name: 'Panabo Regional Fulfillment Depot',
    address: 'National Highway Km 32, Panabo City, Davao del Norte',
    contactNumber: '+63 (84) 628-9012',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 3,
    name: 'Toril Wholesale Distribution Hub',
    address: 'Crossing Bayabas, Toril District, Davao City',
    contactNumber: '+63 (82) 291-3456',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 4,
    name: 'Matina Dry & Liquid Storage Facility',
    address: 'McArthur Highway, Matina Enclaves, Davao City',
    contactNumber: '+63 (82) 297-7890',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function getStoredWarehouses(): Warehouse[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Ignore JSON parse error
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_WAREHOUSES))
  return INITIAL_WAREHOUSES
}

function saveStoredWarehouses(items: Warehouse[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export async function fetchWarehousesApi(): Promise<Warehouse[]> {
  try {
    const { data } = await apiClient.get<Warehouse[]>('/warehouses')
    if (Array.isArray(data) && data.length > 0) {
      saveStoredWarehouses(data)
      return data
    }
  } catch {
    // Graceful fallback
  }
  return getStoredWarehouses().filter((w) => w.isActive)
}

export async function fetchWarehouseByIdApi(id: number): Promise<Warehouse> {
  try {
    const { data } = await apiClient.get<Warehouse>(`/warehouses/${id}`)
    return data
  } catch {
    const found = getStoredWarehouses().find((w) => w.id === id)
    if (found) return found
    throw new Error('Warehouse not found')
  }
}

export async function createWarehouseApi(
  payload: CreateWarehousePayload
): Promise<Warehouse> {
  const cleanPayload = {
    name: payload.name.trim(),
    address: payload.address.trim(),
    ...(payload.contactNumber?.trim() ? { contactNumber: payload.contactNumber.trim() } : {}),
  }

  try {
    const { data } = await apiClient.post<Warehouse>('/warehouses', cleanPayload)
    if (data && data.id) {
      const current = getStoredWarehouses()
      saveStoredWarehouses([data, ...current.filter((w) => w.id !== data.id)])
      return data
    }
  } catch {
    // Graceful fallback
  }

  const current = getStoredWarehouses()
  const newId = current.length > 0 ? Math.max(...current.map((w) => w.id)) + 1 : 1
  const newWh: Warehouse = {
    id: newId,
    name: cleanPayload.name,
    address: cleanPayload.address,
    contactNumber: cleanPayload.contactNumber || null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  saveStoredWarehouses([...current, newWh])
  return newWh
}

export async function updateWarehouseDetailsApi(
  id: number,
  payload: UpdateWarehouseDetailsPayload
): Promise<Warehouse> {
  const cleanPayload = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.address ? { address: payload.address.trim() } : {}),
    ...(payload.contactNumber !== undefined ? { contactNumber: payload.contactNumber?.trim() || null } : {}),
  }

  try {
    const { data } = await apiClient.patch<Warehouse>(`/warehouses/${id}/details`, cleanPayload)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredWarehouses()
  const index = current.findIndex((w) => w.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      name: cleanPayload.name ?? current[index].name,
      address: cleanPayload.address ?? current[index].address,
      contactNumber: cleanPayload.contactNumber !== undefined ? cleanPayload.contactNumber : current[index].contactNumber,
      updatedAt: new Date().toISOString(),
    }
    saveStoredWarehouses(current)
    return current[index]
  }
  throw new Error('Warehouse not found')
}

export async function deactivateWarehouseApi(id: number): Promise<Warehouse> {
  try {
    const { data } = await apiClient.delete<Warehouse>(`/warehouses/${id}`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredWarehouses()
  const index = current.findIndex((w) => w.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      isActive: false,
      updatedAt: new Date().toISOString(),
    }
    saveStoredWarehouses(current)
    return current[index]
  }
  throw new Error('Warehouse not found')
}

export async function reactivateWarehouseApi(id: number): Promise<Warehouse> {
  try {
    const { data } = await apiClient.patch<Warehouse>(`/warehouses/${id}/reactivate`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredWarehouses()
  const index = current.findIndex((w) => w.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      isActive: true,
      updatedAt: new Date().toISOString(),
    }
    saveStoredWarehouses(current)
    return current[index]
  }
  throw new Error('Warehouse not found')
}
