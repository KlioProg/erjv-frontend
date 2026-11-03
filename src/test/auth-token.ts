export function testToken(claims: Record<string, unknown> = {}) {
  const iat = Math.floor(Date.now() / 1000)
  return `eyJhbGciOiJIUzI1NiJ9.${btoa(JSON.stringify({ iat, exp: iat + 3600, ver: 0, ...claims })).replace(/=/g, '')}.signature`
}
