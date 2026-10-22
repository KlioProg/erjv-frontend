import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/api-client'
import { fetchSupplierPricesApi, saveSupplierPriceApi } from './supplier-pricing.api'

export const SUPPLIER_PRICES_QUERY_KEY = ['supplier-prices'] as const

export function useSupplierPrices(supplierId?: number) {
  return useQuery({
    queryKey: [...SUPPLIER_PRICES_QUERY_KEY, supplierId],
    queryFn: () => fetchSupplierPricesApi(supplierId!),
    enabled: Boolean(supplierId && supplierId > 0),
  })
}

export function useSaveSupplierPrice() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: saveSupplierPriceApi,
    onSuccess: async (price) => {
      await queryClient.invalidateQueries({
        queryKey: [...SUPPLIER_PRICES_QUERY_KEY, price.supplierId],
      })
      toast.success('Supplier reference price saved. Existing order costs are unchanged.')
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  })
}
