import { decimalString, lineSubtotal, parseOrderDecimal, roundedDivide } from './order-amounts.ts'
import { discountError } from './order-entry.schema.ts'

export type LineDiscount = { type: 'percentage' | 'peso'; percentage: string; peso: string }
export type DiscountFields = { discountRate?: string | number; discountAmount?: string | number }
export type PricedOrderLine = DiscountFields & {
  quantity: string | number
  unitPrice: string | number
  taxRate?: string | number
}
export type SavedLineAmounts = { subtotalAmount: string; discountAmount: string; taxAmount: string; totalAmount: string }

export function savedLineDiscount(line: { discountRate: string; discountAmount: string }): LineDiscount {
  const fixed = parseOrderDecimal(line.discountRate) === 0n && (parseOrderDecimal(line.discountAmount) ?? 0n) > 0n
  return { type: fixed ? 'peso' : 'percentage', percentage: fixed ? '' : line.discountRate,
    peso: fixed ? line.discountAmount : '' }
}

export function discountFields(discount: LineDiscount): { discountRate?: string; discountAmount?: string } {
  const value = discount[discount.type]
  return value === '' ? {} : discount.type === 'peso' ? { discountAmount: value } : { discountRate: value }
}

export function lineDiscountError(line: PricedOrderLine): string | undefined {
  if (line.discountRate !== undefined && line.discountAmount !== undefined)
    return 'Provide either discountRate or discountAmount, not both.'
  const value = line.discountAmount ?? line.discountRate
  if (value === undefined) return
  return discountError(String(value), line.discountAmount !== undefined ? 'peso' : 'percentage',
    lineSubtotal(String(line.quantity), String(line.unitPrice)) ?? '0.00')
}

export function serializeLineDiscount(line: PricedOrderLine): { discountRate?: string; discountAmount?: string } {
  const error = lineDiscountError(line)
  if (error) throw new Error(error)
  if ((line.discountAmount ?? line.discountRate) === '') return {}
  return line.discountAmount !== undefined ? { discountAmount: String(line.discountAmount) }
    : line.discountRate !== undefined ? { discountRate: String(line.discountRate) } : {}
}

export function orderLineAmounts(line: PricedOrderLine) {
  const gross = lineSubtotal(String(line.quantity), String(line.unitPrice))
  if (gross === null || lineDiscountError(line)) return null
  const subtotal = parseOrderDecimal(gross)!
  const taxRate = parseOrderDecimal(String(line.taxRate ?? '0.00'))
  if (taxRate === null || taxRate > 10_000n) return null
  const discount = line.discountAmount !== undefined ? (parseOrderDecimal(String(line.discountAmount)) ?? 0n)
    : roundedDivide(subtotal * (parseOrderDecimal(String(line.discountRate ?? '0.00')) ?? 0n), 10_000n)
  const taxable = subtotal - discount
  const tax = roundedDivide(taxable * taxRate, 10_000n)
  return { subtotal: gross, discount: decimalString(discount), vat: decimalString(tax), total: decimalString(taxable + tax) }
}

export function orderLineTotals(lines: PricedOrderLine[]) {
  return sumLineAmounts(lines.map(orderLineAmounts))
}

export function savedOrderTotals(lines: SavedLineAmounts[]) {
  return sumLineAmounts(lines.map((line) => ({ subtotal: line.subtotalAmount,
    discount: line.discountAmount, vat: line.taxAmount, total: line.totalAmount })))
}

function sumLineAmounts(lines: ReturnType<typeof orderLineAmounts>[]) {
  const totals = { subtotal: 0n, discount: 0n, vat: 0n, total: 0n }
  for (const amounts of lines) {
    if (!amounts) return null
    for (const key of ['subtotal', 'discount', 'vat', 'total'] as const) {
      const value = parseOrderDecimal(amounts[key])
      if (value === null) return null
      totals[key] += value
    }
  }
  return { subtotal: decimalString(totals.subtotal), discount: decimalString(totals.discount),
    vat: decimalString(totals.vat), total: decimalString(totals.total) }
}
