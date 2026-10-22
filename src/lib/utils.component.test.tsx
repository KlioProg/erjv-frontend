import { expect, it } from 'vitest'
import { cn } from './utils'

it('keeps a custom UI font size independent of foreground color in either order', () => {
  expect(cn('text-primary-contrast-foreground', 'text-ui')).toBe(
    'text-primary-contrast-foreground text-ui',
  )
  expect(cn('text-ui', 'text-muted-foreground')).toBe('text-ui text-muted-foreground')
})

it('lets an explicit font size replace the UI font size without removing its foreground', () => {
  expect(cn('text-primary-contrast-foreground text-ui', 'text-sm')).toBe(
    'text-primary-contrast-foreground text-sm',
  )
})
