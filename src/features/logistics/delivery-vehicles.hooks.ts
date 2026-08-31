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
import { getErrorMessage } from '@/lib/api-client'

export const VEHICLES_QUERY_KEY = ['delivery-vehicles'] as const
export function useDeliveryVehicles() {
  return useQuery({
    queryKey: VEHICLES_QUERY_KEY,
    queryFn: fetchDeliveryVehiclesApi,
  })
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
    mutationFn: ({
      id,
      status,
    }: {
      id: number
      status: VehicleStatus
      destinationLocation?: string | null
    }) => updateVehicleStatusApi(id, status),
    onSuccess: (v) => {
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      toast.success(`Vehicle "${v.plateNumber}" status set to ${v.status}`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeactivateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vehicle: DeliveryVehicle | number) => {
      const id = typeof vehicle === 'number' ? vehicle : vehicle.id
      return await deactivateVehicleApi(id)
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      toast.success(`Vehicle "${data.plateNumber || 'Fleet asset'}" deactivated and moved to archive`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useReactivateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      return await reactivateVehicleApi(id)
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      toast.success(`Vehicle "${data.plateNumber || 'Fleet asset'}" reactivated and restored to active fleet`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export { fetchVehicleByPlateNumberApi }
