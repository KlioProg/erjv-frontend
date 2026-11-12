import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { toast as sonner } from 'sonner'
import { toast } from '@/lib/notifications'
import { Toaster } from './sonner'

afterEach(() => {
  sonner.dismiss()
  vi.restoreAllMocks()
})
it('keeps operation errors readable and replaces repeated identical failures', () => {
  const error = vi.spyOn(sonner, 'error').mockReturnValue('error')
  toast.error('Could not save changes. Try again.')
  toast.error('Could not save changes. Try again.')
  const first = error.mock.calls[0][1]!
  expect(first.duration).toBe(Infinity)
  expect(first.id).toBe(error.mock.calls[1][1]?.id)
  expect(first.closeButton).toBe(true)
})
it('preserves operation-specific ids and recovery actions', () => {
  const success = vi.spyOn(sonner, 'success').mockReturnValue('saved')
  const action = { label: 'View delivery', onClick: vi.fn() }
  toast.success('Arrival scheduled.', { id: 'arrival-66', action })
  expect(success.mock.calls[0][1]).toMatchObject({ id: 'arrival-66', action, duration: 5000 })
})
it('keeps technical exception details out of employee notifications', () => {
  const error = vi.spyOn(sonner, 'error').mockReturnValue('error')
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {})
  toast.error('PrismaClientKnownRequestError: SQLSTATE 23505')
  expect(diagnostic).toHaveBeenCalledWith(
    '[Notification diagnostic]',
    'PrismaClientKnownRequestError: SQLSTATE 23505',
  )
  expect(error.mock.calls[0][0]).toBe(
    'The action could not be completed. Try again or contact your administrator.',
  )
})
it('uses one accessible upper-right notification surface with dismiss controls', async () => {
  render(<Toaster />)
  act(() => {
    toast.error('Could not cancel delivery. Try again.')
  })
  await screen.findByText('Could not cancel delivery. Try again.')
  const container = document.querySelector('[data-sonner-toaster]')!
  expect(container.getAttribute('data-x-position')).toBe('right')
  expect(container.getAttribute('data-y-position')).toBe('top')
  expect(document.querySelector('[aria-label^="Application notifications"]')).toBeTruthy()
  expect(document.querySelector('[aria-live="polite"]')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeTruthy()
  act(() => {
    toast.error('Could not cancel delivery. Try again.')
  })
  await waitFor(() =>
    expect(screen.getAllByText('Could not cancel delivery. Try again.')).toHaveLength(1),
  )
})

it('replaces loading feedback with one confirmed outcome using the same operation id', async () => {
  render(<Toaster />)
  act(() => {
    toast.loading('Saving delivery…', { id: 'delivery-save' })
  })
  await screen.findByText('Saving delivery…')
  act(() => {
    toast.success('Delivery saved.', { id: 'delivery-save' })
  })
  await screen.findByText('Delivery saved.')
  expect(screen.queryByText('Saving delivery…')).toBeNull()
  expect(document.querySelectorAll('[data-sonner-toast]')).toHaveLength(1)
})
it('keeps warnings and long recovery details readable until dismissed', () => {
  const warning = vi.spyOn(sonner, 'warning').mockReturnValue('warning')
  const description = 'The draft is saved. Review the current delivery before scheduling again.'
  toast.warning('Scheduling needs attention.', { description })
  expect(warning.mock.calls[0][1]).toMatchObject({
    description,
    duration: Infinity,
    closeButton: true,
  })
})
