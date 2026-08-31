import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createVehicleApi,
  deactivateVehicleApi,
  fetchAvailableVehiclesApi,
  fetchDeliveryVehiclesApi,
  fetchVehicleByIdApi,
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
import { addArchivedId, getArchivedIds, removeArchivedId } from '@/lib/archived-storage'

export const VEHICLES_QUERY_KEY = ['delivery-vehicles'] as const
const ARCHIVED_VEHICLES_KEY = 'erjv_archived_vehicles'

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

export function useDeactivatedVehicles() {
  return useQuery<DeliveryVehicle[]>({
    queryKey: ['delivery-vehicles', 'deactivated'],
    queryFn: async () => {
      let activeVehicles: DeliveryVehicle[] = []
      try {
        activeVehicles = await fetchDeliveryVehiclesApi()
      } catch {
        // Ignore
      }

      const activeIds = activeVehicles.map((v) => v.id)
      const maxId = activeIds.length > 0 ? Math.max(...activeIds) : 0
      const scanUpperLimit = Math.max(maxId + 5, 20)
      const storedIds = getArchivedIds(ARCHIVED_VEHICLES_KEY)

      // Create a set of all candidate IDs to query from database
      const candidateIds = new Set<number>([
        ...storedIds,
        ...Array.from({ length: scanUpperLimit }, (_, i) => i + 1),
      ])

      const results: DeliveryVehicle[] = []
      const promises = Array.from(candidateIds).map(async (id) => {
        try {
          const v = await fetchVehicleByIdApi(id)
          if (v && v.isActive === false) {
            results.push(v)
            addArchivedId(ARCHIVED_VEHICLES_KEY, id)
          } else if (v && v.isActive !== false) {
            removeArchivedId(ARCHIVED_VEHICLES_KEY, id)
          }
        } catch {
          // If not found in DB, skip
        }
      })

      await Promise.all(promises)
      return results.sort((a, b) => a.id - b.id)
    },
    staleTime: 0,
  })
}

export function useCreateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDeliveryVehiclePayload) => createVehicleApi(payload),
    onSuccess: (newV) => {
      removeArchivedId(ARCHIVED_VEHICLES_KEY, newV.id)
      queryClient.setQueryData<DeliveryVehicle[]>(['delivery-vehicles', 'deactivated'], (old = []) =>
        old.filter((v) => v.id !== newV.id && v.plateNumber.toUpperCase() !== newV.plateNumber.toUpperCase())
      )
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

export function useDeactivateVehicle() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vehicle: DeliveryVehicle | number) => {
      const id = typeof vehicle === 'number' ? vehicle : vehicle.id
      const res = await deactivateVehicleApi(id)
      return { res, inputVehicle: typeof vehicle === 'object' ? vehicle : null, id }
    },
    onSuccess: ({ res, inputVehicle, id }) => {
      const targetId = res?.id || inputVehicle?.id || id
      const plate = res?.plateNumber || inputVehicle?.plateNumber || 'Fleet asset'
      addArchivedId(ARCHIVED_VEHICLES_KEY, targetId)
      if (res || inputVehicle) {
        const entry: DeliveryVehicle = res || { ...(inputVehicle as DeliveryVehicle), isActive: false }
        queryClient.setQueryData<DeliveryVehicle[]>(['delivery-vehicles', 'deactivated'], (old = []) => [
          ...old.filter((v) => v.id !== targetId),
          { ...entry, isActive: false },
        ])
      }
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['delivery-vehicles', 'deactivated'] })
      toast.success(`Vehicle "${plate}" deactivated and moved to archive`)
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
      removeArchivedId(ARCHIVED_VEHICLES_KEY, data.id)
      queryClient.setQueryData<DeliveryVehicle[]>(['delivery-vehicles', 'deactivated'], (old = []) =>
        old.filter((v) => v.id !== data.id)
      )
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: ['delivery-vehicles', 'deactivated'] })
      toast.success(`Vehicle "${data.plateNumber || 'Fleet asset'}" reactivated and restored to active fleet`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export { fetchVehicleByPlateNumberApi }
