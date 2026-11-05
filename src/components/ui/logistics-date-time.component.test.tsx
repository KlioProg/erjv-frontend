import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, it, vi } from 'vitest'
import { LogisticsDateTimeInput } from './LogisticsDateTimeInput'
import { manilaScheduleToIso, toManilaSchedule } from '@/lib/manila-schedule'

function mount(initial = '') {
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
        <LogisticsDateTimeInput id="schedule" label="Schedule" value={value} onChange={setValue} />
        <output aria-label="Saved value">{value}</output>
        <button>Save</button>
      </form>
    )
  }
  render(<Form />)
  return submit
}
async function enter(hour: string, minute: string, period: string) {
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-05' } })
  await userEvent.type(screen.getByRole('textbox', { name: 'Schedule hour' }), hour)
  await userEvent.type(screen.getByRole('textbox', { name: 'Schedule minute' }), minute)
  await userEvent.click(screen.getByRole('combobox', { name: 'Schedule AM or PM' }))
  await userEvent.click(screen.getByRole('option', { name: period }))
}
it.each([
  ['9', '40', 'AM', '01:40'],
  ['10', '17', 'AM', '02:17'],
  ['2', '55', 'PM', '06:55'],
  ['12', '00', 'AM', '16:00'],
  ['12', '00', 'PM', '04:00'],
])('accepts %s:%s %s in Manila', async (hour, minute, period, utc) => {
  const submit = mount()
  await enter(hour, minute, period)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).toHaveBeenCalledWith(
    `2026-11-${period === 'AM' && hour === '12' ? '04' : '05'}T${utc}:00.000Z`,
  )
})
it('accepts every minute without a fixed interval', () => {
  for (let minute = 0; minute < 60; minute++) {
    const value = `2026-11-05T09:${String(minute).padStart(2, '0')}`
    expect(toManilaSchedule(manilaScheduleToIso(value))).toBe(value)
  }
})
it('keeps optional schedules empty and blocks incomplete and invalid typed times', async () => {
  const submit = mount()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).toHaveBeenLastCalledWith(null)
  submit.mockClear()
  fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-05' } })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).not.toHaveBeenCalled()
  await userEvent.type(screen.getByRole('textbox', { name: 'Schedule hour' }), '13')
  await userEvent.type(screen.getByRole('textbox', { name: 'Schedule minute' }), '75')
  await userEvent.click(screen.getByRole('combobox'))
  await userEvent.click(screen.getByRole('option', { name: 'PM' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Clear schedule' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).toHaveBeenLastCalledWith(null)
})
it('preserves existing Manila dates and supports replacing minutes by keyboard', async () => {
  const original = '2026-11-05T01:40:00.000Z'
  const submit = mount(toManilaSchedule(original))
  expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-11-05')
  expect((screen.getByRole('textbox', { name: 'Schedule hour' }) as HTMLInputElement).value).toBe(
    '9',
  )
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).toHaveBeenLastCalledWith(original)
  const minute = screen.getByRole('textbox', { name: 'Schedule minute' })
  await userEvent.clear(minute)
  submit.mockClear()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).not.toHaveBeenCalled()
  await userEvent.type(minute, '17')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(submit).toHaveBeenLastCalledWith('2026-11-05T01:17:00.000Z')
  await userEvent.clear(minute)
  await userEvent.type(minute, '5')
  fireEvent.blur(minute)
  expect((minute as HTMLInputElement).value).toBe('05')
})
it('does not serialize partial, invalid calendar dates, or invalid 24-hour values', () => {
  for (const value of ['2026-11-05', '2026-11-05T13:75', '2026-02-30T09:40'])
    expect(() => manilaScheduleToIso(value)).toThrow()
  expect(toManilaSchedule('invalid')).toBe('')
})
