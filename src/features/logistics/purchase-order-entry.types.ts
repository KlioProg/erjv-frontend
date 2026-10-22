export type PurchaseLine = {
  inventoryItemId: number
  name: string
  variety?: string | null
  unit?: string
  unitCost: string
  quantity: string
  discountRate?: string
  taxRate?: string
  notes?: string | null
}
