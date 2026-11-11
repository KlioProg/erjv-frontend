import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { Input } from './input'
import { Label } from './label'

it('shows linked native errors only after submission and focuses the first invalid field', async () => {
  const save = vi.fn()
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <Label htmlFor="name">
        Customer name <span aria-hidden="true">*</span>
      </Label>
      <Input id="name" required />
      <Label htmlFor="email">Email</Label>
      <Input id="email" type="email" />
      <button>Save</button>
    </form>,
  )
  expect(screen.queryByRole('alert')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  const name = screen.getByRole('textbox', { name: 'Customer name' })
  expect(screen.getByRole('alert').textContent).toBe('Customer name is required.')
  expect(name.getAttribute('aria-invalid')).toBe('true')
  expect(document.getElementById(name.getAttribute('aria-describedby')!)?.textContent).toBe(
    'Customer name is required.',
  )
  expect(document.activeElement).toBe(name)
  await userEvent.type(name, 'Buyer')
  expect(screen.queryByRole('alert')).toBeNull()
  await userEvent.type(screen.getByLabelText('Email'), 'invalid')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByRole('alert').textContent).toContain('email address')
  expect((name as HTMLInputElement).value).toBe('Buyer')
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: '' } })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(save).toHaveBeenCalledOnce()
})

it('keeps domain validation and caller invalid handlers authoritative', () => {
  const invalid = vi.fn((event: React.InvalidEvent<HTMLInputElement>) => event.preventDefault())
  render(
    <>
      <Input
        aria-label="Quantity"
        required
        aria-invalid
        aria-describedby="quantity-error"
        onInvalid={invalid}
      />
      <p id="quantity-error" role="alert">
        Enter the counted quantity.
      </p>
    </>,
  )
  fireEvent.invalid(screen.getByLabelText('Quantity'))
  expect(invalid).toHaveBeenCalledOnce()
  expect(screen.getAllByRole('alert')).toHaveLength(1)
})

it('clears a stale native requirement error when the action makes the field optional', async () => {
  const save = vi.fn()
  const form = (required: boolean) => (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <Input aria-label="Reference" value="" onChange={() => {}} required={required} />
      <button>Save</button>
    </form>
  )
  const view = render(form(true))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(screen.getByRole('alert').textContent).toBe('Reference is required.')
  view.rerender(form(false))
  expect(screen.queryByRole('alert')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(save).toHaveBeenCalledOnce()
})
