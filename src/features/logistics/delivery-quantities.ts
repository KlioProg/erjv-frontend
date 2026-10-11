import { decimalString, parseOrderDecimal } from '../../lib/order-amounts.ts'

export function remainingDeliveryQuantity(ordered: string, committed: string[]): string | null {
  const total = parseOrderDecimal(ordered)
  const quantities = committed.map(parseOrderDecimal)
  if (total === null || quantities.some((value) => value === null)) return null
  const used = quantities.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n)
  return decimalString(total > used ? total - used : 0n)
}

export function deliveryQuantityError(value: string, remaining: string | null): string | null {
  const quantity = parseOrderDecimal(value)
  const available = remaining === null ? null : parseOrderDecimal(remaining)
  if (available === null)
    return 'The remaining quantity is unavailable. Reload deliveries before continuing.'
  if (quantity === null)
    return 'Enter a quantity with up to two decimal places, or 0 to skip this item.'
  if (quantity > available) return `Quantity exceeds the remaining ${remaining}.`
  return null
}

export function sumDeliveryQuantities(values: string[]): string | null {
  const quantities = values.map(parseOrderDecimal)
  return quantities.some((value) => value === null)
    ? null
    : decimalString(quantities.reduce<bigint>((sum, value) => sum + (value ?? 0n), 0n))
}
