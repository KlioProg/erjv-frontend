import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelPurchaseOrderApi,
  confirmPurchaseOrderApi,
  createPurchaseOrderApi,
  fetchPurchaseOrderByIdApi,
  fetchPurchaseOrderByNumberApi,
  fetchPurchaseOrdersApi,
  updatePurchaseOrderDraftApi,
} from './purchase-orders.api'
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrderFilter,
  UpdatePurchaseOrderDraftPayload,
} from './purchase-orders.types'
import { getErrorMessage } from '@/lib/api-client'

export const PURCHASE_ORDERS_QUERY_KEY = ['purchase-orders'] as const

export function usePurchaseOrders(filter?: PurchaseOrderFilter) {
  return useQuery({
    queryKey: [
      ...PURCHASE_ORDERS_QUERY_KEY,
      filter?.status ?? 'ALL',
      filter?.supplierId ?? 'ALL',
      filter?.limit ?? 50,
      filter?.cursor ?? null,
    ],
    queryFn: ({ signal }) => fetchPurchaseOrdersApi(filter, signal),
  })
}

export function usePurchaseOrderById(id?: number) {
  return useQuery({
    queryKey: [...PURCHASE_ORDERS_QUERY_KEY, 'id', id],
    queryFn: () => (id ? fetchPurchaseOrderByIdApi(id) : Promise.reject('No Order ID')),
    enabled: Boolean(id && id > 0),
  })
}

export function usePurchaseOrderByNumber(orderNumber?: string) {
  return useQuery({
    queryKey: [...PURCHASE_ORDERS_QUERY_KEY, 'number', orderNumber?.trim() || ''],
    queryFn: () =>
      orderNumber?.trim()
        ? fetchPurchaseOrderByNumberApi(orderNumber.trim())
        : Promise.resolve(null),
    enabled: Boolean(orderNumber && orderNumber.trim().length > 0),
  })
}

export function useCreatePurchaseOrder({ notifySuccess = true }: { notifySuccess?: boolean } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: (payload: CreatePurchaseOrderPayload) => createPurchaseOrderApi(payload),
    onSuccess: (order) => {
      queryClient.setQueryData([...PURCHASE_ORDERS_QUERY_KEY, 'id', order.id], order)
      queryClient.setQueryData([...PURCHASE_ORDERS_QUERY_KEY, 'number', order.orderNumber], order)
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      if (notifySuccess) toast.success(`Purchase Order "${order.orderNumber}" created successfully`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['incoming-deliveries'] })
      toast.error(getErrorMessage(err))
    },
  })
}

export function useConfirmPurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: async (id: number) => {
      const order = await confirmPurchaseOrderApi(id)
      if (order.id !== id || order.status !== 'CONFIRMED')
        throw new Error(
          'The server did not confirm this purchase order. Review its status before retrying.',
        )
      return order
    },
    onSuccess: (order, id) => {
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      if (order.id === id && order.status === 'CONFIRMED')
        toast.success('Order confirmed', {
          description: `Purchase order ${order.orderNumber}. Prepare it in Incoming Deliveries.`,
        })
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['incoming-deliveries'] })
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdatePurchaseOrderDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: ({ id, payload }: { id: number; payload: UpdatePurchaseOrderDraftPayload }) =>
      updatePurchaseOrderDraftApi(id, payload),
    onSuccess: (order) => {
      queryClient.setQueryData([...PURCHASE_ORDERS_QUERY_KEY, 'id', order.id], order)
      queryClient.setQueryData([...PURCHASE_ORDERS_QUERY_KEY, 'number', order.orderNumber], order)
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      toast.success(`Draft "${order.orderNumber}" updated`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['incoming-deliveries'] })
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: (id: number) => cancelPurchaseOrderApi(id),
    onSuccess: (order) => {
      queryClient.setQueryData([...PURCHASE_ORDERS_QUERY_KEY, 'id', order.id], order)
      queryClient.setQueryData([...PURCHASE_ORDERS_QUERY_KEY, 'number', order.orderNumber], order)
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      toast.info(`Purchase Order "${order.orderNumber}" was cancelled`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['purchase-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['incoming-deliveries'] })
      toast.error(getErrorMessage(err))
    },
  })
}
