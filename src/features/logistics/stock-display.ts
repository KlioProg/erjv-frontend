/** Backend stock balances use decimal strings with up to two fractional digits. */
export function parseStockCents(value: unknown): bigint | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) return null
  const [whole, fraction = ''] = raw.split('.')
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'))
}

export function formatStockCents(cents: bigint | null): string {
  if (cents === null) return '—'
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = (cents % 100n).toString().padStart(2, '0').replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

export function stockSortKey(cents: bigint | null): string | null {
  if (cents === null) return null
  const digits = cents.toString()
  return `${digits.length.toString().padStart(6, '0')}:${digits}`
}
