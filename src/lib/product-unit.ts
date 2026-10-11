/** Display label only: stored units and request payloads retain their original values. */
export function formatProductUnit(unit: string | null | undefined, fallback = ''): string {
  if (!unit?.trim()) return fallback
  return /^(?:pieces?|piece\(s\)|pcs?\.?)$/i.test(unit.trim()) ? 'piece(s)' : unit
}
