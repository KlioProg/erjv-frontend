import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelSalesOrderApi,
  confirmSalesOrderApi,
  createSalesOrderApi,
  fetchSalesOrderByIdApi,
  fetchSalesOrderByNumberApi,
  fetchSalesOrdersApi,
} from './sales-orders.api'
import type {
  CreateSalesOrderPayload,
  SalesOrderFilter,
} from './sales-orders.types'
import { STOCK_ITEMS_QUERY_KEY } from '../logistics/stock-items.hooks'
import { getErrorMessage } from '@/lib/api-client'

export const SALES_ORDERS_QUERY_KEY = ['sales-orders'] as const

export function useSalesOrders(filter?: SalesOrderFilter) {
  return useQuery({
    queryKey: [...SALES_ORDERS_QUERY_KEY, filter?.status ?? 'ALL', filter?.clientId ?? 'ALL'],
    queryFn: () => fetchSalesOrdersApi(filter),
  })
}

export function useSalesOrderById(id?: number) {
  return useQuery({
    queryKey: [...SALES_ORDERS_QUERY_KEY, 'id', id],
    queryFn: () => (id ? fetchSalesOrderByIdApi(id) : Promise.reject('No Order ID')),
    enabled: Boolean(id && id > 0),
  })
}

export function useSalesOrderByNumber(orderNumber?: string) {
  return useQuery({
    queryKey: [...SALES_ORDERS_QUERY_KEY, 'number', orderNumber?.trim() || ''],
    queryFn: () =>
      orderNumber?.trim() ? fetchSalesOrderByNumberApi(orderNumber.trim()) : Promise.resolve(null),
    enabled: Boolean(orderNumber && orderNumber.trim().length > 0),
  })
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSalesOrderPayload) => createSalesOrderApi(payload),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      toast.success(`Sales Order "${order.orderNumber}" created successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useConfirmSalesOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => confirmSalesOrderApi(id),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      toast.success(`Sales Order "${order.orderNumber}" confirmed and reserved`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useCancelSalesOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => cancelSalesOrderApi(id),
    onSuccess: (order) => {
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      toast.info(`Sales Order "${order.orderNumber}" cancelled`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
