import { apiClient, extractArray, type FetchParams } from '@/lib/api-client'
import type { Client, CreateClientPayload, UpdateClientDetailsPayload } from './clients.types'

export async function fetchClientsApi(params?: FetchParams): Promise<Client[]> {
  const response = await apiClient.get('/clients', { params })
  return extractArray<Client>(response.data)
}

export async function fetchClientByIdApi(id: number): Promise<Client> {
  const { data } = await apiClient.get<Client>(`/clients/${id}`)
  return data
}

export async function searchClientsByNameApi(name: string): Promise<Client[]> {
  try {
    const response = await apiClient.get(`/clients/search/${encodeURIComponent(name.trim())}`)
    return extractArray<Client>(response.data)
  } catch {
    return []
  }
}

export async function createClientApi(payload: CreateClientPayload): Promise<Client> {
  const cleanPayload = {
    name: payload.name.trim(),
    address: payload.address.trim(),
    ...(payload.contactPerson?.trim() ? { contactPerson: payload.contactPerson.trim() } : {}),
    ...(payload.phone?.trim() ? { phone: payload.phone.trim() } : {}),
    ...(payload.email?.trim() ? { email: payload.email.trim() } : {}),
    ...(payload.isActive !== undefined ? { isActive: payload.isActive } : {}),
  }

  const { data } = await apiClient.post<Client>('/clients', cleanPayload)
  return data
}

export async function updateClientDetailsApi(
  id: number,
  payload: UpdateClientDetailsPayload,
): Promise<Client> {
  const cleanPayload = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.address ? { address: payload.address.trim() } : {}),
    ...(payload.contactPerson !== undefined
      ? { contactPerson: payload.contactPerson?.trim() || null }
      : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
    ...(payload.email !== undefined ? { email: payload.email?.trim() || null } : {}),
  }

  const { data } = await apiClient.patch<Client>(`/clients/${id}/details`, cleanPayload)
  return data
}

export async function deactivateClientApi(id: number): Promise<Client> {
  const { data } = await apiClient.delete<Client>(`/clients/${id}`)
  return data
}

export async function reactivateClientApi(id: number): Promise<Client> {
  const { data } = await apiClient.patch<Client>(`/clients/${id}/reactivate`)
  return data
}
