import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createWarehouseApi,
  deactivateWarehouseApi,
  fetchAllWarehousesApi,
  fetchWarehousesApi,
  reactivateWarehouseApi,
  updateWarehouseDetailsApi,
} from './warehouses.api'
import type {
  CreateWarehousePayload,
  UpdateWarehouseDetailsPayload,
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
    mutationFn: (id: number) => deactivateWarehouseApi(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success('Warehouse deactivated')
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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: WAREHOUSES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success('Warehouse reactivated')
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
