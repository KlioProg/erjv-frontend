import { useCursorPage } from '@/lib/use-cursor-page'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelSalesOrderApi,
  confirmSalesOrderApi,
  createSalesOrderApi,
  fetchSalesOrderByIdApi,
  fetchSalesOrderByNumberApi,
  fetchSalesOrdersApi,
  fetchSalesOrdersPageApi,
  updateSalesOrderDraftApi,
  isStaleSalesOrderRevision,
} from './sales-orders.api'
import type {
  CreateSalesOrderPayload,
  SalesOrderFilter,
  SalesOrderRecord,
  UpdateSalesOrderDraftPayload,
} from './sales-orders.types'
import { STOCK_ITEMS_QUERY_KEY } from '../logistics/stock-items.hooks'
import { getErrorMessage } from '@/lib/api-client'

export const SALES_ORDERS_QUERY_KEY = ['sales-orders'] as const

export function useSalesOrders(filter?: SalesOrderFilter) {
  return useQuery({
    queryKey: [...SALES_ORDERS_QUERY_KEY, filter ?? {}],
    queryFn: ({ signal }) => fetchSalesOrdersApi(filter, signal),
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

export function useCreateSalesOrder({ notifySuccess = true }: { notifySuccess?: boolean } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: (payload: CreateSalesOrderPayload) => createSalesOrderApi(payload),
    onSuccess: (order) => {
      queryClient.setQueryData<SalesOrderRecord>([...SALES_ORDERS_QUERY_KEY, 'id', order.id], order)
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      if (notifySuccess) toast.success(`Sales Order "${order.orderNumber}" created successfully`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
      toast.error(getErrorMessage(err))
    },
  })
}

export function useConfirmSalesOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: ({ id, expectedRevision }: { id: number; expectedRevision: number }) => confirmSalesOrderApi(id, expectedRevision),
    onSuccess: (order, { id }) => {
      queryClient.setQueryData([...SALES_ORDERS_QUERY_KEY, 'id', order.id], order)
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      if (order.id === id && order.status === 'CONFIRMED')
        toast.success('Order confirmed', {
          description: `Sales order ${order.orderNumber}. Prepare it in Outgoing Deliveries.`,
        })
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateSalesOrderDraft() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSalesOrderDraftPayload }) =>
      updateSalesOrderDraftApi(id, payload),
    onSuccess: (order) => {
      queryClient.setQueryData([...SALES_ORDERS_QUERY_KEY, 'id', order.id], order)
      queryClient.setQueryData([...SALES_ORDERS_QUERY_KEY, 'number', order.orderNumber], order)
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      toast.success(`Draft ${order.orderNumber} updated`)
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
      if (!isStaleSalesOrderRevision(error)) toast.error(getErrorMessage(error))
    },
  })
}

export function useCancelSalesOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: ({ id, expectedRevision }: { id: number; expectedRevision: number }) => cancelSalesOrderApi(id, expectedRevision),
    onSuccess: (order) => {
      queryClient.setQueryData([...SALES_ORDERS_QUERY_KEY, 'id', order.id], order)
      void queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY })
      toast.info(`Sales Order "${order.orderNumber}" cancelled`)
    },
    onError: (err) => {
      void queryClient.invalidateQueries({ queryKey: ['sales-orders'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      void queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
      toast.error(getErrorMessage(err))
    },
  })
}

export function useSalesOrdersPage(filter: SalesOrderFilter = {}, enabled = true) {
  return useCursorPage('sales-orders', filter, fetchSalesOrdersPageApi, enabled)
}
