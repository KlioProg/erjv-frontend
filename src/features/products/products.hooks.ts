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

const ARCHIVED_PRODUCTS_KEY = 'erjv_archived_products'

export function getArchivedProducts(): InventoryItemResponse[] {
  try {
    const raw = localStorage.getItem(ARCHIVED_PRODUCTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveArchivedProduct(prod: InventoryItemResponse) {
  const current = getArchivedProducts().filter(
    (p) => p.id !== prod.id && p.name.toUpperCase().trim() !== prod.name.toUpperCase().trim()
  )
  current.push({ ...prod, isActive: false })
  localStorage.setItem(ARCHIVED_PRODUCTS_KEY, JSON.stringify(current))
}

export function removeArchivedProduct(idOrName: number | string) {
  const current = getArchivedProducts().filter(
    (p) => p.id !== idOrName && p.name.toUpperCase().trim() !== String(idOrName).toUpperCase().trim()
  )
  localStorage.setItem(ARCHIVED_PRODUCTS_KEY, JSON.stringify(current))
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
    onSuccess: (data) => {
      removeArchivedProduct(data.name)
      queryClient.invalidateQueries({ queryKey: productKeys.all })
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
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
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
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
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
      if (typeof productOrId !== 'number') {
        saveArchivedProduct(productOrId)
      } else if (res) {
        saveArchivedProduct(res)
      }
      return res
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      toast.success(`Product "${data.name || 'SKU'}" deactivated and moved to archive`)
    },
  })
}

// React Query mutation to reactivate a product
export function useReactivateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await reactivateProductApi(id)
      removeArchivedProduct(id)
      if (res?.name) {
        removeArchivedProduct(res.name)
      }
      return res
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: productKeys.all })
      toast.success(`Product "${data.name || 'SKU'}" reactivated and restored to active catalog`)
    },
  })
}

export { fetchProductByNameApi }
