import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { TableLoadError } from './TableLoadError'
it('keeps loading recovery visible with a retry action rather than an empty-result message', () => {
  const retry = vi.fn()
  const view = render(<TableLoadError message="Deliveries could not be loaded." onRetry={retry} />)
  expect(screen.getByRole('alert').textContent).toContain('Deliveries could not be loaded.')
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(retry).toHaveBeenCalledOnce()
  view.rerender(
    <TableLoadError message="Deliveries could not be loaded." onRetry={retry} retrying />,
  )
  expect(screen.getByRole('button', { name: 'Retrying…' }).hasAttribute('disabled')).toBe(true)
})
