import type {
  SalesOrderItemRecord,
  SalesOrderRecord,
  UpdateSalesOrderDraftPayload,
} from './sales-orders.types'
import type { LineDiscount } from '@/lib/order-line-pricing'

export type OrderStatus = 'Completed' | 'Active' | 'Cancelled'
export type OrderLine = {
  productId: number
  name: string
  variety?: string | null
  unit?: string | null
  unitPrice: string
  quantity: string
  discount?: LineDiscount
  taxRate?: string
  terms?: Pick<SalesOrderItemRecord, 'discountRate' | 'discountAmount' | 'taxRate' | 'notes'>
}
export type SalesOrderFormLine = OrderLine & { formId: number; discount: LineDiscount }

export type SalesOrderDraftProps = {
  draftOrder?: SalesOrderRecord
  onUpdateDraft?: (id: number, payload: UpdateSalesOrderDraftPayload) => Promise<SalesOrderRecord>
  onLoadLatest?: (id: number) => Promise<SalesOrderRecord | null>
}
export type OrderFormValues = {
  clientId: number
  clientName: string
  deliveryAddress: string
  expectedAt?: string
  externalReference?: string
  notes?: string
  itemSummary: string
  lines: OrderLine[]
  discountType: 'peso' | 'percentage'
  discountValue: string
  discountRate: string
  taxRate: string
  total: string
  status: OrderStatus
  cashier: string
}
export type EditableSalesOrder = {
  clientName: string
  lines: OrderLine[]
  discountType: 'peso' | 'percentage'
  discountValue: string
  taxRate?: string
  status: OrderStatus
  deliveryAddress?: string
  expectedAt?: string
  externalReference?: string
  notes?: string
}
