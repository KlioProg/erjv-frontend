import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { ReportCalendar } from './ReportCalendar'
import { ReportLineChart } from './ReportCharts'
import type {
  ReportKind,
  ReportResult,
  ReportRow,
} from '@/features/financial-reports/financial-reports.types'
import type { ReportFilterState } from '@/features/financial-reports/financial-report-periods'

const zero = {
  subtotalAmount: '0.00',
  discountAmount: '0.00',
  taxableAmount: '0.00',
  taxAmount: '0.00',
  totalAmount: '0.00',
  eventCount: 0,
  orderCount: 0,
  partyCount: 0,
  quantitiesByUnit: {},
  estimatedGrossProfitAmount: '0.00',
}

function days(from: string, through: string): string[] {
  const result: string[] = []
  for (
    let time = Date.parse(`${from}T00:00:00.000Z`);
    time <= Date.parse(`${through}T00:00:00.000Z`);
    time += 86_400_000
  )
    result.push(new Date(time).toISOString().slice(0, 10))
  return result
}

function makeReport(
  dates: string[],
  amount: (kind: ReportKind, index: number) => string = () => '0.00',
): ReportResult {
  const rows: ReportRow[] = dates.map((key, index) => ({
    ...zero,
    key,
    totalAmount: amount('sales', index),
    estimatedGrossProfitAmount: amount('gross-profit-estimate', index),
  }))
  return {
    period: {
      from: `${dates[0]}T00:00:00+08:00`,
      before: `${dates.at(-1)}T00:00:00+08:00`,
      businessTimezone: 'Asia/Manila',
      asOf: '2027-01-11T00:00:00+08:00',
    },
    basis: 'RECONCILED_DELIVERIES',
    totals: { ...zero },
    rows,
    nextCursor: null,
  }
}

const annualRows = days('2024-01-01', '2024-12-31')

it.each([
  ['annual', annualRows, 12],
  ['semiannual', days('2024-01-01', '2024-06-30'), 6],
  ['quarterly', days('2024-10-01', '2024-12-31'), 3],
  ['monthly', days('2024-02-01', '2024-02-29'), 29],
  ['weekly', days('2026-12-28', '2027-01-03'), 7],
] as const)('%s periods use their specified chart point count', (period, dates, expected) => {
  const report = makeReport(dates, () => '1.00')
  const { container } = render(
    <ReportLineChart period={period} selected={['sales']} reports={{ sales: report }} />,
  )
  expect(container.querySelectorAll('circle[data-point-key]')).toHaveLength(expected)
})

it('shows exact values on keyboard and pointer with one chart tab stop', async () => {
  const user = userEvent.setup()
  const report = makeReport(['2024-02-01', '2024-02-02'], (_kind, index) =>
    index ? '2.00' : '1.00',
  )
  const { container } = render(
    <ReportLineChart
      period="monthly"
      selected={['sales', 'purchases']}
      reports={{ sales: report, purchases: report }}
    />,
  )
  const chart = screen.getByRole('img', { name: 'Financial trends in pesos' })
  expect(chart.getAttribute('tabindex')).toBe('0')
  expect(container.querySelectorAll('svg[tabindex="0"]')).toHaveLength(1)
  chart.focus()
  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toContain('Sales')
    expect(screen.getByRole('status').textContent).toContain('₱1.00')
  })
  await user.keyboard('{ArrowRight}')
  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toContain('February 2, 2024')
    expect(screen.getByRole('status').textContent).toContain('₱2.00')
  })
  await user.keyboard('{ArrowDown}')
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Purchases'))
  const point = container.querySelector('circle[data-series="sales"][data-point-key="2024-02-01"]')!
  fireEvent.mouseEnter(point)
  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toContain('February 1, 2024')
    expect(screen.getByRole('status').textContent).toContain('₱1.00')
  })
  await user.keyboard('{Escape}')
  expect(screen.getByRole('status').textContent).toBe('')
})

it('uses solid profit and distinct broken Sales and Purchases lines without exact-data controls', () => {
  const report = makeReport(['2024-01-01', '2024-01-02'], () => '1.00')
  const { container } = render(
    <ReportLineChart
      period="monthly"
      selected={['sales', 'purchases', 'gross-profit-estimate']}
      reports={{ sales: report, purchases: report, 'gross-profit-estimate': report }}
    />,
  )
  expect(
    container.querySelector('path[data-series="sales"]')?.getAttribute('stroke-dasharray'),
  ).toBe('7 4')
  expect(
    container.querySelector('path[data-series="purchases"]')?.getAttribute('stroke-dasharray'),
  ).toBe('2 4')
  expect(
    container
      .querySelector('path[data-series="gross-profit-estimate"]')
      ?.hasAttribute('stroke-dasharray'),
  ).toBe(false)
  expect(screen.queryByLabelText('Chart date')).toBeNull()
  expect(screen.queryByText('View daily chart data')).toBeNull()
  expect(screen.queryByText(/Choose a date for exact values/)).toBeNull()
})

it('shows exactly seven week cells in one row and no month navigation', () => {
  const dates = days('2026-12-28', '2027-01-03')
  const report = makeReport(dates, () => '3.00')
  render(
    <ReportCalendar
      kind="sales"
      rows={report.rows}
      filters={{ period: 'weekly', anchor: '2027-01-01', itemId: '', warehouseId: '' }}
    />,
  )
  const week = screen.getByRole('list', { name: 'Weekly sales' })
  expect(within(week).getAllByRole('listitem')).toHaveLength(7)
  expect(screen.queryByRole('button', { name: 'Previous calendar month' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Next calendar month' })).toBeNull()
  expect(within(week).getByRole('listitem', { name: 'Dec 28, 2026: ₱3.00' })).toBeTruthy()
  expect(within(week).getByRole('listitem', { name: 'Jan 3, 2027: ₱3.00' })).toBeTruthy()
})

it('starts a yearly daily calendar at the anchor month and disables navigation outside the year', async () => {
  const user = userEvent.setup()
  const report = makeReport(annualRows, () => '1.00')
  const filters: ReportFilterState = {
    period: 'annual',
    anchor: '2024-01-15',
    itemId: '',
    warehouseId: '',
  }
  const { rerender } = render(
    <ReportCalendar
      kind="sales"
      rows={report.rows}
      filters={filters}
      key={JSON.stringify(filters)}
    />,
  )
  expect(screen.getByText('January 2024')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Previous calendar month' }).hasAttribute('disabled'),
  ).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Next calendar month' }))
  expect(screen.getByText('February 2024')).toBeTruthy()
  const laterFilters = { ...filters, anchor: '2024-11-15' }
  rerender(
    <ReportCalendar
      key={JSON.stringify(laterFilters)}
      kind="sales"
      rows={report.rows}
      filters={laterFilters}
    />,
  )
  expect(screen.getByText('November 2024')).toBeTruthy()
})
