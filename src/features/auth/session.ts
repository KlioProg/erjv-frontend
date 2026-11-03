/** Claims only schedule sign-out; the server profile remains the authentication authority. */
export function tokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3 || !parts.every((part) => /^[\w-]+$/.test(part))) return null
    const claims = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
    if (
      !Number.isSafeInteger(claims.iat) ||
      !Number.isSafeInteger(claims.exp) ||
      !Number.isSafeInteger(claims.ver) ||
      claims.ver < 0 ||
      claims.iat < 0 ||
      claims.exp <= claims.iat
    )
      return null
    const expiry = claims.exp * 1000
    return Number.isSafeInteger(expiry) ? expiry : null
  } catch {
    return null
  }
}

export function passwordError(password: string): string | null {
  // Match backend MinLength: surrogate pairs and emoji presentation selectors count once.
  const characters =
    Array.from(password).length - (password.match(/[^\uFE0F\uFE0E][\uFE0F\uFE0E]/g)?.length ?? 0)
  if (characters < 8) return 'Use at least 8 characters.'
  if (new TextEncoder().encode(password).length > 72)
    return 'Use a password of at most 72 UTF-8 bytes.'
  return null
}

export function requirePassword(password: string) {
  const error = passwordError(password)
  if (error) throw Error(error)
}
