/**
 * Utilities for Philippine phone and contact number formatting and validation.
 * Standard format: Exactly 11 digits starting with "09" (e.g., 09171234567).
 */

/**
 * Cleans user input to keep only digits up to 11 characters.
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

  // Strip all non-digit characters and clamp to 11 digits
  return cleaned.replace(/\D/g, '').slice(0, 11)
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

  const digits = sanitizePhilippinePhone(phone)

  if (digits.length !== 11) {
    return `${fieldName} must be exactly 11 digits (e.g., 09171234567). Currently ${digits.length} digit${digits.length === 1 ? '' : 's'}.`
  }

  if (!digits.startsWith('09')) {
    return `${fieldName} must start with standard Philippine prefix "09" (e.g., 09171234567).`
  }

  return null
}
