import { parseStockCents } from './stock-display.ts'
import type { SupplierProductPrice } from './supplier-pricing.types'

export type PurchaseLine = {
  id: string
  inventoryItemId: number
  name: string
  variety?: string | null
  unit: string
  quantity: string
  unitCost: string
}

export function purchaseDecimal(value: string, precision = 14): bigint | null {
  const scaled = parseStockCents(value)
  return scaled !== null && scaled < 10n ** BigInt(precision) ? scaled : null
}

export function decimalString(scaled: bigint): string {
  return `${scaled / 100n}.${(scaled % 100n).toString().padStart(2, '0')}`
}

/** Same half-up, per-line rounding as the backend; quantity and money stay exact. */
export function purchaseLineTotal(
  line: Pick<PurchaseLine, 'quantity' | 'unitCost'>,
): bigint | null {
  const quantity = purchaseDecimal(line.quantity, 12)
  const cost = purchaseDecimal(line.unitCost)
  if (quantity === null || quantity <= 0n || cost === null) return null
  const total = (quantity * cost + 50n) / 100n
  return total < 10n ** 14n ? total : null
}

export function purchaseTotal(lines: Pick<PurchaseLine, 'quantity' | 'unitCost'>[]): bigint | null {
  let total = 0n
  for (const line of lines) {
    const subtotal = purchaseLineTotal(line)
    if (subtotal === null) return null
    total += subtotal
  }
  return total
}

export function formatPurchaseMoney(cents: bigint | null): string {
  if (cents === null) return '—'
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `₱${whole}.${(cents % 100n).toString().padStart(2, '0')}`
}

export function supplierReferenceCost(
  prices: SupplierProductPrice[],
  inventoryItemId: number,
): string {
  const price = prices.find((row) => row.inventoryItemId === inventoryItemId)?.latestUnitCost
  const cents = price === null || price === undefined ? null : purchaseDecimal(price)
  return cents === null ? '' : decimalString(cents)
}

/** Deliberate supplier review replaces references; missing quotes remain empty. */
export function repricePurchaseLines(
  lines: PurchaseLine[],
  prices: SupplierProductPrice[],
): PurchaseLine[] {
  return lines.map((line) => ({
    ...line,
    unitCost: supplierReferenceCost(prices, line.inventoryItemId),
  }))
}

/** Historical totals read only the stored line amounts, never today's quotes. */
export function storedPurchaseTotal(items: { totalAmount: string }[]): bigint | null {
  let total = 0n
  for (const item of items) {
    const amount = parseStockCents(item.totalAmount)
    if (amount === null) return null
    total += amount
  }
  return total
}
