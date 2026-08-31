import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createWarehouseApi,
  deactivateWarehouseApi,
  fetchAllWarehousesApi,
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
import { getErrorMessage } from '@/lib/api-client'

export const WAREHOUSES_QUERY_KEY = ['warehouses'] as const

export function useWarehouses() {
  return useQuery({
    queryKey: WAREHOUSES_QUERY_KEY,
    queryFn: fetchWarehousesApi,
  })
}

export function useAllWarehouses() {
  return useQuery({
    queryKey: [...WAREHOUSES_QUERY_KEY, 'all'],
    queryFn: fetchAllWarehousesApi,
  })
}

export function useDeactivatedWarehouses() {
  return useQuery<Warehouse[]>({
    queryKey: ['warehouses', 'deactivated'],
    queryFn: async () => {
      try {
        const all = await fetchAllWarehousesApi()
        return all.filter((w) => w.isActive === false)
      } catch {
        return []
      }
    },
    staleTime: 0,
  })
}

export function useCreateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateWarehousePayload) => createWarehouseApi(payload),
    onSuccess: (newWh) => {
      queryClient.setQueryData<Warehouse[]>(['warehouses', 'deactivated'], (old = []) =>
        old.filter((w) => w.id !== newWh.id && w.name.toLowerCase() !== newWh.name.toLowerCase())
      )
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: [...WAREHOUSES_QUERY_KEY, 'all'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses', 'deactivated'] })
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
    onSuccess: ({ res, inputWarehouse, id }) => {
      const targetId = res?.id || inputWarehouse?.id || id
      const name = res?.name || inputWarehouse?.name || 'Facility'
      if (res || inputWarehouse) {
        const entry: Warehouse = res || { ...(inputWarehouse as Warehouse), isActive: false }
        queryClient.setQueryData<Warehouse[]>(['warehouses', 'deactivated'], (old = []) => [
          ...old.filter((w) => w.id !== targetId),
          { ...entry, isActive: false },
        ])
      }
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: [...WAREHOUSES_QUERY_KEY, 'all'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses', 'deactivated'] })
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
      queryClient.setQueryData<Warehouse[]>(['warehouses', 'deactivated'], (old = []) =>
        old.filter((w) => w.id !== data.id)
      )
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: [...WAREHOUSES_QUERY_KEY, 'all'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses', 'deactivated'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(`Warehouse "${data?.name || 'Facility'}" reactivated and restored to active hubs`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export { fetchWarehouseByNameApi }
