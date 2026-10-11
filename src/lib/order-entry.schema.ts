import { formatOrderCurrency, parseOrderDecimal } from './order-amounts.ts'

export function quantityError(value: string): string | undefined {
  const parsed = parseOrderDecimal(value)
  if (parsed === null || parsed <= 0n)
    return 'Enter a quantity greater than zero, with up to two decimals.'
  if (parsed > 999_999_999_999n) return 'Quantity exceeds the supported limit.'
}

export function priceError(value: string): string | undefined {
  const parsed = parseOrderDecimal(value)
  if (parsed === null) return 'Enter a non-negative price with up to two decimals.'
  if (parsed > 99_999_999_999_999n) return 'Price exceeds the supported limit.'
}

export function subtotalError(value: string | null): string | undefined {
  if (value !== null && (parseOrderDecimal(value) ?? 0n) > 99_999_999_999_999n)
    return 'Item subtotal exceeds the supported limit.'
}

export function discountError(
  value: string,
  type: 'peso' | 'percentage',
  subtotal: string,
  appliedDiscount?: string,
): string | undefined {
  if (!value) return
  const parsed = parseOrderDecimal(value)
  if (parsed === null) return 'Enter a non-negative discount with up to two decimals.'
  if (parsed > (type === 'percentage' ? 10_000n : (parseOrderDecimal(subtotal) ?? 0n))) {
    return type === 'percentage'
      ? 'Discount cannot exceed 100%.'
      : 'Discount cannot exceed the subtotal.'
  }
  if (
    type === 'peso' &&
    appliedDiscount !== undefined &&
    parsed !== parseOrderDecimal(appliedDiscount)
  ) {
    return `This discount would save as ${formatOrderCurrency(appliedDiscount)} with two-decimal line rates. Enter that amount or use a percentage discount.`
  }
}

export function expectedDateError(value: string): string | undefined {
  if (!value) return
  const date = new Date(value)
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    return 'Enter a valid expected delivery date.'
}
