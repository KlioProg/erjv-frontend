import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { RegisterUserModal } from './RegisterUserModal'

const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }))
vi.mock('@/features/staffing/staffing.hooks', () => ({
  useRegisterUser: () => ({ mutateAsync, isPending: false }),
  useEmployees: () => ({
    data: [{ id: 7, firstName: 'Alexandra'.repeat(8), lastName: 'Rivera', isActive: true }],
  }),
  useUsers: () => ({ data: [] }),
}))

beforeEach(() => mutateAsync.mockReset())

it('keeps descriptions outside the collapsed role trigger and preserves keyboard selection', async () => {
  const user = userEvent.setup()
  render(<RegisterUserModal open onClose={vi.fn()} />)
  const trigger = screen.getByRole('combobox', { name: 'System Role & Permissions' })
  expect(trigger.textContent).toBe('STAFF (Restricted)')
  expect(document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent).toBe(
    'Standard POS sales and restricted operational access',
  )
  trigger.focus()
  await user.keyboard('{ArrowDown}{End}')
  expect(screen.getByRole('option', { name: /ADMIN/ }).textContent).toContain(
    'Full administrative authority, user registration, and system configuration',
  )
  await user.keyboard('{Enter}')
  expect(trigger.textContent).toBe('ADMIN (Administrator)')
  expect(document.getElementById(trigger.getAttribute('aria-describedby')!)?.textContent).toBe(
    'Full administrative authority, user registration, and system configuration',
  )
  expect(document.activeElement).toBe(trigger)
  await user.keyboard('{ArrowDown}{Home}{ArrowDown}{Enter}')
  expect(trigger.textContent).toBe('MANAGER (Operations)')
})

it('preserves password validation and the registration payload with staff linking', async () => {
  const user = userEvent.setup()
  const onClose = vi.fn()
  render(<RegisterUserModal open onClose={onClose} />)
  fireEvent.change(screen.getByLabelText('Work Email Address'), {
    target: { value: 'staff@example.com' },
  })
  fireEvent.change(screen.getByLabelText('Initial Password'), { target: { value: 'password123' } })
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'different123' } })
  await user.click(screen.getByRole('button', { name: 'Register Account' }))
  expect(screen.getByRole('alert').textContent).toContain('Passwords do not match.')
  expect(mutateAsync).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password123' } })
  screen.getByRole('combobox', { name: /Link to Staff Profile/ }).focus()
  await user.keyboard('{ArrowDown}{End}{Enter}')
  await user.click(screen.getByRole('button', { name: 'Register Account' }))
  expect(mutateAsync).toHaveBeenCalledWith({
    email: 'staff@example.com',
    password: 'password123',
    role: 'STAFF',
    employeeId: 7,
  })
  expect(onClose).toHaveBeenCalled()
})
