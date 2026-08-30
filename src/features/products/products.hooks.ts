import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createProductApi,
  deactivateProductApi,
  fetchProductByIdApi,
  fetchProductsApi,
  updateProductDetailsApi,
  updateProductPriceApi,
} from './products.api'
import type {
  CreateInventoryItemPayload,
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

// React Query mutation to create a new product
export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInventoryItemPayload) => createProductApi(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
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
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
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
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
    },
  })
}

// React Query mutation to deactivate a product
export function useDeactivateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deactivateProductApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
    },
  })
}
