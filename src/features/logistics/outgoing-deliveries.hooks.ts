import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelOutgoingDeliveryApi,
  completeOutgoingDeliveryApi,
  createOutgoingDeliveryApi,
  dispatchOutgoingDeliveryApi,
  fetchOutgoingDeliveriesApi,
  fetchOutgoingDeliveryByIdApi,
  fetchOutgoingDeliveryByNumberApi,
  scheduleOutgoingDeliveryApi,
} from './outgoing-deliveries.api'
import type {
  CreateOutgoingDeliveryPayload,
  DispatchOutgoingDeliveryPayload,
  OutgoingDeliveryFilter,
} from './outgoing-deliveries.types'
import { VEHICLES_QUERY_KEY } from './delivery-vehicles.hooks'
import { STOCK_ITEMS_QUERY_KEY } from './stock-items.hooks'
import { getErrorMessage } from '@/lib/api-client'

export const DELIVERIES_QUERY_KEY = ['outgoing-deliveries'] as const
export const SALES_ORDERS_QUERY_KEY = ['sales-orders'] as const

export function useOutgoingDeliveries(filter?: OutgoingDeliveryFilter) {
  return useQuery({
    queryKey: [
      ...DELIVERIES_QUERY_KEY,
      filter?.status ?? 'ALL',
      filter?.salesOrderId ?? 'ALL',
      filter?.warehouseId ?? 'ALL',
    ],
    queryFn: () => fetchOutgoingDeliveriesApi(filter),
  })
}

export function useOutgoingDeliveryById(id?: number) {
  return useQuery({
    queryKey: [...DELIVERIES_QUERY_KEY, 'id', id],
    queryFn: () => (id ? fetchOutgoingDeliveryByIdApi(id) : Promise.reject('No ID provided')),
    enabled: Boolean(id && id > 0),
  })
}

export function useOutgoingDeliveryByNumber(deliveryNumber?: string) {
  return useQuery({
    queryKey: [...DELIVERIES_QUERY_KEY, 'number', deliveryNumber?.trim() || ''],
    queryFn: () =>
      deliveryNumber?.trim()
        ? fetchOutgoingDeliveryByNumberApi(deliveryNumber.trim())
        : Promise.resolve(null),
    enabled: Boolean(deliveryNumber && deliveryNumber.trim().length > 0),
  })
}

export function useCreateOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOutgoingDeliveryPayload) => createOutgoingDeliveryApi(payload),
    onSuccess: (newDelivery) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      toast.success(`Delivery shipment "${newDelivery.deliveryNumber}" created successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useScheduleOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => scheduleOutgoingDeliveryApi(id),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
      toast.success(`Delivery "${delivery.deliveryNumber}" scheduled successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDispatchOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: DispatchOutgoingDeliveryPayload }) =>
      dispatchOutgoingDeliveryApi(id, payload),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      toast.success(`Delivery "${delivery.deliveryNumber}" dispatched to transit`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCompleteOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => completeOutgoingDeliveryApi(id),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      toast.success(`Delivery "${delivery.deliveryNumber}" marked as DELIVERED. Inventory updated.`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCancelOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cancelOutgoingDeliveryApi(id),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY })
      toast.info(`Delivery "${delivery.deliveryNumber}" has been cancelled`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
