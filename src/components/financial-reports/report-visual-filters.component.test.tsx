import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it } from 'vitest'
import { ReportVisualFilters } from './ReportVisualFilters'
import {
  changeReportFilters,
  type PeriodAction,
  type ReportFilterState,
} from '@/features/financial-reports/financial-report-periods'

const annual: ReportFilterState = {
  period: 'annual',
  anchor: '2024-10-15',
  itemId: '',
  warehouseId: '',
}

function mount(initial: ReportFilterState = annual) {
  const actions: PeriodAction[] = []
  function Harness() {
    const [filters, setFilters] = useState(initial)
    return (
      <ReportVisualFilters
        value={filters}
        today="2026-11-02"
        onChange={(action) => {
          actions.push(action)
          setFilters((current) => changeReportFilters(current, action))
        }}
      />
    )
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
  return actions
}

it('shows one Year input for annual, semiannual, and quarterly periods', async () => {
  const user = userEvent.setup()
  mount()
  const year = screen.getByLabelText('Year') as HTMLInputElement
  expect(year.type).toBe('text')
  expect(year.maxLength).toBe(4)
  expect(year.inputMode).toBe('numeric')
  expect(screen.queryByLabelText(/From/)).toBeNull()
  expect(screen.queryByLabelText(/Through/)).toBeNull()
  expect(screen.queryByRole('button', { name: 'Apply filters' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Refresh report' })).toBeNull()

  const semiannual = screen.getByRole('button', { name: 'Semi-Annual' })
  await user.click(semiannual)
  expect(screen.getByLabelText('Year')).toBe(year)
  expect(screen.getByText('H2 · July–December')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Quarterly' }))
  expect(screen.getByText('Q4 · October–December')).toBeTruthy()
})

it('automatically applies a complete year while retaining focus and the input node', async () => {
  const user = userEvent.setup()
  const actions = mount({ ...annual, period: 'quarterly' })
  const year = screen.getByLabelText('Year') as HTMLInputElement
  await user.clear(year)
  await user.type(year, '202')
  expect(actions).toHaveLength(0)
  await user.type(year, '5')
  await waitFor(() => expect(actions).toEqual([{ type: 'year', value: 2025 }]))
  expect(screen.getByLabelText('Year')).toBe(year)
  expect(document.activeElement).toBe(year)
  expect(year.value).toBe('2025')
  expect(year.selectionStart).toBe(4)
  expect(screen.getByText('Q4 · October–December')).toBeTruthy()
})

it('restores partial year text on Escape or blur without applying it', async () => {
  const user = userEvent.setup()
  const actions = mount()
  const year = screen.getByLabelText('Year') as HTMLInputElement
  await user.clear(year)
  await user.type(year, '20')
  expect(actions).toHaveLength(0)
  await user.keyboard('{Escape}')
  expect(year.value).toBe('2024')
  expect(actions).toHaveLength(0)

  await user.clear(year)
  await user.type(year, '2026')
  expect(actions).toHaveLength(1)
  await user.clear(year)
  await user.type(year, '20')
  await user.tab()
  expect(year.value).toBe('2026')
  expect(screen.getByText(/No change applied/)).toBeTruthy()
  expect(actions).toHaveLength(1)
})

it('rejects malformed or overlength paste before replacing the raw year', () => {
  const actions = mount()
  const year = screen.getByLabelText('Year') as HTMLInputElement
  fireEvent.change(year, { target: { value: '20' } })
  fireEvent.paste(year, { clipboardData: { getData: () => 'x2026' } })
  expect(year.value).toBe('20')
  fireEvent.paste(year, { clipboardData: { getData: () => '20245' } })
  expect(year.value).toBe('20')
  expect(actions).toHaveLength(0)
})

it('uses a Month dropdown and read-only year context for monthly periods', async () => {
  const user = userEvent.setup()
  const actions = mount({ ...annual, period: 'monthly', anchor: '2026-11-15' })
  expect(screen.queryByLabelText('Year')).toBeNull()
  expect(screen.getByText('Year · 2026')).toBeTruthy()
  await user.click(screen.getByRole('combobox', { name: 'Month' }))
  await user.click(await screen.findByRole('option', { name: 'February' }))
  expect(actions).toContainEqual({ type: 'month', value: 2 })
})

it('uses dated Monday–Sunday week options and a read-only ISO year', async () => {
  const user = userEvent.setup()
  const actions = mount({ ...annual, period: 'weekly', anchor: '2027-01-01' })
  expect(screen.queryByLabelText('Year')).toBeNull()
  expect(screen.getByText('Year · 2026')).toBeTruthy()
  await user.click(screen.getByRole('combobox', { name: 'Week' }))
  const week = await screen.findByRole('option', { name: 'December 28, 2026 – January 3, 2027' })
  expect(week).toBeTruthy()
  await user.click(await screen.findByRole('option', { name: 'January 5 – January 11, 2026' }))
  expect(actions).toContainEqual({ type: 'week', value: 2 })
})

it('discards unfinished year text when stepping and reset clears scoped IDs', async () => {
  const user = userEvent.setup()
  const actions = mount({ ...annual, period: 'quarterly', itemId: '101', warehouseId: '2' })
  const year = screen.getByLabelText('Year') as HTMLInputElement
  await user.clear(year)
  await user.type(year, '20')
  await user.click(screen.getByRole('button', { name: 'Previous period' }))
  expect(actions).toContainEqual({ type: 'step', value: -1 })
  expect(year.value).toBe('2024')
  await user.click(screen.getByRole('button', { name: 'Reset filters' }))
  expect(actions.at(-1)).toEqual({ type: 'reset', today: '2026-11-02' })
})

it('discloses advanced filters, shows active scopes and preserves them when collapsed', async () => {
  const user = userEvent.setup()
  const actions = mount({ ...annual, itemId: '101', warehouseId: '2' })
  const toggle = screen.getByRole('button', { name: 'Advanced filters (2 active)' })
  expect(toggle.getAttribute('aria-expanded')).toBe('true')
  expect(screen.getByText(/Selected item.*Selected warehouse/)).toBeTruthy()
  await user.click(toggle)
  expect(screen.queryByRole('button', { name: 'Clear item' })).toBeNull()
  expect(toggle.getAttribute('aria-expanded')).toBe('false')
  await user.click(toggle)
  await user.click(screen.getByRole('button', { name: 'Clear item' }))
  expect(actions.at(-1)).toEqual({ type: 'itemId', value: '' })
  expect(screen.getByRole('button', { name: 'Advanced filters (1 active)' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Reset filters' }))
  expect(actions.at(-1)).toEqual({ type: 'reset', today: '2026-11-02' })
  expect(screen.getByText(/All items.*All warehouses/)).toBeTruthy()
})
