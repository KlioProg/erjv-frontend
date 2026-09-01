import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createVehicleApi,
  deactivateVehicleApi,
  fetchAvailableVehiclesApi,
  fetchDeliveryVehiclesApi,
  fetchVehicleByPlateNumberApi,
  reactivateVehicleApi,
  updateVehicleDetailsApi,
  updateVehicleStatusApi,
} from './delivery-vehicles.api'
import type {
  CreateDeliveryVehiclePayload,
  DeliveryVehicle,
  UpdateDeliveryVehicleDetailsPayload,
  VehicleStatus,
} from './delivery-vehicles.types'
import { getErrorMessage, type FetchParams } from '@/lib/api-client'

export const VEHICLES_QUERY_KEY = ['delivery-vehicles'] as const

export function useDeliveryVehicles(params?: FetchParams) {
  return useQuery({
    queryKey: [...VEHICLES_QUERY_KEY, params?.includeInactive ?? 'false'],
    queryFn: () => fetchDeliveryVehiclesApi(params),
  })
}

export function useAllDeliveryVehicles() {
  return useDeliveryVehicles({ includeInactive: 'true' })
}

export function useAvailableVehicles() {
  return useQuery({
    queryKey: [...VEHICLES_QUERY_KEY, 'available'],
    queryFn: fetchAvailableVehiclesApi,
  })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDeliveryVehiclePayload) => createVehicleApi(payload),
    onSuccess: (newV) => {
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      toast.success(`Vehicle "${newV.plateNumber}" registered successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateVehicleDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateDeliveryVehicleDetailsPayload }) =>
      updateVehicleDetailsApi(id, payload),
    onSuccess: (updatedV) => {
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      toast.success(`Vehicle "${updatedV.plateNumber}" updated successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateVehicleStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: number; status: VehicleStatus }) =>
      updateVehicleStatusApi(id, status),
    onSuccess: (v) => {
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      toast.success(`Vehicle "${v.plateNumber}" status set to ${v.status}`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeactivateVehicle(options?: { onViewArchive?: () => void }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vehicle: DeliveryVehicle | number) => {
      const id = typeof vehicle === 'number' ? vehicle : vehicle.id
      const res = await deactivateVehicleApi(id)
      return { res, inputVehicle: typeof vehicle === 'object' ? vehicle : null, id }
    },
    onMutate: async (vehicle) => {
      await queryClient.cancelQueries({ queryKey: [...VEHICLES_QUERY_KEY, 'true'] })
      const previousVehicles = queryClient.getQueryData<DeliveryVehicle[]>([
        ...VEHICLES_QUERY_KEY,
        'true',
      ])
      const targetId = typeof vehicle === 'number' ? vehicle : vehicle.id

      queryClient.setQueryData<DeliveryVehicle[]>([...VEHICLES_QUERY_KEY, 'true'], (old) => {
        if (!old) return []
        return old.map((v) => (v.id === targetId ? { ...v, isActive: false } : v))
      })

      return { previousVehicles }
    },
    onError: (err, _, context) => {
      if (context?.previousVehicles) {
        queryClient.setQueryData([...VEHICLES_QUERY_KEY, 'true'], context.previousVehicles)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
    },
    onSuccess: ({ res, inputVehicle }) => {
      const plate = res?.plateNumber || inputVehicle?.plateNumber || 'Fleet asset'
      toast.success(`Vehicle "${plate}" archived`, {
        description: 'Vehicle moved to the Archived Fleet tab.',
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

export function useReactivateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (idOrVehicle: number | DeliveryVehicle) => {
      const id = typeof idOrVehicle === 'number' ? idOrVehicle : idOrVehicle.id
      const res = await reactivateVehicleApi(id)
      return { res, id }
    },
    onMutate: async (idOrVehicle) => {
      await queryClient.cancelQueries({ queryKey: [...VEHICLES_QUERY_KEY, 'true'] })
      const previousVehicles = queryClient.getQueryData<DeliveryVehicle[]>([
        ...VEHICLES_QUERY_KEY,
        'true',
      ])
      const targetId = typeof idOrVehicle === 'number' ? idOrVehicle : idOrVehicle.id

      queryClient.setQueryData<DeliveryVehicle[]>([...VEHICLES_QUERY_KEY, 'true'], (old) => {
        if (!old) return []
        return old.map((v) => (v.id === targetId ? { ...v, isActive: true } : v))
      })

      return { previousVehicles }
    },
    onError: (err, _, context) => {
      if (context?.previousVehicles) {
        queryClient.setQueryData([...VEHICLES_QUERY_KEY, 'true'], context.previousVehicles)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
    },
    onSuccess: ({ res }) => {
      toast.success(
        `Vehicle "${res?.plateNumber || 'Fleet asset'}" reactivated and restored to active fleet`,
      )
    },
  })
}

export { fetchVehicleByPlateNumberApi }
