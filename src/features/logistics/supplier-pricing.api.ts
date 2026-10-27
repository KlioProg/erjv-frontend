import type { SupplierProductPrice } from './supplier-pricing.types'

export const SUPPLIER_PRICING_SUPPORTED = false
const unavailable = () => new Error('Supplier reference pricing is not available in this backend. Enter unit costs on the purchase order.')

export async function fetchSupplierPricesApi(supplierId: number): Promise<SupplierProductPrice[]> {
  void supplierId
  throw unavailable()
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
  void supplierId
  void inventoryItemId
  void latestUnitCost
  throw unavailable()
}
