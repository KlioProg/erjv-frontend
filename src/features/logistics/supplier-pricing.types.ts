/** Optional quotes, independent of catalog selling prices and order snapshots. */
export interface SupplierProductPrice {
  supplierId: number
  inventoryItemId: number
  latestUnitCost: string | null
  createdAt: string
  updatedAt: string
}
