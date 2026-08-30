import { apiClient, extractArray } from '@/lib/api-client'
import type {
  CreateWarehousePayload,
  UpdateWarehouseDetailsPayload,
  Warehouse,
} from './warehouses.types'

export async function fetchWarehousesApi(): Promise<Warehouse[]> {
  const response = await apiClient.get('/warehouses')
  return extractArray<Warehouse>(response.data)
}

export async function fetchAllWarehousesApi(): Promise<Warehouse[]> {
  const response = await apiClient.get('/warehouses')
  return extractArray<Warehouse>(response.data)
}

export async function fetchWarehouseByIdApi(id: number): Promise<Warehouse> {
  const { data } = await apiClient.get<Warehouse>(`/warehouses/${id}`)
  return data
}

export async function createWarehouseApi(
  payload: CreateWarehousePayload
): Promise<Warehouse> {
  const cleanPayload = {
    name: payload.name.trim(),
    address: payload.address.trim(),
    ...(payload.contactNumber?.trim() ? { contactNumber: payload.contactNumber.trim() } : {}),
    isActive: true,
  }

  const { data } = await apiClient.post<Warehouse>('/warehouses', cleanPayload)
  return data
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
  return data
}

export async function deactivateWarehouseApi(id: number): Promise<Warehouse> {
  const { data } = await apiClient.delete<Warehouse>(`/warehouses/${id}`)
  return data
}

export async function reactivateWarehouseApi(id: number): Promise<Warehouse> {
  const { data } = await apiClient.patch<Warehouse>(`/warehouses/${id}/reactivate`)
  return data
}
