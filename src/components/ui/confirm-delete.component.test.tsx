import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ConfirmDeleteModal } from './ConfirmDeleteModal'

it('keeps failure feedback available for retry and clears it for the next confirmation', async () => {
  const user = userEvent.setup()
  const props = {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn().mockRejectedValue(new Error('Archive unavailable')),
    title: 'Archive customer',
  }
  const view = render(<ConfirmDeleteModal {...props} />)
  await user.click(screen.getByRole('button', { name: 'Deactivate' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Archive unavailable')
  expect(props.onClose).not.toHaveBeenCalled()
  view.rerender(<ConfirmDeleteModal {...props} open={false} />)
  view.rerender(<ConfirmDeleteModal {...props} itemName="Another customer" />)
  expect(screen.queryByRole('alert')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
})
