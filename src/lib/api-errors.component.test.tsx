import { expect, it } from 'vitest'
import { getErrorMessage } from './api-client'

it('replaces numeric route validation with recovery guidance', () => {
  const message = getErrorMessage({ isAxiosError: true, response: {
    status: 400, data: { message: 'Validation failed (numeric string is expected)' },
  } })
  expect(message).toContain('Refresh')
  expect(message).toContain('administrator')
  expect(message).not.toMatch(/numeric string|validation/i)
})
