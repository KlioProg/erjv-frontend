import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { PhilippineMobileInput } from './PhilippineMobileInput'
import { PhoneInput } from './PhoneInput'
import {
  formatContactPhone,
  normalizePhilippineMobile,
  normalizeContactPhone,
  validatePhilippinePhone,
} from '@/lib/phone-utils'

it.each([PhilippineMobileInput, PhoneInput])(
  'preserves read-only contacts when paste events are dispatched',
  (Component) => {
    const change = vi.fn()
    render(<Component id="locked-contact" value="+639171234567" readOnly onValueChange={change} />)
    fireEvent.paste(document.getElementById('locked-contact')!, {
      clipboardData: { getData: () => '+1 202 555 0123' },
    })
    expect(change).not.toHaveBeenCalled()
  },
)

it('lets an employee explicitly clear a rejected paste on an optional empty input', async () => {
  const save = vi.fn()
  render(<Form save={save} />)
  await userEvent.click(screen.getByLabelText('Mobile Number'))
  await userEvent.paste('invalid')
  expect(screen.getByRole('alert')).toBeTruthy()
  await userEvent.keyboard('{Backspace}')
  expect(screen.queryByRole('alert')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(save).toHaveBeenCalledWith('')
})

it('supports selection replacement and edits in the middle of the national number', async () => {
  render(<Form initial="+639171234567" />)
  const input = screen.getByLabelText('Mobile Number') as HTMLInputElement
  input.focus()
  input.setSelectionRange(3, 6)
  await userEvent.keyboard('456')
  expect(input.value).toBe('9174564567')
  input.setSelectionRange(0, input.value.length)
  await userEvent.keyboard('8171234567')
  expect(input.value).toBe('8171234567')
  expect(screen.queryByRole('alert')).toBeNull()
})

function Form({ initial = '', required = false, save = vi.fn(), change = vi.fn() }) {
  const [value, setValue] = useState(initial)
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save(normalizeContactPhone(value))
      }}
    >
      <label htmlFor="mobile">Mobile Number</label>
      <PhilippineMobileInput
        id="mobile"
        value={value}
        required={required}
        onValueChange={(next) => {
          setValue(next)
          change(next)
        }}
      />
      <output data-testid="stored-value">{value}</output>
      <button>Save</button>
    </form>
  )
}
it.each([
  '9171234567',
  '09171234567',
  '639171234567',
  '+639171234567',
  '+63 917 123 4567',
  '+63 (917) 123-4567',
  '08171234567',
])('accepts safe mobile paste %s and saves international format', async (phone) => {
  const save = vi.fn()
  render(<Form save={save} />)
  await userEvent.click(screen.getByLabelText('Mobile Number'))
  await userEvent.paste(phone)
  expect((screen.getByLabelText('Mobile Number') as HTMLInputElement).value).toBe(
    phone.includes('817') ? '8171234567' : '9171234567',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(save).toHaveBeenCalledWith(phone.includes('817') ? '+638171234567' : '+639171234567')
})
it.each([
  '091712345678',
  '+6391712345678',
  '+63639171234567',
  '0917abc1234567',
  '+1 917 123 4567',
  '9131234567',
  '+63 2 8123 4567',
])('rejects unsafe paste %s without manufacturing a valid number', async (phone) => {
  const save = vi.fn()
  render(<Form save={save} />)
  await userEvent.click(screen.getByLabelText('Mobile Number'))
  await userEvent.paste(phone)
  expect((screen.getByLabelText('Mobile Number') as HTMLInputElement).value).toBe('')
  expect(await screen.findByRole('alert')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(save).not.toHaveBeenCalled()
})
it('supports keyboard editing and backspacing without allowing an excess digit to be silently saved', async () => {
  const save = vi.fn()
  render(<Form save={save} />)
  const input = screen.getByLabelText('Mobile Number') as HTMLInputElement
  await userEvent.type(input, '9171234567')
  await userEvent.keyboard('8')
  expect(input.value).toBe('9171234567')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(save).not.toHaveBeenCalled()
  input.focus()
  await userEvent.keyboard('{Backspace}7')
  expect(input.value).toBe('9171234567')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(save).toHaveBeenCalledWith('+639171234567')
})
it.each([false, true])(
  'preserves required=%s and associates the fixed prefix and errors',
  async (required) => {
    const save = vi.fn()
    render(<Form required={required} save={save} />)
    const input = screen.getByLabelText('Mobile Number') as HTMLInputElement
    expect(input.type).toBe('tel')
    expect(input.inputMode).toBe('numeric')
    expect(input.getAttribute('aria-describedby')).toContain('mobile-prefix')
    expect(screen.getByText('+63')).toBeTruthy()
    expect(screen.queryByRole('alert')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(save).toHaveBeenCalledTimes(required ? 0 : 1)
    if (required) {
      expect(screen.getByRole('alert').id).toBeTruthy()
      expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id)
    }
  },
)
it.each(['09171234567', '+639171234567', '639171234567'])(
  'loads legacy %s without changing the original state',
  (phone) => {
    const change = vi.fn()
    render(<Form initial={phone} change={change} />)
    expect((screen.getByLabelText('Mobile Number') as HTMLInputElement).value).toBe('9171234567')
    expect(screen.getByTestId('stored-value').textContent).toBe(phone)
    expect(change).not.toHaveBeenCalled()
  },
)
it('retains invalid legacy data without guessing, and validates partial edits on blur', async () => {
  const change = vi.fn()
  const view = render(<Form initial="unverified contact" change={change} />)
  expect((screen.getByLabelText('Mobile Number') as HTMLInputElement).value).toBe(
    'unverified contact',
  )
  expect(change).not.toHaveBeenCalled()
  expect(screen.queryByRole('alert')).toBeNull()
  view.unmount()
  render(<Form />)
  fireEvent.change(screen.getByLabelText('Mobile Number'), { target: { value: '917' } })
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.blur(screen.getByLabelText('Mobile Number'))
  expect(screen.getByRole('alert').textContent).toBe('Enter 10 digits after +63.')
})
it('uses verified mobile ranges without classifying landlines as mobiles or rewriting their formatting', () => {
  expect(normalizePhilippineMobile('8951234567')).toBe('+638951234567')
  expect(normalizePhilippineMobile('9131234567')).toBeNull()
  expect(validatePhilippinePhone('917')).toBe('Enter 10 digits after +63.')
  for (const landline of ['(02) 8123 4567', '+63 2 8123 4567', '084-555-1111', '+1 202 555 0123']) {
    expect(normalizePhilippineMobile(landline)).toBeNull()
    expect(normalizeContactPhone(landline)).toBe(landline)
    expect(formatContactPhone(landline)).toBe(landline)
  }
  expect(formatContactPhone('09171234567')).toBe('+63 917 123 4567')
})
