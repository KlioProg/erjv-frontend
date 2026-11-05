/** Minute-precision wall time for logistics inputs, independent of the computer timezone. */
export function toManilaSchedule(value: string | null | undefined): string {
  if (!value) return ''
  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp)
    ? ''
    : new Date(timestamp + 8 * 3_600_000).toISOString().slice(0, 16)
}

export function manilaScheduleToIso(value: string): string | null {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw Error('Choose a complete date and time.')
  const timestamp = Date.parse(`${value}:00+08:00`)
  if (Number.isNaN(timestamp) || toManilaSchedule(new Date(timestamp).toISOString()) !== value)
    throw Error('Choose a valid date and time.')
  return new Date(timestamp).toISOString()
}
