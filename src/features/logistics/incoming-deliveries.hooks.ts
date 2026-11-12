import { fetchPurchaseOrderByIdApi } from './purchase-orders.api'
import { fetchWarehouseByIdApi } from './warehouses.api'
import { incomingOrderSchedulingIssue, incomingSchedulingIssue } from './incoming-scheduling'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from '@/lib/notifications'
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
import { getApiError, getErrorMessage } from '@/lib/api-client'


export const INCOMING_DELIVERIES_QUERY_KEY = ['incoming-deliveries'] as const

export function useIncomingDeliveries(filter?: IncomingDeliveryFilter, enabled = true) {
  return useQuery({
    queryKey: [...INCOMING_DELIVERIES_QUERY_KEY, filter ?? {}],
    queryFn: ({ signal }) => fetchIncomingDeliveriesApi(filter, signal),
    enabled,
  })
}

export function useIncomingDeliveryById(id?: number) {
  return useQuery({
    queryKey: [...INCOMING_DELIVERIES_QUERY_KEY, 'id', id],
    queryFn: () => (id ? fetchIncomingDeliveryByIdApi(id) : Promise.reject('No ID')),
    enabled: Boolean(id && id > 0),
    staleTime: 0,
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

export function useCreateIncomingDelivery(feedback: { success?: boolean } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async (payload: CreateIncomingDeliveryPayload) => {
      const saved = await createIncomingDeliveryApi(payload)
      if (!Number.isSafeInteger(saved?.id) || saved.id < 1 || !Number.isSafeInteger(saved.revision) || saved.revision < 1 ||
        saved.status !== 'DRAFT' || saved.purchaseOrderId !== payload.purchaseOrderId || saved.warehouseId !== payload.warehouseId)
        throw Error('Arrival creation was not confirmed. Review Incoming Deliveries before creating another arrival.')
      return saved
    },
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: INCOMING_DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      if (feedback.success !== false) toast.success(`Incoming Delivery "${delivery.deliveryNumber}" created`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['incoming-deliveries'] })
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['quarantine-lots'] })
      toast.error(getErrorMessage(err))
    },
  })
}

const schedulingKey = (id: number) => [...INCOMING_DELIVERIES_QUERY_KEY, 'scheduling-eligibility', id] as const

async function fetchIncomingSchedulingContext(id: number) {
  try {
    const delivery = await fetchIncomingDeliveryByIdApi(id)
    if (delivery?.id !== id) throw Error('Delivery unavailable')
    const [order, warehouse] = await Promise.all([
      fetchPurchaseOrderByIdApi(delivery.purchaseOrderId),
      fetchWarehouseByIdApi(delivery.warehouseId),
    ])
    if (!order || order.id !== delivery.purchaseOrderId || !warehouse || warehouse.id !== delivery.warehouseId)
      throw Error('Linked records unavailable')
    return { delivery, order, warehouse }
  } catch (error) {
    throw Error('Unable to verify the current delivery, purchase order and receiving warehouse. Recheck eligibility before scheduling.', { cause: error })
  }
}

export function useIncomingSchedulingEligibility(id: number) {
  return useQuery({
    queryKey: schedulingKey(id),
    queryFn: () => fetchIncomingSchedulingContext(id),
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
}

export function useScheduleIncomingDelivery(feedback: { success?: boolean; error?: boolean } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({ id, expectedRevision }: { id: number; expectedRevision: number }) => {
      const context = await fetchIncomingSchedulingContext(id)
      queryClient.setQueryData(schedulingKey(id), context)
      const issue = incomingSchedulingIssue(context)
      if (issue) throw Error(`${issue.title}. ${issue.message}`)
      if (context.delivery.revision !== expectedRevision)
        throw Error('The delivery changed. Review the current details and confirm scheduling again.')
      let saved
      try {
        saved = await scheduleIncomingDeliveryApi(id, expectedRevision)
      } catch (error) {
        const problem = getApiError(error)
        if (problem?.code === 'INVALID_ORDER_STATE') {
          const details = problem.details as { currentStatus?: string } | undefined
          const issue = incomingOrderSchedulingIssue(details?.currentStatus)
          throw Error(issue ? `${issue.title}. ${issue.message}` : 'The purchase order changed. View the purchase order and recheck eligibility before scheduling.', { cause: error })
        }
        if (problem?.code === 'INVALID_DELIVERY_STATE' || problem?.code === 'STALE_REVISION')
          throw Error('The delivery changed. Close this form and review its current status before scheduling again.', { cause: error })
        throw error
      }
      if (saved?.id !== id || saved.status !== 'SCHEDULED' || !Number.isSafeInteger(saved.revision) || saved.revision <= expectedRevision)
        throw Error('Arrival scheduling was not confirmed. Refresh and review the saved delivery before trying again.')
      return saved
    },
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: INCOMING_DELIVERIES_QUERY_KEY })
      if (feedback.success !== false) toast.success(`Incoming Delivery "${delivery.deliveryNumber}" scheduled`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['incoming-deliveries'] })
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['quarantine-lots'] })
      if (feedback.error !== false) toast.error(getErrorMessage(err))
    },
  })
}

export function useCompleteIncomingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async ({ id, ...payload }: CompleteIncomingDeliveryPayload & { id: number }) => {
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
          ['quarantine-lots'],
        ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      )
      toast.success(
        delivery.outcome === 'NO_RECEIPT'
          ? `Receipt Saved: ${delivery.deliveryNumber} (no receipt).`
          : `Receipt Saved: ${delivery.deliveryNumber}.`,
      )
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['incoming-deliveries'] })
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['quarantine-lots'] })
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCancelIncomingDelivery() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: ({ id, expectedRevision }: { id: number; expectedRevision: number }) => cancelIncomingDeliveryApi(id, expectedRevision),
    onSuccess: (delivery) => {
      void queryClient.invalidateQueries({ queryKey: INCOMING_DELIVERIES_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      toast.info(`Incoming Delivery "${delivery.deliveryNumber}" cancelled`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['incoming-deliveries'] })
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['warehouses'] })
      void queryClient.invalidateQueries({ queryKey: ['quarantine-lots'] })
      toast.error(getErrorMessage(err))
    },
  })
}
