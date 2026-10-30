import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelOutgoingDeliveryApi,
  createOutgoingDeliveryApi,
  fetchOutgoingDeliveriesApi,
  fetchOutgoingDeliveryByIdApi,
  fetchOutgoingDeliveryByNumberApi,
  readyOutgoingDeliveryApi,
  reopenOutgoingDeliveryApi,
  createOutgoingDeliveryDraftApi,
  updateOutgoingDeliveryDraftApi,
  fetchOutgoingPlanningOptionsApi,
} from './outgoing-deliveries.api'
import type {
  CreateOutgoingDeliveryPayload,
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
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['delivery-vehicles'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['quarantine-lots'] })
    },
    mutationFn: (payload: CreateOutgoingDeliveryDraftPayload) =>
      createOutgoingDeliveryDraftApi(payload),
    onSuccess: async (delivery) => {
      queryClient.setQueryData([...DELIVERIES_QUERY_KEY, 'id', delivery.id], delivery)
      await queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
    },
  })
}

export function useUpdateOutgoingDeliveryDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['delivery-vehicles'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['quarantine-lots'] })
    },
    mutationFn: ({ id, payload }: { id: number; payload: UpdateOutgoingDeliveryDraftPayload }) =>
      updateOutgoingDeliveryDraftApi(id, payload),
    onSuccess: async (delivery) => {
      queryClient.setQueryData([...DELIVERIES_QUERY_KEY, 'id', delivery.id], delivery)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY }),
      ])
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
      filter?.statuses ?? [],
      filter?.q ?? '',
      filter?.runId ?? null,
      filter?.unassigned ?? null,
      filter?.limit ?? 50,
      filter?.cursor ?? null,
    ],
    queryFn: ({ signal }) => fetchOutgoingDeliveriesApi(filter, signal),
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
    retry: false,
    mutationFn: (payload: CreateOutgoingDeliveryPayload) => createOutgoingDeliveryApi(payload),
    onSuccess: (newDelivery) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      if (options?.notifySuccess !== false)
        toast.success(`Delivery shipment "${newDelivery.deliveryNumber}" created successfully`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['delivery-vehicles'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['quarantine-lots'] })
      toast.error(getErrorMessage(err))
    },
  })
}

export function useReadyOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async (command: { id: number; expectedRevision: number }) => {
      const id = command.id
      const delivery = await readyOutgoingDeliveryApi(id, command.expectedRevision)
      if (delivery.id !== id || delivery.status !== 'READY')
        throw new Error(
          'The server did not confirm marking this delivery ready. Review it in Outgoing Deliveries before retrying.',
        )
      return delivery
    },
    onSuccess: async (delivery) => {
      queryClient.setQueryData([...DELIVERIES_QUERY_KEY, 'id', delivery.id], delivery)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY }),
      ])
      toast.success(`Delivery "${delivery.deliveryNumber}" marked ready`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['delivery-vehicles'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['quarantine-lots'] })
      toast.error(getErrorMessage(err))
    },
  })
}

export function useReopenOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({ id, expectedRevision }: { id: number; expectedRevision: number }) => {
      const delivery = await reopenOutgoingDeliveryApi(id, expectedRevision)
      if (delivery.id !== id || delivery.status !== 'DRAFT')
        throw new Error('The server did not confirm reopening. Refresh the delivery before retrying.')
      return delivery
    },
    onSuccess: async (delivery) => {
      queryClient.setQueryData([...DELIVERIES_QUERY_KEY, 'id', delivery.id], delivery)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY }),
      ])
      toast.success(`Delivery "${delivery.deliveryNumber}" reopened`)
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      toast.error(getErrorMessage(error))
    },
  })
}

export function useCancelOutgoingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({ id, expectedRevision }: { id: number; expectedRevision: number }) => {
      const delivery = await cancelOutgoingDeliveryApi(id, expectedRevision)
      if (delivery.id !== id || delivery.status !== 'CANCELLED')
        throw new Error('The server did not confirm cancellation. Refresh the delivery before retrying.')
      return delivery
    },
    onSuccess: async (delivery) => {
      await Promise.all([
        DELIVERIES_QUERY_KEY, VEHICLES_QUERY_KEY, STOCK_ITEMS_QUERY_KEY, SALES_ORDERS_QUERY_KEY,
        ['products'], ['warehouses'],
      ].map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      toast.info(`Delivery "${delivery.deliveryNumber}" has been cancelled`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['delivery-vehicles'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['quarantine-lots'] })
      toast.error(getErrorMessage(err))
    },
  })
}
