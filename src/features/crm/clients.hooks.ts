import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createClientApi,
  deactivateClientApi,
  fetchClientByIdApi,
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
import { addArchivedId, getArchivedIds, removeArchivedId } from '@/lib/archived-storage'

export const CLIENTS_QUERY_KEY = ['clients'] as const
const ARCHIVED_CLIENTS_KEY = 'erjv_archived_clients'

export function useClients() {
  return useQuery({
    queryKey: CLIENTS_QUERY_KEY,
    queryFn: fetchClientsApi,
  })
}

export function useDeactivatedClients() {
  return useQuery<Client[]>({
    queryKey: ['clients', 'deactivated'],
    queryFn: async () => {
      let activeClients: Client[] = []
      try {
        activeClients = await fetchClientsApi()
      } catch {
        // Ignore
      }

      const activeIds = activeClients.map((c) => c.id)
      const maxId = activeIds.length > 0 ? Math.max(...activeIds) : 0
      const scanUpperLimit = Math.max(maxId + 5, 20)
      const storedIds = getArchivedIds(ARCHIVED_CLIENTS_KEY)

      const candidateIds = new Set<number>([
        ...storedIds,
        ...Array.from({ length: scanUpperLimit }, (_, i) => i + 1),
      ])

      const results: Client[] = []
      const promises = Array.from(candidateIds).map(async (id) => {
        try {
          const client = await fetchClientByIdApi(id)
          if (client && client.isActive === false) {
            results.push(client)
            addArchivedId(ARCHIVED_CLIENTS_KEY, id)
          } else if (client && client.isActive !== false) {
            removeArchivedId(ARCHIVED_CLIENTS_KEY, id)
          }
        } catch {
          // If deleted or not found, skip
        }
      })

      await Promise.all(promises)
      return results.sort((a, b) => a.id - b.id)
    },
    staleTime: 0,
  })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateClientPayload) => createClientApi(payload),
    onSuccess: (newClient) => {
      removeArchivedId(ARCHIVED_CLIENTS_KEY, newClient.id)
      queryClient.setQueryData<Client[]>(['clients', 'deactivated'], (old = []) =>
        old.filter((c) => c.id !== newClient.id && c.name.toLowerCase() !== newClient.name.toLowerCase())
      )
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
      return { res, inputClient: typeof clientOrId === 'object' ? clientOrId : null, id }
    },
    onSuccess: ({ res, inputClient, id }) => {
      const targetId = res?.id || inputClient?.id || id
      const name = res?.name || inputClient?.name || 'Account'
      addArchivedId(ARCHIVED_CLIENTS_KEY, targetId)
      if (res || inputClient) {
        const entry: Client = res || { ...(inputClient as Client), isActive: false }
        queryClient.setQueryData<Client[]>(['clients', 'deactivated'], (old = []) => [
          ...old.filter((c) => c.id !== targetId),
          { ...entry, isActive: false },
        ])
      }
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['clients', 'deactivated'] })
      toast.success(`Client "${name}" deactivated and moved to archive`)
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
      return await reactivateClientApi(id)
    },
    onSuccess: (data) => {
      removeArchivedId(ARCHIVED_CLIENTS_KEY, data.id)
      queryClient.setQueryData<Client[]>(['clients', 'deactivated'], (old = []) =>
        old.filter((c) => c.id !== data.id)
      )
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['clients', 'deactivated'] })
      toast.success(`Client "${data.name || 'Account'}" reactivated and restored to active directory`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export { searchClientsByNameApi }
