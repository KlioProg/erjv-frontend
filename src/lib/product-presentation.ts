import { formatProductUnit } from './product-unit'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'

export type ProductDescription = { name: string; variety?: string | null; unit?: string | null }

export function formatProductLabel(
  product?: ProductDescription,
  fallback = 'Product unavailable',
): string {
  if (!product) return fallback
  const name = product.name?.trim() ? product.name : fallback
  const variety = product.variety?.trim()
  return variety && variety.toLocaleLowerCase() !== name.trim().toLocaleLowerCase()
    ? `${name} · ${variety}`
    : name
}

/** Display only. Keep arbitrary decimal precision and large values out of Number conversion. */
export function formatReadOnlyQuantity(
  value: string | number | null | undefined,
  unit?: string | null,
  fallback = '—',
): string {
  if (value == null || value === '') return fallback
  const raw = String(value).trim()
  if (!raw) return fallback
  const trimmed = /^[+-]?\d+(?:\.\d+)?$/.test(raw)
    ? raw.replace(/(\.\d*?[1-9])0+$|\.0+$/, '$1')
    : raw
  const cents = parseStockCents(trimmed)
  const quantity = cents !== null ? formatStockCents(cents) : trimmed
  return `${quantity} ${formatProductUnit(unit, 'Unit unavailable')}`
}
