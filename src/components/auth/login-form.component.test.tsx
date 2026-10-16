import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import LoginForm from './LoginForm'

it('lets a keyboard user reveal the password without submitting or changing its value', async () => {
  const user = userEvent.setup()
  const submit = vi.fn()
  render(
    <LoginForm onSubmit={submit} isSubmitting={false} errorMessage="" successMessage="" />,
  )
  const password = screen.getByLabelText('Password') as HTMLInputElement
  await user.tab()
  await user.tab()
  expect(document.activeElement).toBe(password)
  await user.keyboard('example-password')
  await user.tab()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Show password' }))
  await user.keyboard('{Enter}')
  expect(password.type).toBe('text')
  expect(password.value).toBe('example-password')
  expect(submit).not.toHaveBeenCalled()
})
