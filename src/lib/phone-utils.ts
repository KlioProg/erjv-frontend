/**
 * Philippine mobiles use 11 digits starting with 09; business contacts may use other formats.
 */

/**
 * Cleans mobile input without discarding excess digits needed for validation.
 * Handles pasted values with country code (+63 or 63) by converting them to leading '0'.
 */
export function sanitizePhilippinePhone(input: string): string {
  if (!input) return ''

  let cleaned = input.trim()

  // Convert international prefix +63 or 63 to local 0
  if (cleaned.startsWith('+63')) {
    cleaned = '0' + cleaned.slice(3)
  } else if (cleaned.startsWith('63') && cleaned.replace(/\D/g, '').length === 12) {
    cleaned = '0' + cleaned.slice(2)
  }

  return cleaned.replace(/\D/g, '')
}

/** Normalize equivalent Philippine mobiles; preserve other business contact formats. */
export function normalizeContactPhone(input: string): string {
  const compact = input.trim().replace(/[\s().-]/g, '')
  return /^(?:0|\+?63)9\d{9}$/.test(compact)
    ? sanitizePhilippinePhone(compact)
    : input.trim()
}

export function validateContactPhone(input: string): string | null {
  if (!input.trim()) return null
  const compact = input.trim().replace(/[\s().-]/g, '')
  if (/^(?:0|\+?63)9\d*$/.test(compact)) return validatePhilippinePhone(compact)
  if (!/^\+?\d{7,15}$/.test(compact))
    return 'Enter a valid phone number, including the area or country code.'
  return null
}

/**
 * Validates a Philippine phone number.
 * Returns null if valid (or empty/optional), or an error string if invalid.
 */
export function validatePhilippinePhone(
  phone: string | null | undefined,
  fieldName: string = 'Phone number',
): string | null {
  if (!phone || !phone.trim()) {
    return null // Field is optional unless required by caller
  }

  if (!/^\+?[\d\s().-]+$/.test(phone.trim())) return 'Enter a valid Philippine mobile phone number.'

  const digits = sanitizePhilippinePhone(phone)

  if (digits.length !== 11) {
    return `${fieldName} must be exactly 11 digits (e.g., 09171234567). Currently ${digits.length} digit${digits.length === 1 ? '' : 's'}.`
  }

  if (!digits.startsWith('09')) {
    return `${fieldName} must start with standard Philippine prefix "09" (e.g., 09171234567).`
  }

  return null
}

/** Display the national part without truncating digits or hiding invalid characters. */
export function mobileNationalNumber(value: string): string {
  return value.trim().replace(/[\s().-]/g, '').replace(/^(?:\+?63|0)/, '')
}
