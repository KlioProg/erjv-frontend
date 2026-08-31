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
      return await deactivateClientApi(id)
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
      return await reactivateClientApi(id)
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
