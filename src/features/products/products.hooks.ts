import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  createProductApi,
  deactivateProductApi,
  fetchProductByIdApi,
  fetchProductByNameApi,
  fetchProductsApi,
  reactivateProductApi,
  updateProductDetailsApi,
  updateProductPriceApi,
} from './products.api'
import type {
  CreateInventoryItemPayload,
  InventoryItemResponse,
  UpdateInventoryItemDetailsPayload,
} from './products.types'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  detail: (id: number) => [...productKeys.all, 'detail', id] as const,
}

// React Query hook to fetch the product list
export function useProducts() {
  return useQuery({
    queryKey: productKeys.lists(),
    queryFn: fetchProductsApi,
  })
}

// React Query hook to fetch a single product by ID
export function useProduct(id: number) {
  return useQuery({
    queryKey: productKeys.detail(id),
    queryFn: () => fetchProductByIdApi(id),
    enabled: id > 0,
  })
}

export function useDeactivatedProducts() {
  return useQuery<InventoryItemResponse[]>({
    queryKey: ['products', 'deactivated-products'],
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
  })
}

// React Query mutation to create a new product
export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInventoryItemPayload) => createProductApi(payload),
    onSuccess: (data) => {
      queryClient.setQueryData<InventoryItemResponse[]>(['products', 'deactivated-products'], (old = []) =>
        old.filter((p) => p.id !== data.id && p.name.toLowerCase() !== data.name.toLowerCase())
      )
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(`Product "${data.name}" registered successfully`)
    },
  })
}

// React Query mutation to update product details
export function useUpdateProductDetails() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateInventoryItemDetailsPayload }) =>
      updateProductDetailsApi(id, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success('Product details updated successfully')
    },
  })
}

// React Query mutation to update product price
export function useUpdateProductPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, unitPrice }: { id: number; unitPrice: number }) =>
      updateProductPriceApi(id, unitPrice),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success('Product price updated successfully')
    },
  })
}

// React Query mutation to deactivate a product
export function useDeactivateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (productOrId: InventoryItemResponse | number) => {
      const id = typeof productOrId === 'number' ? productOrId : productOrId.id
      return await deactivateProductApi(id)
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.setQueryData<InventoryItemResponse[]>(['products', 'deactivated-products'], (old = []) => [
          ...old.filter((p) => p.id !== data.id),
          { ...data, isActive: false },
        ])
      }
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(`Product "${data.name || 'Product'}" deactivated and moved to archive`)
    },
  })
}

// React Query mutation to reactivate a product
export function useReactivateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      return await reactivateProductApi(id)
    },
    onSuccess: (data) => {
      queryClient.setQueryData<InventoryItemResponse[]>(['products', 'deactivated-products'], (old = []) =>
        old.filter((p) => p.id !== data.id)
      )
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(`Product "${data.name || 'Product'}" reactivated and restored to active catalog`)
    },
  })
}

export { fetchProductByNameApi }
