import { apiClient, extractArray } from '@/lib/api-client'
import type { SupplierProductPrice } from './supplier-pricing.types'

export async function fetchSupplierPricesApi(supplierId: number): Promise<SupplierProductPrice[]> {
  const { data } = await apiClient.get(`/suppliers/${supplierId}/products`)
  return extractArray<SupplierProductPrice>(data)
}

export async function saveSupplierPriceApi({
  supplierId,
  inventoryItemId,
  latestUnitCost,
}: {
  supplierId: number
  inventoryItemId: number
  latestUnitCost: string | null
}): Promise<SupplierProductPrice> {
  const { data } = await apiClient.put<SupplierProductPrice>(
    `/suppliers/${supplierId}/products/${inventoryItemId}`,
    { latestUnitCost },
  )
  return data
}
