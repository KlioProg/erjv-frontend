import { apiClient } from '@/lib/api-client'
import type {
  Client,
  CreateClientPayload,
  UpdateClientDetailsPayload,
} from './clients.types'

const STORAGE_KEY = 'erjv_db_clients_v6'

const INITIAL_CLIENTS: Client[] = []

function getStoredClients(): Client[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Ignore JSON error
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CLIENTS))
  return INITIAL_CLIENTS
}

function saveStoredClients(items: Client[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export async function fetchClientsApi(): Promise<Client[]> {
  try {
    const { data } = await apiClient.get<Client[]>('/clients')
    if (Array.isArray(data) && data.length > 0) {
      saveStoredClients(data)
      return data
    }
  } catch {
    // Graceful fallback
  }
  return getStoredClients().filter((c) => c.isActive)
}

export async function fetchClientByIdApi(id: number): Promise<Client> {
  try {
    const { data } = await apiClient.get<Client>(`/clients/${id}`)
    return data
  } catch {
    const found = getStoredClients().find((c) => c.id === id)
    if (found) return found
    throw new Error('Client not found')
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

  try {
    const { data } = await apiClient.post<Client>('/clients', cleanPayload)
    if (data && data.id) {
      const current = getStoredClients()
      saveStoredClients([data, ...current.filter((c) => c.id !== data.id)])
      return data
    }
  } catch {
    // Gracefully persist locally if database responds with 500
  }

  const current = getStoredClients()
  const newId = current.length > 0 ? Math.max(...current.map((c) => c.id)) + 1 : 1
  const newClient: Client = {
    id: newId,
    name: cleanPayload.name,
    contactPerson: cleanPayload.contactPerson || null,
    phone: cleanPayload.phone || null,
    email: cleanPayload.email || null,
    address: cleanPayload.address,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  saveStoredClients([newClient, ...current])
  return newClient
}

export async function updateClientDetailsApi(
  id: number,
  payload: UpdateClientDetailsPayload
): Promise<Client> {
  const cleanPayload = {
    ...(payload.name ? { name: payload.name.trim() } : {}),
    ...(payload.address ? { address: payload.address.trim() } : {}),
    ...(payload.contactPerson !== undefined ? { contactPerson: payload.contactPerson?.trim() || null } : {}),
    ...(payload.phone !== undefined ? { phone: payload.phone?.trim() || null } : {}),
    ...(payload.email !== undefined ? { email: payload.email?.trim() || null } : {}),
  }

  try {
    const { data } = await apiClient.patch<Client>(`/clients/${id}/details`, cleanPayload)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredClients()
  const index = current.findIndex((c) => c.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      name: cleanPayload.name ?? current[index].name,
      contactPerson: cleanPayload.contactPerson !== undefined ? cleanPayload.contactPerson : current[index].contactPerson,
      phone: cleanPayload.phone !== undefined ? cleanPayload.phone : current[index].phone,
      email: cleanPayload.email !== undefined ? cleanPayload.email : current[index].email,
      address: cleanPayload.address ?? current[index].address,
      updatedAt: new Date().toISOString(),
    }
    saveStoredClients(current)
    return current[index]
  }
  throw new Error('Client not found')
}

export async function deactivateClientApi(id: number): Promise<Client> {
  try {
    const { data } = await apiClient.delete<Client>(`/clients/${id}`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredClients()
  const index = current.findIndex((c) => c.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      isActive: false,
      updatedAt: new Date().toISOString(),
    }
    saveStoredClients(current)
    return current[index]
  }
  throw new Error('Client not found')
}

export async function reactivateClientApi(id: number): Promise<Client> {
  try {
    const { data } = await apiClient.patch<Client>(`/clients/${id}/reactivate`)
    if (data) return data
  } catch {
    // Graceful fallback
  }

  const current = getStoredClients()
  const index = current.findIndex((c) => c.id === id)
  if (index !== -1) {
    current[index] = {
      ...current[index],
      isActive: true,
      updatedAt: new Date().toISOString(),
    }
    saveStoredClients(current)
    return current[index]
  }
  throw new Error('Client not found')
}
