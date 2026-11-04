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

it('rescales from visible series with linear padding while keeping exact tooltip amounts', () => {
  const dates = ['2024-02-01', '2024-02-02']
  const reports = {
    sales: makeReport(dates, (_kind, index) => (index ? '100.00' : '50.00')),
    purchases: makeReport(dates, () => '10000.00'),
    'gross-profit-estimate': makeReport(dates, () => '-25.00'),
  }
  const { container, rerender } = render(
    <ReportLineChart
      period="monthly"
      selected={['sales', 'purchases', 'gross-profit-estimate']}
      reports={reports}
    />,
  )
  const pointY = (kind: string, date = '2024-02-02') =>
    Number(
      container
        .querySelector(`circle[data-series="${kind}"][data-point-key="${date}"]`)!
        .getAttribute('cy'),
    )
  const compressed = Math.abs(pointY('sales') - pointY('sales', dates[0]))
  const purchasesY = pointY('purchases')
  expect(purchasesY).toBeGreaterThan(18)
  rerender(
    <ReportLineChart
      period="monthly"
      selected={['sales', 'gross-profit-estimate']}
      reports={reports}
    />,
  )
  const readable = Math.abs(pointY('sales') - pointY('sales', dates[0]))
  expect(readable).toBeGreaterThan(compressed * 50)
  expect(pointY('sales')).toBeGreaterThan(18)
  expect(pointY('gross-profit-estimate')).toBeLessThan(182)
  const baseline = Number(container.querySelector('[data-zero-baseline]')!.getAttribute('y1'))
  expect(pointY('gross-profit-estimate')).toBeGreaterThan(baseline)
  fireEvent.focus(screen.getByRole('img', { name: 'Financial trends in pesos' }))
  expect(screen.getByRole('status').textContent).toContain('Sales · ₱50.00')
  expect(screen.getByRole('status').textContent).toContain('Estimated gross profit · -₱25.00')
  expect(screen.getByRole('status').textContent).not.toContain('Purchases')
})

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
  expect(screen.getByRole('status').textContent).toBe(
    'Hover or focus the chart to inspect exact amounts.',
  )
})

it('uses consistent solid financial series without exact-data controls', () => {
  const report = makeReport(days('2024-01-01', '2024-01-08'), () => '1.00')
  const { container } = render(
    <ReportLineChart
      period="monthly"
      selected={['sales', 'purchases', 'gross-profit-estimate']}
      reports={{ sales: report, purchases: report, 'gross-profit-estimate': report }}
    />,
  )
  for (const series of ['sales', 'purchases', 'gross-profit-estimate'])
    expect(container.querySelector(`path[data-series="${series}"]`)?.hasAttribute('stroke-dasharray')).toBe(false)
  expect(screen.queryByLabelText('Chart date')).toBeNull()
  expect(screen.queryByText('View daily chart data')).toBeNull()
  expect(screen.queryByText(/Choose a date for exact values/)).toBeNull()
})

it('compares exact amounts including losses, zero and unavailable buckets in one tooltip', async () => {
  const dates = ['2024-02-01', '2024-02-02', '2024-02-03']
  const sales = makeReport(dates, () => '9007199254740993.01')
  const purchases = makeReport(dates, () => '0.00')
  purchases.rows.splice(1, 1)
  const profit = makeReport(dates, () => '-25.03')
  const { container } = render(
    <ReportLineChart
      period="monthly"
      selected={['sales', 'purchases', 'gross-profit-estimate']}
      reports={{ sales, purchases, 'gross-profit-estimate': profit }}
    />,
  )
  const chart = screen.getByRole('img', { name: 'Financial trends in pesos' })
  fireEvent.focus(chart)
  const tooltip = screen.getByRole('status')
  expect(tooltip.textContent).toContain('Sales · ₱9,007,199,254,740,993.01')
  expect(tooltip.textContent).toContain('Purchases · ₱0.00')
  expect(tooltip.textContent).toContain('Estimated gross profit · -₱25.03')
  fireEvent.keyDown(chart, { key: 'ArrowRight' })
  expect(tooltip.textContent).toContain('Purchases · Not available')
  const baseline = Number(container.querySelector('[data-zero-baseline]')!.getAttribute('y1'))
  const loss = Number(
    container.querySelector('circle[data-series="gross-profit-estimate"]')!.getAttribute('cy'),
  )
  expect(loss).toBeGreaterThanOrEqual(baseline)
  expect(container.querySelector('path[data-series="sales"]')!.getAttribute('stroke')).toBe(
    '#6A994E',
  )
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

it('uses straight segments for sparse activity and keeps zero observations exact', async () => {
  const user = userEvent.setup()
  const report = makeReport(
    ['2024-02-01', '2024-02-02', '2024-02-03'],
    (_kind, index) => ['0.00', '-25.00', '10.00'][index],
  )
  const { container } = render(
    <ReportLineChart period="monthly" selected={['sales']} reports={{ sales: report }} />,
  )
  expect(container.querySelectorAll('rect[data-bar-key]')).toHaveLength(0)
  expect(container.querySelector('path[data-series]')?.getAttribute('d')).toMatch(
    /^M[^MCQ]*L[^MCQ]*L/,
  )
  const chart = screen.getByRole('img', { name: 'Financial trends in pesos' })
  chart.focus()
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('\u20b10.00'))
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('status').textContent).toContain('-\u20b125.00')
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('status').textContent).toContain('\u20b110.00')
})

it('leaves missing daily observations as gaps with no invented zero', async () => {
  const user = userEvent.setup()
  const report = makeReport(['2024-02-01', '2024-02-03'], () => '5.00')
  const { container } = render(
    <ReportLineChart period="monthly" selected={['sales']} reports={{ sales: report }} />,
  )
  const path = container.querySelector('path[data-series]')!.getAttribute('d')!
  expect(path.match(/M/g)).toHaveLength(2)
  expect(path).not.toContain('L')
  expect(container.querySelectorAll('circle[data-point-key]')).toHaveLength(2)
  screen.getByRole('img', { name: 'Financial trends in pesos' }).focus()
  await user.keyboard('{ArrowRight}')
  expect(screen.getByRole('status').textContent).toContain('February 2, 2024')
  expect(screen.getByRole('status').textContent).toContain('Not available')
})

it('shows an exact flat zero series and a visible reference for negative amounts', () => {
  const report = makeReport(days('2024-02-01', '2024-02-04'))
  const { container, rerender } = render(
    <ReportLineChart period="monthly" selected={['sales']} reports={{ sales: report }} />,
  )
  expect(screen.getByText('All reported amounts are zero.')).toBeTruthy()
  const baseline = container.querySelector('[data-zero-baseline]')!
  const zeroY = baseline.getAttribute('y1')
  for (const point of container.querySelectorAll('circle[data-point-key]'))
    expect(point.getAttribute('cy')).toBe(zeroY)
  report.rows[1].totalAmount = '-25.00'
  rerender(<ReportLineChart period="monthly" selected={['sales']} reports={{ sales: report }} />)
  expect(screen.queryByText('All reported amounts are zero.')).toBeNull()
  expect(
    Number(container.querySelector('circle[data-point-key="2024-02-02"]')!.getAttribute('cy')),
  ).toBeGreaterThan(Number(container.querySelector('[data-zero-baseline]')!.getAttribute('y1')))
})
