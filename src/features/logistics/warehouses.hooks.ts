import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createWarehouseApi,
  deactivateWarehouseApi,
  fetchWarehouseByNameApi,
  fetchWarehousesApi,
  reactivateWarehouseApi,
  updateWarehouseDetailsApi,
} from './warehouses.api'
import type {
  CreateWarehousePayload,
  UpdateWarehouseDetailsPayload,
  Warehouse,
} from './warehouses.types'
import { getErrorMessage, type FetchParams } from '@/lib/api-client'

export const WAREHOUSES_QUERY_KEY = ['warehouses'] as const

export function useWarehouses(params?: FetchParams) {
  return useQuery({
    queryKey: [...WAREHOUSES_QUERY_KEY, params?.includeInactive ?? 'false'],
    queryFn: () => fetchWarehousesApi(params),
  })
}

export function useAllWarehouses() {
  return useWarehouses({ includeInactive: 'true' })
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateWarehousePayload) => createWarehouseApi(payload),
    onSuccess: (newWh) => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(`Warehouse "${newWh.name}" created successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateWarehouseDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateWarehouseDetailsPayload }) =>
      updateWarehouseDetailsApi(id, payload),
    onSuccess: (updatedWh) => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: [...WAREHOUSES_QUERY_KEY, 'all'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(`Warehouse "${updatedWh.name}" updated successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeactivateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (whOrId: Warehouse | number) => {
      const id = typeof whOrId === 'number' ? whOrId : whOrId.id
      const res = await deactivateWarehouseApi(id)
      return { res, inputWarehouse: typeof whOrId === 'object' ? whOrId : null, id }
    },
    onSuccess: ({ res, inputWarehouse }) => {
      const name = res?.name || inputWarehouse?.name || 'Facility'
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(`Warehouse "${name}" deactivated and moved to archive`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useReactivateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => reactivateWarehouseApi(id),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(
        `Warehouse "${data?.name || 'Facility'}" reactivated and restored to active hubs`,
      )
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export { fetchWarehouseByNameApi }
