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
import { getErrorMessage, type FetchParams } from '@/lib/api-client'

export const productKeys = {
  all: ['products'] as const,
  lists: (includeInactive = 'false') => [...productKeys.all, 'list', includeInactive] as const,
  detail: (id: number) => [...productKeys.all, 'detail', id] as const,
}

// React Query hook to fetch the product list
export function useProducts(params?: FetchParams) {
  return useQuery({
    queryKey: productKeys.lists(params?.includeInactive ?? 'false'),
    queryFn: () => fetchProductsApi(params),
  })
}

export function useAllProducts() {
  return useProducts({ includeInactive: 'true' })
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
    onSuccess: (data) => {
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
export function useDeactivateProduct(options?: { onViewArchive?: () => void }) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (productOrId: InventoryItemResponse | number) => {
      const id = typeof productOrId === 'number' ? productOrId : productOrId.id
      const res = await deactivateProductApi(id)
      return { res, inputProduct: typeof productOrId === 'object' ? productOrId : null, id }
    },
    onMutate: async (productOrId) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists('true') })
      const previousProducts = queryClient.getQueryData<InventoryItemResponse[]>(
        productKeys.lists('true'),
      )
      const targetId = typeof productOrId === 'number' ? productOrId : productOrId.id

      queryClient.setQueryData<InventoryItemResponse[]>(productKeys.lists('true'), (old) => {
        if (!old) return []
        return old.map((p) => (p.id === targetId ? { ...p, isActive: false } : p))
      })

      return { previousProducts }
    },
    onError: (err, _, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(productKeys.lists('true'), context.previousProducts)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
    },
    onSuccess: ({ res, inputProduct }) => {
      const name = res?.name || inputProduct?.name || 'Product'
      toast.success(`Product "${name}" archived`, {
        description: 'Product moved to the Archived Catalog tab.',
        action: options?.onViewArchive
          ? {
              label: 'View in Archive',
              onClick: options.onViewArchive,
            }
          : undefined,
      })
    },
  })
}

// React Query mutation to reactivate a product
export function useReactivateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (idOrProduct: number | InventoryItemResponse) => {
      const id = typeof idOrProduct === 'number' ? idOrProduct : idOrProduct.id
      const res = await reactivateProductApi(id)
      return { res, id }
    },
    onMutate: async (idOrProduct) => {
      await queryClient.cancelQueries({ queryKey: productKeys.lists('true') })
      const previousProducts = queryClient.getQueryData<InventoryItemResponse[]>(
        productKeys.lists('true'),
      )
      const targetId = typeof idOrProduct === 'number' ? idOrProduct : idOrProduct.id

      queryClient.setQueryData<InventoryItemResponse[]>(productKeys.lists('true'), (old) => {
        if (!old) return []
        return old.map((p) => (p.id === targetId ? { ...p, isActive: true } : p))
      })

      return { previousProducts }
    },
    onError: (err, _, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(productKeys.lists('true'), context.previousProducts)
      }
      toast.error(getErrorMessage(err))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.all })
      void queryClient.invalidateQueries({ queryKey: ['stock-items'] })
    },
    onSuccess: ({ res }) => {
      toast.success(
        `Product "${res.name || 'Product'}" reactivated and restored to active catalog`,
      )
    },
  })
}

export { fetchProductByNameApi }
