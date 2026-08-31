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
import { addArchivedId, getArchivedIds, removeArchivedId } from '@/lib/archived-storage'

export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  detail: (id: number) => [...productKeys.all, 'detail', id] as const,
}

const ARCHIVED_PRODUCTS_KEY = 'erjv_archived_products'

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
    queryFn: async () => {
      const ids = getArchivedIds(ARCHIVED_PRODUCTS_KEY)
      if (ids.length === 0) return []
      const results: InventoryItemResponse[] = []
      for (const id of ids) {
        try {
          const p = await fetchProductByIdApi(id)
          if (p && p.isActive === false) {
            results.push(p)
          } else if (p && p.isActive !== false) {
            removeArchivedId(ARCHIVED_PRODUCTS_KEY, id)
          }
        } catch {
          // If deleted, skip
        }
      }
      return results
    },
    staleTime: 0,
  })
}

// React Query mutation to create a new product
export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateInventoryItemPayload) => createProductApi(payload),
    onSuccess: (data) => {
      removeArchivedId(ARCHIVED_PRODUCTS_KEY, data.id)
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
      const res = await deactivateProductApi(id)
      return { res, inputProduct: typeof productOrId === 'object' ? productOrId : null, id }
    },
    onSuccess: ({ res, inputProduct, id }) => {
      const targetId = res?.id || inputProduct?.id || id
      const name = res?.name || inputProduct?.name || 'Product'
      addArchivedId(ARCHIVED_PRODUCTS_KEY, targetId)
      if (res || inputProduct) {
        const entry: InventoryItemResponse = res || { ...(inputProduct as InventoryItemResponse), isActive: false }
        queryClient.setQueryData<InventoryItemResponse[]>(['products', 'deactivated-products'], (old = []) => [
          ...old.filter((p) => p.id !== targetId),
          { ...entry, isActive: false },
        ])
      }
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['products', 'deactivated-products'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(`Product "${name}" deactivated and moved to archive`)
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
      removeArchivedId(ARCHIVED_PRODUCTS_KEY, data.id)
      queryClient.setQueryData<InventoryItemResponse[]>(['products', 'deactivated-products'], (old = []) =>
        old.filter((p) => p.id !== data.id)
      )
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['products', 'deactivated-products'] })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
      toast.success(`Product "${data.name || 'Product'}" reactivated and restored to active catalog`)
    },
  })
}

export { fetchProductByNameApi }
