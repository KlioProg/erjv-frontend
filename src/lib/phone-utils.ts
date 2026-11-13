// Verified against Google's maintained PH metadata on 2026-11-12 (format, not reachability).
// https://github.com/google/libphonenumber/blob/master/resources/PhoneNumberMetadata.xml#L24045
const PH_MOBILE =
  /^(?:8(?:1[37]|9[5-8])|9(?:0[5-9]|1[0-24-9]|[235-7]\d|4[2-9]|8[135-9]|9[1-9]))\d{7}$/
export const MOBILE_FORMAT_ERROR = 'Enter a valid Philippine mobile number.'
export const MOBILE_LENGTH_ERROR = 'Enter 10 digits after +63.'

function compactPhone(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!/^\+?[\d(][\d\s().-]*$/.test(trimmed)) return null
  return trimmed.replace(/[\s().-]/g, '')
}

/** Removes only recognized prefixes/formatting, never arbitrary leading or excess digits. */
export function mobileNationalNumber(value: string): string {
  const compact = compactPhone(value)
  if (compact === null) return value.trim()
  if (compact.startsWith('+63')) return compact.slice(3)
  if (compact.startsWith('63') && compact.length >= 12) return compact.slice(2)
  if (compact.startsWith('0')) return compact.slice(1)
  return compact
}

export function normalizePhilippineMobile(value: string): string | null {
  if (compactPhone(value) === null) return null
  const national = mobileNationalNumber(value)
  return PH_MOBILE.test(national) ? `+63${national}` : null
}

/** General contact fields retain genuine landlines/international numbers and invalid legacy text. */
export function normalizeContactPhone(value: string): string {
  return normalizePhilippineMobile(value) ?? value.trim()
}

/** Backward-compatible utility name; invalid text is preserved rather than repaired by guessing. */
export function sanitizePhilippinePhone(value: string): string {
  return normalizeContactPhone(value)
}

export function validatePhilippinePhone(value?: string | null): string | null {
  if (!value?.trim()) return null
  const compact = compactPhone(value)
  if (compact === null || !/^\d*$/.test(mobileNationalNumber(value))) return MOBILE_FORMAT_ERROR
  const national = mobileNationalNumber(value)
  if (national.length !== 10) return MOBILE_LENGTH_ERROR
  return PH_MOBILE.test(national) ? null : MOBILE_FORMAT_ERROR
}

/** Distinguishes mobile-looking contacts from real PH landlines (e.g. 02, 082, 084). */
export function isMobileContact(value: string): boolean {
  const compact = value.trim().replace(/[\s().-]/g, '')
  return /^(?:0|\+?63)?(?:9|8[19])/.test(compact)
}

export function validateContactPhone(value: string): string | null {
  if (!value.trim()) return null
  if (isMobileContact(value)) return validatePhilippinePhone(value)
  const compact = compactPhone(value)
  return compact !== null && /^\+?\d{7,15}$/.test(compact)
    ? null
    : 'Enter a valid phone number, including the area or country code.'
}

/** Formatting has no side effects and never changes non-mobile contacts. */
export function formatContactPhone(value?: string | null): string {
  if (!value) return ''
  const mobile = normalizePhilippineMobile(value)
  return mobile ? `+63 ${mobile.slice(3, 6)} ${mobile.slice(6, 9)} ${mobile.slice(9)}` : value
}
