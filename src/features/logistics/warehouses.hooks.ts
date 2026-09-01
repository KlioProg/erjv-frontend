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

export function useDeactivateWarehouse(options?: { onViewArchive?: () => void }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (whOrId: Warehouse | number) => {
      const id = typeof whOrId === 'number' ? whOrId : whOrId.id
      const res = await deactivateWarehouseApi(id)
      return { res, inputWarehouse: typeof whOrId === 'object' ? whOrId : null, id }
    },
    onMutate: async (whOrId) => {
      await queryClient.cancelQueries({ queryKey: [...WAREHOUSES_QUERY_KEY, 'true'] })
      const previousWarehouses = queryClient.getQueryData<Warehouse[]>([
        ...WAREHOUSES_QUERY_KEY,
        'true',
      ])
      const targetId = typeof whOrId === 'number' ? whOrId : whOrId.id

      queryClient.setQueryData<Warehouse[]>([...WAREHOUSES_QUERY_KEY, 'true'], (old) => {
        if (!old) return []
        return old.map((w) => (w.id === targetId ? { ...w, isActive: false } : w))
      })

      return { previousWarehouses }
    },
    onError: (err, _, context) => {
      if (context?.previousWarehouses) {
        queryClient.setQueryData([...WAREHOUSES_QUERY_KEY, 'true'], context.previousWarehouses)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
    },
    onSuccess: ({ res, inputWarehouse }) => {
      const name = res?.name || inputWarehouse?.name || 'Facility'
      toast.success(`Warehouse "${name}" archived`, {
        description: 'Facility moved to the Archived Hubs tab.',
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

export function useReactivateWarehouse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (idOrWh: number | Warehouse) => {
      const id = typeof idOrWh === 'number' ? idOrWh : idOrWh.id
      const res = await reactivateWarehouseApi(id)
      return { res, id }
    },
    onMutate: async (idOrWh) => {
      await queryClient.cancelQueries({ queryKey: [...WAREHOUSES_QUERY_KEY, 'true'] })
      const previousWarehouses = queryClient.getQueryData<Warehouse[]>([
        ...WAREHOUSES_QUERY_KEY,
        'true',
      ])
      const targetId = typeof idOrWh === 'number' ? idOrWh : idOrWh.id

      queryClient.setQueryData<Warehouse[]>([...WAREHOUSES_QUERY_KEY, 'true'], (old) => {
        if (!old) return []
        return old.map((w) => (w.id === targetId ? { ...w, isActive: true } : w))
      })

      return { previousWarehouses }
    },
    onError: (err, _, context) => {
      if (context?.previousWarehouses) {
        queryClient.setQueryData([...WAREHOUSES_QUERY_KEY, 'true'], context.previousWarehouses)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
    },
    onSuccess: ({ res }) => {
      toast.success(
        `Warehouse "${res?.name || 'Facility'}" reactivated and restored to active hubs`,
      )
    },
  })
}

export { fetchWarehouseByNameApi }
