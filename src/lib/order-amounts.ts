// The API accepts decimal strings with at most two places. Keep money and
// quantities scaled as integers, using the same rounding as the backend.
export function parseOrderDecimal(value: string): bigint | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) return null
  const [whole, fraction = ''] = value.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export function decimalString(value: bigint): string {
  const sign = value < 0n ? '-' : ''
  const absolute = value < 0n ? -value : value
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`
}

export function formatOrderCurrency(value: string | null): string {
  if (value === null) return '—'
  const [whole, fraction = '00'] = value.split('.')
  return `₱${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction.padEnd(2, '0')}`
}

export function roundedDivide(value: bigint, divisor: bigint): bigint {
  return (value + divisor / 2n) / divisor
}

export function lineSubtotal(quantity: string, price: string): string | null {
  const qty = parseOrderDecimal(quantity)
  const cost = parseOrderDecimal(price)
  if (qty === null || qty <= 0n || cost === null) return null
  return decimalString(roundedDivide(qty * cost, 100n))
}

export function availableStock(stock?: { quantity: string; reservedQuantity?: string }): bigint {
  if (!stock) return 0n
  const physical = parseOrderDecimal(stock.quantity) ?? 0n
  const reserved = parseOrderDecimal(stock.reservedQuantity ?? '0') ?? 0n
  return physical > reserved ? physical - reserved : 0n
}

export function orderAmounts(
  lines: { quantity: string; unitPrice: string }[],
  discountType: 'peso' | 'percentage' = 'peso',
  discountValue = '',
  taxRate = '0.00',
) {
  const subtotals = lines.map(
    (line) => parseOrderDecimal(lineSubtotal(line.quantity, line.unitPrice) ?? '0') ?? 0n,
  )
  const subtotal = subtotals.reduce((sum, value) => sum + value, 0n)
  const requested = parseOrderDecimal(discountValue || '0') ?? 0n
  const requestedRate =
    discountType === 'percentage'
      ? requested
      : subtotal > 0n
        ? roundedDivide(requested * 10_000n, subtotal)
        : 0n
  const rate = requestedRate > 10_000n ? 10_000n : requestedRate
  const tax = parseOrderDecimal(taxRate) ?? 0n
  const discounts = subtotals.map((value) => roundedDivide(value * rate, 10_000n))
  const taxes = subtotals.map((value, index) =>
    roundedDivide((value - discounts[index]) * tax, 10_000n),
  )
  const discount = discounts.reduce((sum, value) => sum + value, 0n)
  const vat = taxes.reduce((sum, value) => sum + value, 0n)
  return {
    subtotal: decimalString(subtotal),
    discount: decimalString(discount),
    vat: decimalString(vat),
    total: decimalString(subtotal - discount + vat),
    discountRate: decimalString(rate),
    taxRate,
    hasDiscountRounding: discountType === 'peso' && requested !== discount,
  }
}
