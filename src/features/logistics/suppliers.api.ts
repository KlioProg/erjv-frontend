import { apiClient, extractArray, type FetchParams } from '@/lib/api-client'
import type { CreateSupplierPayload, Supplier, UpdateSupplierPayload } from './suppliers.types'

export async function fetchSuppliersApi(params?: FetchParams): Promise<Supplier[]> {
  const response = await apiClient.get('/suppliers', { params })
  return extractArray<Supplier>(response.data)
}

export async function fetchSupplierByIdApi(id: number): Promise<Supplier> {
  const { data } = await apiClient.get<Supplier>(`/suppliers/${id}`)
  return data
}

export async function fetchSupplierByCodeApi(code: string): Promise<Supplier | null> {
  try {
    const { data } = await apiClient.get<Supplier>(
      `/suppliers/code/${encodeURIComponent(code.trim())}`,
    )
    return data
  } catch {
    return null
  }
}

export async function createSupplierApi(payload: CreateSupplierPayload): Promise<Supplier> {
  const cleanPayload = {
    code: payload.code.trim().toUpperCase(),
    name: payload.name.trim(),
    ...(payload.contactPerson?.trim() ? { contactPerson: payload.contactPerson.trim() } : {}),
    ...(payload.phone?.trim() ? { phone: payload.phone.trim() } : {}),
    ...(payload.email?.trim() ? { email: payload.email.trim() } : {}),
    ...(payload.address?.trim() ? { address: payload.address.trim() } : {}),
  }
  const { data } = await apiClient.post<Supplier>('/suppliers', cleanPayload)
  return data
}

export async function updateSupplierApi(
  id: number,
  payload: UpdateSupplierPayload,
): Promise<Supplier> {
  const cleanPayload = {
    ...(payload.code !== undefined ? { code: payload.code.trim().toUpperCase() } : {}),
    ...(payload.name !== undefined ? { name: payload.name.trim() } : {}),
    ...(payload.contactPerson !== undefined ? { contactPerson: payload.contactPerson.trim() } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone.trim() } : {}),
    ...(payload.email !== undefined ? { email: payload.email.trim() } : {}),
    ...(payload.address !== undefined ? { address: payload.address.trim() } : {}),
  }
  const { data } = await apiClient.patch<Supplier>(`/suppliers/${id}`, cleanPayload)
  return data
}

export async function deleteSupplierApi(id: number): Promise<Supplier> {
  const { data } = await apiClient.delete<Supplier>(`/suppliers/${id}`)
  return data
}

export async function reactivateSupplierApi(id: number): Promise<Supplier> {
  const { data } = await apiClient.patch<Supplier>(`/suppliers/${id}/reactivate`)
  return data
}
