import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { OrderDetailFooter } from './OrderDetailFooter'
it('omits an empty secondary menu and keeps only Close and the supplied primary action on the right', () => {
  const close = vi.fn(),
    confirm = vi.fn()
  render(
    <OrderDetailFooter
      label="Order actions"
      onClose={close}
      secondaryActions={[]}
      primaryAction={{ label: 'Confirm Order', onSelect: confirm }}
    />,
  )
  expect(screen.queryByRole('button', { name: 'More Actions' })).toBeNull()
  const right = screen.getByRole('button', { name: 'Close' }).parentElement!
  expect(
    within(right)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['Close', 'Confirm Order'])
  expect(close).not.toHaveBeenCalled()
  expect(confirm).not.toHaveBeenCalled()
})
it('supports keyboard opening, navigation, selection and focus restoration without executing on open', async () => {
  const user = userEvent.setup(),
    edit = vi.fn(),
    cancel = vi.fn()
  render(
    <OrderDetailFooter
      label="Order actions"
      onClose={vi.fn()}
      secondaryActions={[
        { label: 'Edit Draft', onSelect: edit },
        { label: 'Unavailable export', onSelect: vi.fn(), disabled: true },
        { label: 'Cancel Order', onSelect: cancel, destructive: true },
      ]}
      primaryAction={{ label: 'Confirm Order', onSelect: vi.fn() }}
    />,
  )
  const trigger = screen.getByRole('button', { name: 'More Actions' })
  trigger.focus()
  await user.keyboard('{Enter}')
  expect(await screen.findByRole('menu')).toBeTruthy()
  expect(edit).not.toHaveBeenCalled()
  expect(cancel).not.toHaveBeenCalled()
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Edit Draft' })),
  )
  await user.keyboard('{ArrowDown}')
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Cancel Order' }))
  expect(screen.getByRole('separator')).toBeTruthy()
  await user.keyboard('{Escape}')
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  expect(document.activeElement).toBe(trigger)
  await user.keyboard('{Enter}')
  await user.keyboard('{Enter}')
  expect(edit).toHaveBeenCalledOnce()
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  expect(cancel).not.toHaveBeenCalled()
  await waitFor(() => expect(document.activeElement).toBe(trigger))
})
it('disables the footer during a pending operation', async () => {
  const select = vi.fn()
  render(
    <OrderDetailFooter
      label="Order actions"
      busy
      onClose={select}
      secondaryActions={[{ label: 'Edit Draft', onSelect: select }]}
      primaryAction={{ label: 'Confirming...', onSelect: select }}
    />,
  )
  screen
    .getAllByRole('button')
    .forEach((button) => expect((button as HTMLButtonElement).disabled).toBe(true))
  await userEvent.click(screen.getByRole('button', { name: 'More Actions' }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(select).not.toHaveBeenCalled()
})
it('allows a destructive-only menu without a redundant separator', async () => {
  render(
    <OrderDetailFooter
      label="Order actions"
      onClose={vi.fn()}
      secondaryActions={[{ label: 'Cancel Order', onSelect: vi.fn(), destructive: true }]}
    />,
  )
  await userEvent.click(screen.getByRole('button', { name: 'More Actions' }))
  expect(screen.getByRole('menuitem', { name: 'Cancel Order' })).toBeTruthy()
  expect(screen.queryByRole('separator')).toBeNull()
})
