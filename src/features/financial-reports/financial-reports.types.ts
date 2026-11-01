export type ReportKind = 'sales' | 'purchases' | 'gross-profit-estimate'
export type ReportGroup = 'none' | 'day' | 'month' | 'client' | 'supplier' | 'item'
export type Draft = {
  from: string
  through: string
  groupBy: ReportGroup
  itemId: string
  warehouseId: string
  clientId: string
  supplierId: string
}
export type ReportQuery = {
  from: string
  before: string
  groupBy: ReportGroup
  itemId?: number
  warehouseId?: number
  clientId?: number
  supplierId?: number
  limit?: number
  cursor?: string
}
export const moneyKeys = [
  'subtotalAmount',
  'discountAmount',
  'taxableAmount',
  'taxAmount',
  'totalAmount',
] as const
export const profitMoneyKeys = [
  'costedTaxableSalesValue',
  'estimatedAcquisitionCost',
  'estimatedGrossProfitAmount',
  'uncostedTaxableSalesValue',
] as const
export type Metrics = Record<(typeof moneyKeys)[number], string> & {
  eventCount: number
  orderCount: number
  partyCount: number
  quantitiesByUnit: Record<
    string,
    { quantity: string; returnedDamagedQuantity: string; missingQuantity: string }
  >
  costedTaxableSalesValue?: string
  estimatedAcquisitionCost?: string
  estimatedGrossProfitAmount?: string
  uncostedTaxableSalesValue?: string
  estimatedGrossMarginPercent?: string | null
  costCoveragePercent?: string | null
  uncostedQuantityByUnit?: Record<string, string>
  costingMethod?: string
}
export type ReportRow = Metrics & { key: string; name?: string; unit?: string }
export type ReportResult = {
  period: { from: string; before: string; businessTimezone: string; asOf: string }
  basis: string
  totals: Metrics
  rows: ReportRow[]
  nextCursor: string | null
  costingMethod?: string
}
