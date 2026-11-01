import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { FinancialReportsPage } from './FinancialReportsPage'
import { apiClient } from '@/lib/api-client'
import cases from '@/features/financial-reports/report-test-fixtures.json'
import type { ReportResult } from '@/features/financial-reports/financial-reports.types'
import { ReportItemCharts } from './ReportCharts'
import { ReportCalendar } from './ReportCalendar'

const auth = vi.hoisted(() => ({ user: { id: 1 }, isAdmin: true, isManager: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
  auth.isAdmin = true
})
function mount(fail = false, url = '/financial-reports') {
  const requests: { url?: string; params: Record<string, string> }[] = []
  apiClient.defaults.adapter = async (config) => {
    requests.push({ url: config.url, params: config.params })
    if (fail) throw Error('Report source unavailable')
    const kind = config.url!.split('/').at(-1)
    const profit = kind === 'gross-profit-estimate'
    const base = structuredClone(
      cases.find(
        (c) =>
          c.id ===
          (profit
            ? 'profit-partial-coverage'
            : kind === 'purchases'
              ? 'purchases-overview'
              : 'sales-empty-overview'),
      )!.body,
    ) as ReportResult
    base.period.from = config.params.from
    base.period.before = config.params.before
    base.totals.totalAmount = kind === 'purchases' ? '40.00' : '100.00'
    if (profit) base.totals.estimatedGrossProfitAmount = '60.00'
    if (config.params.groupBy === 'item') {
      base.rows = [{ ...base.totals, key: '101', name: 'Sample stock' }]
    } else {
      const start = config.params.from.slice(0, 10)
      const end = config.params.before.slice(0, 10)
      const rows: ReportResult['rows'] = []
      for (let day = start; day < end;) {
        const isLastDay =
          new Date(`${day}T00:00:00.000Z`).getTime() + 86_400_000 ===
          Date.parse(`${end}T00:00:00.000Z`)
        const row = { ...base.totals, key: day }
        row.totalAmount = isLastDay ? base.totals.totalAmount : '0.00'
        if (profit) row.estimatedGrossProfitAmount = isLastDay ? '60.00' : '0.00'
        rows.push(row)
        const next = new Date(`${day}T00:00:00.000Z`)
        next.setUTCDate(next.getUTCDate() + 1)
        day = next.toISOString().slice(0, 10)
      }
      base.rows = rows
    }
    return { data: base, status: 200, statusText: 'OK', headers: {}, config }
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <FinancialReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return requests
}
it('starts with Trends and pairs mixed lines with a profit calendar', async () => {
  mount()
  expect(screen.getByRole('button', { name: 'Trends', pressed: true })).toBeTruthy()
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  expect(screen.getByRole('heading', { name: 'Daily estimated gross profit' })).toBeTruthy()
  const selection = within(screen.getByRole('group', { name: 'Trend lines' }))
  await userEvent.click(selection.getByRole('button', { name: 'Estimated gross profit' }))
  expect(screen.getByRole('heading', { name: 'Daily estimated gross profit' })).toBeTruthy()
  await userEvent.click(selection.getByRole('button', { name: 'Purchases' }))
  await screen.findByRole('heading', { name: 'Daily sales' })
  expect(selection.getByRole('button', { name: 'Sales' }).hasAttribute('disabled')).toBe(true)
})
it('keeps detail expansion within its view and period scope and resets local breakdown choices', async () => {
  const requests = mount()
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  const lines = within(screen.getByRole('group', { name: 'Trend lines' }))
  await userEvent.click(lines.getByRole('button', { name: 'Sales' }))
  await userEvent.click(lines.getByRole('button', { name: 'Purchases' }))
  const profitDetails = screen.getByRole('button', { name: /Estimated gross profit details/ })
  expect(profitDetails.getAttribute('aria-expanded')).toBe('false')
  await userEvent.click(profitDetails)
  expect(profitDetails.getAttribute('aria-expanded')).toBe('true')
  await userEvent.click(screen.getByRole('combobox', { name: 'Break down by' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Item' }))
  await screen.findByText(/Item breakdown · these totals reflect/)
  expect(requests.some((request) => request.params.groupBy === 'item')).toBe(true)

  await userEvent.click(screen.getByRole('button', { name: 'Overview' }))
  await screen.findByRole('img', { name: 'Item share of estimated gross profit' })
  expect(
    screen
      .getByRole('button', { name: /Estimated gross profit details/ })
      .getAttribute('aria-expanded'),
  ).toBe('false')
  await userEvent.click(screen.getByRole('button', { name: /Estimated gross profit details/ }))
  expect(screen.getByRole('combobox', { name: 'Break down by' }).textContent).toContain(
    'No breakdown',
  )

  await userEvent.click(screen.getByRole('button', { name: 'Overview' }))
  expect(
    screen
      .getByRole('button', { name: /Estimated gross profit details/ })
      .getAttribute('aria-expanded'),
  ).toBe('true')
})
it('automatically applies period changes and retains them in the single-metric overview', async () => {
  const requests = mount()
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  const year = requests[0].params.from.slice(0, 4)
  await userEvent.click(screen.getByRole('button', { name: 'Quarterly' }))
  await waitFor(() =>
    expect(
      requests.some(
        (request) =>
          request.params.from === `${year}-10-01T00:00:00+08:00` &&
          request.params.before === `${Number(year) + 1}-01-01T00:00:00+08:00`,
      ),
    ).toBe(true),
  )
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  await userEvent.click(screen.getByRole('button', { name: 'Overview' }))
  await screen.findByRole('img', { name: 'Item share of estimated gross profit' })
  expect(screen.getAllByText('Sample stock').length).toBeGreaterThan(0)
  const selection = screen.getByRole('group', { name: 'Overview metric' })
  expect(within(selection).getAllByRole('button', { pressed: true })).toHaveLength(1)
  expect(
    requests.some(
      (r) =>
        r.params.groupBy === 'item' &&
        r.params.from === `${year}-10-01T00:00:00+08:00` &&
        r.params.before === `${Number(year) + 1}-01-01T00:00:00+08:00`,
    ),
  ).toBe(true)
})
it('keeps the last valid report while a year input is incomplete', async () => {
  const requests = mount()
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  await userEvent.click(screen.getByRole('button', { name: 'Annual' }))
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  const before = requests.length
  const year = screen.getByLabelText('Year')
  await userEvent.clear(year)
  await userEvent.type(year, '20')
  expect(requests.length).toBe(before)
  expect(screen.getByRole('img', { name: 'Financial trends in pesos' })).toBeTruthy()
})
it('shows a source error without zero-valued charts', async () => {
  mount(true)
  await screen.findByText(/Report source unavailable/)
  expect(screen.queryByRole('img', { name: 'Financial trends in pesos' })).toBeNull()
})
it('does not issue visualization or lookup requests for unauthorized users', async () => {
  auth.isAdmin = false
  const requests = mount()
  await screen.findByText('Financial reports are available to administrators and managers.')
  expect(requests).toHaveLength(0)
})

it('removes draft and manual refresh controls and auto-applies a period selection', async () => {
  const requests = mount()
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  expect(screen.queryByLabelText('From (inclusive, Manila)')).toBeNull()
  expect(screen.queryByLabelText('Through (inclusive, Manila)')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Apply filters' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Refresh report' })).toBeNull()

  const before = requests.length
  const year = requests[0].params.from.slice(0, 4)
  await userEvent.click(screen.getByRole('button', { name: 'Annual' }))
  await waitFor(() =>
    expect(
      requests.some(
        (request) =>
          request.params.from === `${year}-01-01T00:00:00+08:00` &&
          request.params.before === `${Number(year) + 1}-01-01T00:00:00+08:00`,
      ),
    ).toBe(true),
  )
  expect(requests.length).toBeGreaterThan(before)
})

it('shows signed losses without a misleading donut', () => {
  const report = structuredClone(
    cases.find((c) => c.id === 'profit-negative')!.body,
  ) as ReportResult
  report.rows = [{ ...report.totals, key: '101', name: 'Loss item' }]
  render(<ReportItemCharts kind="gross-profit-estimate" report={report} />)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.getByText(/Signed bars preserve/)).toBeTruthy()
  expect(screen.getByText(/-₱25.00 · 100.00%/)).toBeTruthy()
})

it('keeps missing calendar values distinct from zero and excludes dates outside the filter', async () => {
  const base = structuredClone(
    cases.find((c) => c.id === 'sales-trend-zero-bucket')!.body,
  ) as ReportResult
  render(
    <ReportCalendar
      kind="sales"
      rows={base.rows.slice(0, 1)}
      filters={{ period: 'monthly', anchor: '2026-10-01', itemId: '', warehouseId: '' }}
    />,
  )
  expect(screen.getByRole('gridcell', { name: 'Oct 1, 2026: ₱0.00' })).toBeTruthy()
  expect(screen.getByRole('gridcell', { name: 'Oct 2, 2026: Not available' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Previous calendar month' })).toBeNull()
})
