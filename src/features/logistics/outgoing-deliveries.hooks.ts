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
  createOutgoingDeliveryDraftApi,
  updateOutgoingDeliveryDraftApi,
  fetchOutgoingPlanningOptionsApi,
} from './outgoing-deliveries.api'
import type {
  CreateOutgoingDeliveryPayload,
  CompleteOutgoingDeliveryPayload,
  DispatchOutgoingDeliveryPayload,
  OutgoingDeliveryFilter,
  CreateOutgoingDeliveryDraftPayload,
  UpdateOutgoingDeliveryDraftPayload,
} from './outgoing-deliveries.types'
import { VEHICLES_QUERY_KEY } from './delivery-vehicles.hooks'
import { STOCK_ITEMS_QUERY_KEY } from './stock-items.hooks'
import { getErrorMessage } from '@/lib/api-client'

export const DELIVERIES_QUERY_KEY = ['outgoing-deliveries'] as const
export const SALES_ORDERS_QUERY_KEY = ['sales-orders'] as const

export function useOutgoingPlanningOptions(salesOrderId?: number, warehouseId?: number) {
  return useQuery({
    queryKey: [...DELIVERIES_QUERY_KEY, 'planning-options', salesOrderId, warehouseId],
    queryFn: () => fetchOutgoingPlanningOptionsApi(salesOrderId!, warehouseId!),
    enabled: Boolean(salesOrderId && warehouseId),
    staleTime: 0,
  })
}

export function useCreateOutgoingDeliveryDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: (payload: CreateOutgoingDeliveryDraftPayload) =>
      createOutgoingDeliveryDraftApi(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
    },
  })
}

export function useUpdateOutgoingDeliveryDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: ({ id, payload }: { id: number; payload: UpdateOutgoingDeliveryDraftPayload }) =>
      updateOutgoingDeliveryDraftApi(id, payload),
    onSuccess: (delivery) => {
      queryClient.setQueryData([...DELIVERIES_QUERY_KEY, 'id', delivery.id], delivery)
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
    },
  })
}

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

export function useCreateOutgoingDelivery(options?: { notifySuccess?: boolean }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateOutgoingDeliveryPayload) => createOutgoingDeliveryApi(payload),
    onSuccess: (newDelivery) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      if (options?.notifySuccess !== false)
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
    retry: false,
    mutationFn: async (command: { id: number; expectedRevision: number }) => {
      const id = command.id
      const delivery = await scheduleOutgoingDeliveryApi(id, command.expectedRevision)
      if (delivery.id !== id || delivery.status !== 'SCHEDULED')
        throw new Error(
          'The server did not confirm scheduling this delivery. Review it in Outgoing Deliveries before retrying.',
        )
      return delivery
    },
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
      toast.success(`Delivery "${delivery.deliveryNumber}" scheduled successfully`)
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDispatchOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: DispatchOutgoingDeliveryPayload
    }) => {
      const delivery = await dispatchOutgoingDeliveryApi(id, payload)
      if (delivery?.id !== id || delivery.status !== 'DISPATCHED')
        throw new Error(
          'The server did not confirm dispatch. Refresh this shipment and review its status before trying again.',
        )
      return delivery
    },
    onSuccess: async (delivery) => {
      queryClient.setQueryData([...DELIVERIES_QUERY_KEY, 'id', delivery.id], delivery)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['warehouses'] }),
      ])
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
    retry: false,
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number
      payload: CompleteOutgoingDeliveryPayload
    }) => {
      const delivery = await completeOutgoingDeliveryApi(id, payload)
      if (delivery?.id !== id || delivery.status !== 'DELIVERED')
        throw new Error(
          'The server did not confirm completion. Refresh this delivery and review its status before trying again.',
        )
      return delivery
    },
    onSuccess: async (delivery) => {
      queryClient.setQueryData([...DELIVERIES_QUERY_KEY, 'id', delivery.id], delivery)
      await Promise.all(
        [
          DELIVERIES_QUERY_KEY,
          VEHICLES_QUERY_KEY,
          STOCK_ITEMS_QUERY_KEY,
          SALES_ORDERS_QUERY_KEY,
          ['products'],
          ['warehouses'],
          ['quarantine-lots'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      toast.success(`Delivery "${delivery.deliveryNumber}" reconciliation confirmed`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCancelOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: (id: number) => cancelOutgoingDeliveryApi(id),
    onSuccess: async (delivery) => {
      await Promise.all([
        DELIVERIES_QUERY_KEY, VEHICLES_QUERY_KEY, STOCK_ITEMS_QUERY_KEY, SALES_ORDERS_QUERY_KEY,
        ['products'], ['warehouses'],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      toast.info(`Delivery "${delivery.deliveryNumber}" has been cancelled`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
