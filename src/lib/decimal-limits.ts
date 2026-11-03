import { parseOrderDecimal } from './order-amounts.ts'

export const QUANTITY_MAX = 999_999_999_999n
export const MONEY_MAX = 99_999_999_999_999n

export function decimalLimitError(
  value: string,
  positive = false,
  maximum = QUANTITY_MAX,
): string | undefined {
  const amount = typeof value === 'string' ? parseOrderDecimal(value) : null
  if (amount === null) return 'Use a decimal with at most two decimal places.'
  if (positive && amount === 0n) return 'Quantity must be greater than zero.'
  if (amount > maximum)
    return `Value exceeds ${maximum === QUANTITY_MAX ? '9,999,999,999.99' : '999,999,999,999.99'}.`
}

export function requireDecimalLimit(
  value: string,
  label: string,
  positive = false,
  maximum = QUANTITY_MAX,
) {
  const error = decimalLimitError(value, positive, maximum)
  if (error) throw Error(`${label}: ${error}`)
  return value
}
