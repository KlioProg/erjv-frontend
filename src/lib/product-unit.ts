/** Preferred values for new entries; existing custom units are never normalized. */
export const PRODUCT_UNIT_OPTIONS = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'pieces', label: 'Piece (pieces)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'sacks', label: 'Sack' },
  { value: 'boxes', label: 'Box' },
] as const

/** Display label only: stored units and request payloads retain their original values. */
export function formatProductUnit(unit: string | null | undefined, fallback = ''): string {
  if (!unit?.trim()) return fallback
  return /^(?:pieces?|piece\(s\)|pcs?\.?)$/i.test(unit.trim()) ? 'piece(s)' : unit
}
