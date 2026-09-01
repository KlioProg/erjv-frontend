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
import type { Client, CreateClientPayload, UpdateClientDetailsPayload } from './clients.types'
import { getErrorMessage, type FetchParams } from '@/lib/api-client'

export const CLIENTS_QUERY_KEY = ['clients'] as const

export function useClients(params?: FetchParams) {
  return useQuery({
    queryKey: [...CLIENTS_QUERY_KEY, params?.includeInactive ?? 'false'],
    queryFn: () => fetchClientsApi(params),
  })
}

export function useAllClients() {
  return useClients({ includeInactive: 'true' })
}

export function useCreateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateClientPayload) => createClientApi(payload),
    onSuccess: (newClient) => {
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

export function useDeactivateClient(options?: { onViewArchive?: () => void }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (clientOrId: Client | number) => {
      const id = typeof clientOrId === 'number' ? clientOrId : clientOrId.id
      const res = await deactivateClientApi(id)
      return { res, inputClient: typeof clientOrId === 'object' ? clientOrId : null, id }
    },
    onMutate: async (clientOrId) => {
      await queryClient.cancelQueries({ queryKey: [...CLIENTS_QUERY_KEY, 'true'] })
      const previousClients = queryClient.getQueryData<Client[]>([...CLIENTS_QUERY_KEY, 'true'])
      const targetId = typeof clientOrId === 'number' ? clientOrId : clientOrId.id

      queryClient.setQueryData<Client[]>([...CLIENTS_QUERY_KEY, 'true'], (old) => {
        if (!old) return []
        return old.map((c) => (c.id === targetId ? { ...c, isActive: false } : c))
      })

      return { previousClients }
    },
    onError: (err, _, context) => {
      if (context?.previousClients) {
        queryClient.setQueryData([...CLIENTS_QUERY_KEY, 'true'], context.previousClients)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
    },
    onSuccess: ({ res, inputClient }) => {
      const name = res?.name || inputClient?.name || 'Account'
      toast.success(`Client "${name}" archived`, {
        description: 'Client profile moved to the Archived Clients tab.',
        action: options?.onViewArchive
          ? {
              label: 'View in Archive',
              onClick: options.onViewArchive,
            }
          : undefined,
      })
    },
  })
}

export function useReactivateClient() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (idOrClient: number | Client) => {
      const id = typeof idOrClient === 'number' ? idOrClient : idOrClient.id
      const res = await reactivateClientApi(id)
      return { res, id }
    },
    onMutate: async (idOrClient) => {
      await queryClient.cancelQueries({ queryKey: [...CLIENTS_QUERY_KEY, 'true'] })
      const previousClients = queryClient.getQueryData<Client[]>([...CLIENTS_QUERY_KEY, 'true'])
      const targetId = typeof idOrClient === 'number' ? idOrClient : idOrClient.id

      queryClient.setQueryData<Client[]>([...CLIENTS_QUERY_KEY, 'true'], (old) => {
        if (!old) return []
        return old.map((c) => (c.id === targetId ? { ...c, isActive: true } : c))
      })

      return { previousClients }
    },
    onError: (err, _, context) => {
      if (context?.previousClients) {
        queryClient.setQueryData([...CLIENTS_QUERY_KEY, 'true'], context.previousClients)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
    },
    onSuccess: ({ res }) => {
      toast.success(
        `Client "${res.name || 'Account'}" reactivated and restored to active directory`,
      )
    },
  })
}

export { searchClientsByNameApi }
