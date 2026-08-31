import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createClientApi,
  deactivateClientApi,
  fetchClientsApi,
  reactivateClientApi,
  searchClientsByNameApi,
  updateClientDetailsApi,
} from './clients.api'
import type {
  Client,
  CreateClientPayload,
  UpdateClientDetailsPayload,
} from './clients.types'
import { getErrorMessage } from '@/lib/api-client'

export const CLIENTS_QUERY_KEY = ['clients'] as const
const ARCHIVED_CLIENTS_KEY = 'erjv_archived_clients'

export function getArchivedClients(): Client[] {
  try {
    const raw = localStorage.getItem(ARCHIVED_CLIENTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveArchivedClient(client: Client) {
  const current = getArchivedClients().filter(
    (c) => c.id !== client.id && c.name.toUpperCase().trim() !== client.name.toUpperCase().trim()
  )
  current.push({ ...client, isActive: false })
  localStorage.setItem(ARCHIVED_CLIENTS_KEY, JSON.stringify(current))
}

export function removeArchivedClient(idOrName: number | string) {
  const current = getArchivedClients().filter(
    (c) => c.id !== idOrName && c.name.toUpperCase().trim() !== String(idOrName).toUpperCase().trim()
  )
  localStorage.setItem(ARCHIVED_CLIENTS_KEY, JSON.stringify(current))
}

export function useClients() {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: fetchClientsApi,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateClientPayload) => createClientApi(payload),
    onSuccess: (newClient) => {
      removeArchivedClient(newClient.name)
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
      toast.success(`Client "${newClient.name}" registered successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateClientDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateClientDetailsPayload }) =>
      updateClientDetailsApi(id, payload),
    onSuccess: (updatedClient) => {
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
      toast.success(`Client "${updatedClient.name}" updated successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeactivateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clientOrId: Client | number) => {
      const id = typeof clientOrId === 'number' ? clientOrId : clientOrId.id
      const res = await deactivateClientApi(id)
      if (typeof clientOrId !== 'number') {
        saveArchivedClient(clientOrId)
      } else if (res) {
        saveArchivedClient(res)
      }
      return res
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
      toast.success(`Client "${data.name || 'Account'}" deactivated and moved to archive`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useReactivateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await reactivateClientApi(id)
      removeArchivedClient(id)
      if (res?.name) {
        removeArchivedClient(res.name)
      }
      return res
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
      toast.success(`Client "${data.name || 'Account'}" reactivated and restored to active directory`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export { searchClientsByNameApi }
