import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelPurchaseOrderApi,
  confirmPurchaseOrderApi,
  createPurchaseOrderApi,
  fetchPurchaseOrderByIdApi,
  fetchPurchaseOrderByNumberApi,
  fetchPurchaseOrdersApi,
} from './purchase-orders.api'
import type { CreatePurchaseOrderPayload, PurchaseOrderFilter } from './purchase-orders.types'
import { getErrorMessage } from '@/lib/api-client'

export const PURCHASE_ORDERS_QUERY_KEY = ['purchase-orders'] as const

export function usePurchaseOrders(filter?: PurchaseOrderFilter) {
  return useQuery({
    queryKey: [...PURCHASE_ORDERS_QUERY_KEY, filter?.status ?? 'ALL', filter?.supplierId ?? 'ALL'],
    queryFn: () => fetchPurchaseOrdersApi(filter),
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

export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreatePurchaseOrderPayload) => createPurchaseOrderApi(payload),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      toast.success(`Purchase Order "${order.orderNumber}" created successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useConfirmPurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => confirmPurchaseOrderApi(id),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      toast.success(`Purchase Order "${order.orderNumber}" has been confirmed`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCancelPurchaseOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cancelPurchaseOrderApi(id),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: PURCHASE_ORDERS_QUERY_KEY })
      toast.info(`Purchase Order "${order.orderNumber}" was cancelled`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
