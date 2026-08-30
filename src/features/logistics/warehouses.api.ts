import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateWarehousePayload,
  UpdateWarehouseDetailsPayload,
  Warehouse,
} from './warehouses.types'

const STORAGE_KEY = 'erjv_db_warehouses_v6'

const INITIAL_WAREHOUSES: Warehouse[] = []

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
    const response = await apiClient.get('/warehouses')
    const list = extractArray<Warehouse>(response.data)
    if (Array.isArray(response.data) || list.length > 0) {
      saveStoredWarehouses(list)
      return list.filter((w) => w.isActive)
    }
  } catch {
    // Graceful fallback
  }
  return getStoredWarehouses().filter((w) => w.isActive)
}

export async function fetchAllWarehousesApi(): Promise<Warehouse[]> {
  try {
    const response = await apiClient.get('/warehouses/all')
    const list = extractArray<Warehouse>(response.data)
    if (Array.isArray(response.data) || list.length > 0) {
      saveStoredWarehouses(list)
      return list
    }
  } catch {
    // Graceful fallback
  }
  return getStoredWarehouses()
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

  const { data } = await apiClient.post<Warehouse>('/warehouses', cleanPayload)
  if (data && data.id) {
    const current = getStoredWarehouses()
    saveStoredWarehouses([data, ...current.filter((w) => w.id !== data.id)])
    return data
  }
  throw new Error('Failed to create warehouse in database')
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

  const { data } = await apiClient.patch<Warehouse>(`/warehouses/${id}/details`, cleanPayload)
  if (data && data.id) {
    const current = getStoredWarehouses()
    saveStoredWarehouses(current.map((w) => (w.id === id ? data : w)))
    return data
  }
  throw new Error('Failed to update warehouse in database')
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
