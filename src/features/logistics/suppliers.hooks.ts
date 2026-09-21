import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createSupplierApi,
  deleteSupplierApi,
  fetchSupplierByCodeApi,
  fetchSupplierByIdApi,
  fetchSuppliersApi,
  reactivateSupplierApi,
  updateSupplierApi,
} from './suppliers.api'
import type { CreateSupplierPayload, UpdateSupplierPayload } from './suppliers.types'
import { getErrorMessage, type FetchParams } from '@/lib/api-client'

export const SUPPLIERS_QUERY_KEY = ['suppliers'] as const

export function useSuppliers(params?: FetchParams) {
  return useQuery({
    queryKey: [...SUPPLIERS_QUERY_KEY, params?.includeInactive ?? 'false'],
    queryFn: () => fetchSuppliersApi(params),
  })
}

export function useSupplierById(id?: number) {
  return useQuery({
    queryKey: [...SUPPLIERS_QUERY_KEY, 'id', id],
    queryFn: () => (id ? fetchSupplierByIdApi(id) : Promise.reject('No supplier ID')),
    enabled: Boolean(id && id > 0),
  })
}

export function useSupplierByCode(code?: string) {
  return useQuery({
    queryKey: [...SUPPLIERS_QUERY_KEY, 'code', code?.trim() || ''],
    queryFn: () => (code?.trim() ? fetchSupplierByCodeApi(code.trim()) : Promise.resolve(null)),
    enabled: Boolean(code && code.trim().length > 0),
  })
}

export function useCreateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateSupplierPayload) => createSupplierApi(payload),
    onSuccess: (supplier) => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY })
      toast.success(`Supplier "${supplier.name}" added successfully`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSupplierPayload }) =>
      updateSupplierApi(id, payload),
    onSuccess: (supplier) => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY })
      toast.success(`Supplier "${supplier.name}" updated`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteSupplierApi(id),
    onSuccess: (supplier) => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY })
      toast.info(`Supplier "${supplier.name}" archived`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}

export function useReactivateSupplier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => reactivateSupplierApi(id),
    onSuccess: (supplier) => {
      void queryClient.invalidateQueries({ queryKey: SUPPLIERS_QUERY_KEY })
      toast.success(`Supplier "${supplier.name}" reactivated`)
    },
    onError: (err) => {
      toast.error(getErrorMessage(err))
    },
  })
}
