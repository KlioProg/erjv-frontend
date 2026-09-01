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
    onSuccess: ({ res, inputClient }) => {
      const name = res?.name || inputClient?.name || 'Account'
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
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
      void queryClient.invalidateQueries({ queryKey: CLIENTS_QUERY_KEY })
      toast.success(
        `Client "${data.name || 'Account'}" reactivated and restored to active directory`,
      )
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export { searchClientsByNameApi }
