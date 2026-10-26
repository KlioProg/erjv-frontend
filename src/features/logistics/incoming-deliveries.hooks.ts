import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelIncomingDeliveryApi,
  completeIncomingDeliveryApi,
  createIncomingDeliveryApi,
  fetchIncomingDeliveriesApi,
  fetchIncomingDeliveryByIdApi,
  fetchIncomingDeliveryByNumberApi,
  scheduleIncomingDeliveryApi,
} from './incoming-deliveries.api'
import type {
  CreateIncomingDeliveryPayload,
  CompleteIncomingDeliveryPayload,
  IncomingDeliveryFilter,
} from './incoming-deliveries.types'
import { PURCHASE_ORDERS_QUERY_KEY } from './purchase-orders.hooks'
import { STOCK_ITEMS_QUERY_KEY } from './stock-items.hooks'
import { getErrorMessage } from '@/lib/api-client'
import { QUARANTINE_QUERY_KEY } from './quarantine.hooks'

export const INCOMING_DELIVERIES_QUERY_KEY = ['incoming-deliveries'] as const

export function useIncomingDeliveries(filter?: IncomingDeliveryFilter) {
  return useQuery({
    queryKey: [
      ...INCOMING_DELIVERIES_QUERY_KEY,
      filter?.status ?? 'ALL',
      filter?.purchaseOrderId ?? 'ALL',
      filter?.warehouseId ?? 'ALL',
    ],
    queryFn: () => fetchIncomingDeliveriesApi(filter),
  })
}

export function useIncomingDeliveryById(id?: number) {
  return useQuery({
    queryKey: [...INCOMING_DELIVERIES_QUERY_KEY, 'id', id],
    queryFn: () => (id ? fetchIncomingDeliveryByIdApi(id) : Promise.reject('No ID')),
    enabled: Boolean(id && id > 0),
  })
}

export function useIncomingDeliveryByNumber(deliveryNumber?: string) {
  return useQuery({
    queryKey: [...INCOMING_DELIVERIES_QUERY_KEY, 'number', deliveryNumber?.trim() || ''],
    queryFn: () =>
      deliveryNumber?.trim()
        ? fetchIncomingDeliveryByNumberApi(deliveryNumber.trim())
        : Promise.resolve(null),
    enabled: Boolean(deliveryNumber && deliveryNumber.trim().length > 0),
  })
}

export function useCreateIncomingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: (payload: CreateIncomingDeliveryPayload) => createIncomingDeliveryApi(payload),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: INCOMING_DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      toast.success(`Incoming Delivery "${delivery.deliveryNumber}" created`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useScheduleIncomingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => scheduleIncomingDeliveryApi(id),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: INCOMING_DELIVERIES_QUERY_KEY })
      toast.success(`Incoming Delivery "${delivery.deliveryNumber}" scheduled`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCompleteIncomingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: CompleteIncomingDeliveryPayload
    }) => {
      const delivery = await completeIncomingDeliveryApi(id, payload)
      if (delivery?.id !== id || delivery.status !== 'COMPLETED')
        throw new Error(
          'The server did not confirm receiving. Refresh this delivery and review its status before trying again.',
        )
      return delivery
    },
    onSuccess: async (delivery) => {
      queryClient.setQueryData([...INCOMING_DELIVERIES_QUERY_KEY, 'id', delivery.id], delivery)
      await Promise.all(
        [
          INCOMING_DELIVERIES_QUERY_KEY,
          PURCHASE_ORDERS_QUERY_KEY,
          STOCK_ITEMS_QUERY_KEY,
          ['products'],
          ['warehouses'],
          QUARANTINE_QUERY_KEY,
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      toast.success(
        delivery.outcome === 'NO_RECEIPT'
          ? `Incoming Delivery "${delivery.deliveryNumber}" completed with no receipt`
          : `Incoming Delivery "${delivery.deliveryNumber}" receipt confirmed`,
      )
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCancelIncomingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cancelIncomingDeliveryApi(id),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: INCOMING_DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      toast.info(`Incoming Delivery "${delivery.deliveryNumber}" cancelled`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
