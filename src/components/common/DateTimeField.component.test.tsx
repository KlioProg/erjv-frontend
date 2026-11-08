import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { DateTimeField } from './DateTimeField'
import { manilaScheduleToIso, toManilaSchedule } from '@/lib/manila-schedule'

function mount(initial = '', required = false) {
  const submit = vi.fn()
  function Form() {
    const [value, setValue] = useState(initial)
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault()
          submit(manilaScheduleToIso(value))
        }}
      >
        <DateTimeField
          id="schedule"
          label="Schedule"
          value={value}
          onChange={setValue}
          required={required}
        />
        <output aria-label="Saved value">{value}</output>
        <button>Save</button>
      </form>
    )
  }
  render(<Form />)
  return submit
}

it.each(['08:00', '09:40', '10:17', '14:55', '23:59', '00:00', '12:00'])(
  'accepts 24-hour %s and round trips in Manila',
  async (time) => {
    const submit = mount()
    fireEvent.change(screen.getByLabelText('Schedule Date'), { target: { value: '2026-11-05' } })
    await userEvent.type(screen.getByLabelText('Schedule Time'), time)
    expect(screen.queryByRole('combobox')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    const wallTime = `2026-11-05T${time}`
    expect(submit).toHaveBeenCalledWith(manilaScheduleToIso(wallTime))
    expect(toManilaSchedule(manilaScheduleToIso(wallTime))).toBe(wallTime)
  },
)

it.each(['24:00', '14:60', '9:40', '12:99', 'ab:cd', '2400', '2360', '0969'])('blocks invalid time %s', async (time) => {
  const submit = mount('2026-11-05T09:40')
  fireEvent.change(screen.getByLabelText('Schedule Time'), { target: { value: time } })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Schedule Time').getAttribute('aria-invalid')).toBe('true')
})

it.each([
  ['0800', '08:00', '2026-11-05T00:00:00.000Z'],
  ['0940', '09:40', '2026-11-05T01:40:00.000Z'],
  ['0000', '00:00', '2026-11-04T16:00:00.000Z'],
  ['2359', '23:59', '2026-11-05T15:59:00.000Z'],
])('normalizes completed %s to %s with the same Manila instant', async (typed, display, instant) => {
  const submit = mount('2026-11-05T')
  const time = screen.getByLabelText('Schedule Time') as HTMLInputElement
  await userEvent.type(time, typed)
  expect(time.value).toBe(display)
  expect(screen.getByLabelText('Saved value').textContent).toBe(`2026-11-05T${display}`)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).toHaveBeenCalledWith(instant)
  expect(toManilaSchedule(instant)).toBe(`2026-11-05T${display}`)
})

it('leaves partial time entry untouched until all four valid digits are complete', async () => {
  mount('2026-11-05T')
  const time = screen.getByLabelText('Schedule Time') as HTMLInputElement
  const user = userEvent.setup()
  await user.type(time, '080')
  expect(time.value).toBe('080')
  expect(document.activeElement).toBe(time)
  await user.type(time, '0')
  expect(time.value).toBe('08:00')
  expect(document.activeElement).toBe(time)
})

it('does not force formatting during a middle edit and normalizes compact time on blur', async () => {
  const submit = mount('2026-11-05T08:00')
  const time = screen.getByLabelText('Schedule Time') as HTMLInputElement
  time.focus()
  const user = userEvent.setup()
  await user.keyboard('{Home}{ArrowRight}{ArrowRight}{Delete}')
  expect(time.value).toBe('0800')
  expect(time.selectionStart).toBe(2)
  await user.tab()
  expect(time.value).toBe('08:00')
  await user.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).toHaveBeenCalledWith('2026-11-05T00:00:00.000Z')
})

it('does not normalize read-only or disabled values on blur', () => {
  const change = vi.fn()
  const { rerender } = render(<DateTimeField id="schedule" label="Schedule" value="2026-11-05T0800" onChange={change} readOnly />)
  fireEvent.blur(screen.getByLabelText('Schedule Time'))
  expect(change).not.toHaveBeenCalled()
  rerender(<DateTimeField id="schedule" label="Schedule" value="2026-11-05T0800" onChange={change} disabled />)
  fireEvent.blur(screen.getByLabelText('Schedule Time'))
  expect(change).not.toHaveBeenCalled()
})

it('allows an optional blank schedule but blocks either partial schedule', async () => {
  const submit = mount()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).toHaveBeenLastCalledWith(null)
  submit.mockClear()
  await userEvent.type(screen.getByLabelText('Schedule Time'), '10:17')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Clear schedule' }))
  fireEvent.change(screen.getByLabelText('Schedule Date'), { target: { value: '2026-11-05' } })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).not.toHaveBeenCalled()
})

it('requires both fields for a required schedule', async () => {
  const submit = mount('', true)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).not.toHaveBeenCalled()
  expect(screen.getByLabelText('Schedule Date').hasAttribute('required')).toBe(true)
})

it('initializes saved timestamps and preserves keyboard editing and descriptions', async () => {
  const submit = mount(toManilaSchedule('2026-11-05T01:40:00Z'))
  expect((screen.getByLabelText('Schedule Date') as HTMLInputElement).value).toBe('2026-11-05')
  const time = screen.getByLabelText('Schedule Time') as HTMLInputElement
  expect(time.value).toBe('09:40')
  time.focus()
  await userEvent.keyboard('{Control>}a{/Control}10:17')
  expect(screen.getByLabelText('Saved value').textContent).toBe('2026-11-05T10:17')
  expect(time.getAttribute('aria-describedby')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).toHaveBeenCalledWith('2026-11-05T02:17:00.000Z')
})

it('responds to controlled resets and supports disabled, read-only, constraints and errors', () => {
  const change = vi.fn()
  const { rerender } = render(
    <DateTimeField id="schedule" label="Schedule" value="2026-11-05T09:40" onChange={change} />,
  )
  rerender(<DateTimeField id="schedule" label="Schedule" value="" onChange={change} disabled />)
  expect((screen.getByLabelText('Schedule Time') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Schedule Time') as HTMLInputElement).disabled).toBe(true)
  rerender(
    <DateTimeField
      id="schedule"
      label="Schedule"
      value="2026-11-05T09:40"
      onChange={change}
      readOnly
      min="2026-11-06"
      max="2026-12-01"
      error="Review this schedule."
      helperText="Manila time"
    />,
  )
  expect((screen.getByLabelText('Schedule Time') as HTMLInputElement).readOnly).toBe(true)
  expect(screen.getByText('Review this schedule.')).toBeTruthy()
  expect((screen.getByLabelText('Schedule Date') as HTMLInputElement).checkValidity()).toBe(true) // Read-only fields do not participate in native validation.
})

it('blocks impossible dates and dates outside constraints', () => {
  for (const date of ['2026-02-30', '2026-11-05', '2027-01-01']) {
    const { unmount } = render(
      <DateTimeField
        id="schedule"
        label="Schedule"
        value={`${date}T09:40`}
        onChange={vi.fn()}
        min="2026-11-06"
        max="2026-12-01"
      />,
    )
    expect((screen.getByLabelText('Schedule Date') as HTMLInputElement).checkValidity()).toBe(false)
    unmount()
  }
})

it('supports every minute and rejects invalid serialization without browser timezone conversion', () => {
  for (let minute = 0; minute < 60; minute++) {
    const value = `2026-11-05T09:${String(minute).padStart(2, '0')}`
    expect(toManilaSchedule(manilaScheduleToIso(value))).toBe(value)
  }
  for (const value of ['2026-11-05', '2026-11-05T24:00', '2026-02-30T09:40'])
    expect(() => manilaScheduleToIso(value)).toThrow()
  expect(toManilaSchedule('invalid')).toBe('')
})
