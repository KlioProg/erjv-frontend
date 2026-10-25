import type { LineDiscount } from '@/lib/order-line-pricing'

export type PurchaseLine = {
  formId: number
  inventoryItemId: number
  name: string
  variety?: string | null
  unit?: string
  unitCost: string
  quantity: string
  discount: LineDiscount
  taxRate?: string
  notes?: string | null
}
