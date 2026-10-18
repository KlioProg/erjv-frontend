import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import LoginForm from './LoginForm'

it('lets a keyboard user reveal the password without submitting or changing its value', async () => {
  const user = userEvent.setup()
  const submit = vi.fn()
  render(<LoginForm onSubmit={submit} isSubmitting={false} errorMessage="" successMessage="" />)
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

it('describes validation errors on the affected fields', async () => {
  const user = userEvent.setup()
  render(<LoginForm onSubmit={vi.fn()} isSubmitting={false} errorMessage="" successMessage="" />)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
  for (const label of ['Email address', 'Password']) {
    const field = screen.getByLabelText(label)
    const description = field.getAttribute('aria-describedby')
    expect(description).toBeTruthy()
    expect(document.getElementById(description!)?.textContent).toBeTruthy()
  }
})

it('does not misidentify a service failure as incorrect credentials', () => {
  render(
    <LoginForm
      onSubmit={vi.fn()}
      isSubmitting={false}
      errorMessage="Service unavailable. Try again."
      successMessage=""
    />,
  )
  expect(screen.queryByText('Incorrect Email or Password')).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('Service unavailable. Try again.')
})
