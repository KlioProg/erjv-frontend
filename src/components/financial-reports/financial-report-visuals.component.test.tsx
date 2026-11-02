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
const failures = new Set<string>()
let paginateItems = false
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
  auth.isAdmin = true
  failures.clear()
  paginateItems = false
})
function mount(fail = false, url = '/financial-reports') {
  const requests: {
    url?: string
    params: { from: string; before: string; groupBy: string; warehouseId?: number }
  }[] = []
  apiClient.defaults.adapter = async (config) => {
    requests.push({ url: config.url, params: config.params })
    if (config.url === '/warehouses')
      return {
        data: { items: [{ id: 2, name: 'Warehouse A', isActive: false }], nextCursor: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    if (config.url === '/warehouses/2')
      return {
        data: { id: 2, name: 'Warehouse A', isActive: false },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    if (config.url === '/clients')
      return {
        data: { items: [{ id: 7, name: 'Customer A', isActive: false }], nextCursor: null },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    const kind = config.url!.split('/').at(-1)
    if (fail || failures.has(kind!)) throw Error('Report source unavailable')
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
    if (config.params.cursor && failures.has('changed-details'))
      base.period.asOf = '2030-01-01T00:00:00+08:00'
    base.totals.totalAmount = config.params.clientId
      ? '25.00'
      : kind === 'purchases'
        ? '40.00'
        : '100.00'
    if (profit) base.totals.estimatedGrossProfitAmount = '60.00'
    if (['item', 'client', 'supplier'].includes(config.params.groupBy)) {
      base.rows = [
        {
          ...base.totals,
          key: '101',
          name: config.params.groupBy === 'item' ? 'Sample stock' : 'Sample party',
        },
      ]
      if (paginateItems && config.params.groupBy === 'item') {
        base.rows[0].key = config.params.cursor ? '102' : '101'
        base.rows[0].name = config.params.cursor ? 'Second item' : 'Sample stock'
        base.nextCursor = config.params.cursor ? null : 'next-items'
      }
    } else if (config.params.groupBy === 'month') {
      base.rows = [{ ...base.totals, key: config.params.from.slice(0, 7) }]
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
it('shows three exact KPI totals and only the selected analysis view', async () => {
  mount()
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  const metrics = within(screen.getByRole('region', { name: 'Financial metrics' }))
  expect(
    metrics.getByRole('button', { name: 'Analyze Sales', pressed: true }).textContent,
  ).toContain('\u20b1100.00')
  expect(metrics.getByRole('button', { name: 'Analyze Purchases' }).textContent).toContain(
    '\u20b140.00',
  )
  expect(
    metrics.getByRole('button', { name: 'Analyze Estimated gross profit' }).textContent,
  ).toContain('\u20b160.00')
  expect(screen.queryByRole('grid')).toBeNull()
  expect(screen.queryByLabelText('Stock item contributions')).toBeNull()
  await userEvent.click(metrics.getByRole('button', { name: 'Analyze Purchases' }))
  expect(document.querySelectorAll('[data-series="sales"]')).toHaveLength(0)
  await userEvent.click(screen.getByRole('tab', { name: 'Calendar' }))
  expect(screen.queryByRole('img', { name: 'Financial trends in pesos' })).toBeNull()
  expect(screen.getByRole('heading', { name: 'Daily purchases' })).toBeTruthy()
  await userEvent.click(screen.getByRole('tab', { name: 'Details' }))
  await screen.findByText('Sample stock')
  expect(screen.queryByRole('grid')).toBeNull()
  expect(metrics.getByRole('button', { name: 'Analyze Purchases', pressed: true })).toBeTruthy()
})

it('retains grouping, row expansion and cached pages across analysis tabs and metric changes', async () => {
  const requests = mount()
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  await userEvent.click(screen.getByRole('tab', { name: 'Details' }))
  await screen.findByText('Sample stock')
  await userEvent.click(screen.getByRole('button', { name: 'Details for Sample stock' }))
  expect(
    screen.getByRole('button', { name: 'Details for Sample stock' }).getAttribute('aria-expanded'),
  ).toBe('true')
  const before = requests.length
  await userEvent.click(screen.getByRole('tab', { name: 'Calendar' }))
  expect(screen.queryByRole('table')).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Analyze Purchases' }))
  await userEvent.click(screen.getByRole('button', { name: 'Analyze Sales' }))
  await userEvent.click(screen.getByRole('tab', { name: 'Details' }))
  expect(screen.getByRole('combobox', { name: 'Group by' }).textContent).toContain('Item')
  expect(
    screen.getByRole('button', { name: 'Details for Sample stock' }).getAttribute('aria-expanded'),
  ).toBe('true')
  expect(requests).toHaveLength(before)
})

it('retains period and metric when changing views and honors legacy overview links', async () => {
  const requests = mount(false, '/financial-reports?view=overview')
  await screen.findByText('Sample stock')
  expect(screen.getByRole('tab', { name: 'Details', selected: true })).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Analyze Estimated gross profit', pressed: true }),
  ).toBeTruthy()
  const year = requests[0].params.from.slice(0, 4)
  await userEvent.click(screen.getByRole('button', { name: 'Quarterly' }))
  await waitFor(() =>
    expect(
      requests.some(
        (request) =>
          request.params.groupBy === 'item' &&
          request.params.from === `${year}-10-01T00:00:00+08:00` &&
          request.params.before === `${Number(year) + 1}-01-01T00:00:00+08:00`,
      ),
    ).toBe(true),
  )
  await userEvent.click(screen.getByRole('tab', { name: 'Trends' }))
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  expect(
    screen.getByRole('button', { name: 'Analyze Estimated gross profit', pressed: true }),
  ).toBeTruthy()
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

it('removes draft controls and offers snapshot refresh and auto-applies a period selection', async () => {
  const requests = mount()
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  expect(screen.queryByLabelText('From (inclusive, Manila)')).toBeNull()
  expect(screen.queryByLabelText('Through (inclusive, Manila)')).toBeNull()
  expect(screen.queryByRole('button', { name: 'Apply filters' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Refresh totals' })).toBeTruthy()

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
  expect(screen.getByText(/-₱25.00 · Share unavailable/)).toBeTruthy()
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

it('keeps large item reports compact and reveals every record on demand', async () => {
  const report = structuredClone(
    cases.find((c) => c.id === 'purchases-overview')!.body,
  ) as ReportResult
  report.totals.totalAmount = '90.00'
  report.rows = Array.from({ length: 9 }, (_, index) => ({
    ...report.totals,
    key: String(index),
    name: `Product ${index}`,
    totalAmount: '10.00',
  }))
  render(<ReportItemCharts kind="purchases" report={report} />)
  expect(screen.queryByText('Product 8')).toBeNull()
  expect(screen.getByText(/Complete filtered period.*9 items/).textContent).toContain('\u20b190.00')
  await userEvent.click(screen.getByRole('button', { name: 'Show all 9 items' }))
  expect(screen.getByText('Product 8')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Show top 8 items' }).getAttribute('aria-expanded'),
  ).toBe('true')
})

it('shows an empty item report without inventing product contributions', () => {
  const report = structuredClone(
    cases.find((c) => c.id === 'sales-empty-overview')!.body,
  ) as ReportResult
  report.rows = []
  render(<ReportItemCharts kind="sales" report={report} />)
  expect(screen.getByText('No item results for this period and filters.')).toBeTruthy()
  expect(screen.queryByLabelText('Stock item contributions')).toBeNull()
})

it('keeps available metrics usable after a partial failure and retries only the unavailable metric', async () => {
  failures.add('purchases')
  const requests = mount()
  await screen.findByRole('button', { name: 'Retry Purchases' })
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  const purchases = screen.getByRole('button', { name: 'Analyze Purchases' })
  expect(purchases.textContent).toContain('Unavailable')
  expect(purchases.textContent).not.toContain('0.00')
  expect(screen.getByRole('button', { name: 'Analyze Sales' }).textContent).toContain(
    '\u20b1100.00',
  )
  await userEvent.click(purchases)
  expect(screen.queryByRole('img', { name: 'Financial trends in pesos' })).toBeNull()
  expect(screen.getByRole('alert').textContent).toContain('Report source unavailable')
  const before = requests.length
  failures.clear()
  await userEvent.click(screen.getByRole('button', { name: 'Retry Purchases' }))
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  expect(requests).toHaveLength(before + 1)
  expect(requests.at(-1)?.url).toContain('purchases')
  expect(screen.getByRole('button', { name: 'Analyze Purchases' }).textContent).toContain(
    '\u20b140.00',
  )
})

it.each([
  ['sales', 'Customer', 'client'],
  ['purchases', 'Supplier', 'supplier'],
])(
  'preserves %s party grouping and archived warehouse scope across tabs',
  async (kind, label, grouping) => {
    const requests = mount(false, `/financial-reports?report=${kind}`)
    await screen.findByRole('img', { name: 'Financial trends in pesos' })
    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    await userEvent.click(screen.getByRole('button', { name: 'Choose warehouse' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Warehouse A.*archived/ }))
    await screen.findByRole('img', { name: 'Financial trends in pesos' })
    await userEvent.click(screen.getByRole('tab', { name: 'Details' }))
    await screen.findByText('Sample stock')
    await userEvent.click(screen.getByRole('combobox', { name: 'Group by' }))
    await userEvent.click(screen.getByRole('option', { name: label }))
    await screen.findByText('Sample party')
    expect(
      requests.some((read) => read.params.groupBy === grouping && read.params.warehouseId === 2),
    ).toBe(true)
    const before = requests.length
    await userEvent.click(screen.getByRole('tab', { name: 'Trends' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Details' }))
    expect(screen.getByRole('combobox', { name: 'Group by' }).textContent).toBe(label)
    expect(screen.getByRole('button', { name: 'Filters (1 active)' })).toBeTruthy()
    expect(requests).toHaveLength(before)
  },
)

it('supports arrow-key analysis tabs and keeps only the selected panel accessible', async () => {
  mount()
  await screen.findByRole('img', { name: 'Financial trends in pesos' })
  screen.getByRole('tab', { name: 'Trends' }).focus()
  await userEvent.keyboard('{ArrowRight}')
  await screen.findByText('Sample stock')
  expect(screen.getByRole('tab', { name: 'Details', selected: true })).toBeTruthy()
  expect(screen.getAllByRole('tabpanel')).toHaveLength(1)
  await userEvent.keyboard('{End}')
  await waitFor(() =>
    expect(screen.getByRole('tab', { name: 'Calendar', selected: true })).toBeTruthy(),
  )
  expect(screen.queryByRole('table')).toBeNull()
})

it('shows one result without redundant totals or paging controls and preserves financial row details', async () => {
  mount(false, '/financial-reports?report=gross-profit-estimate&view=breakdown')
  await screen.findByText('Sample stock')
  const details = within(screen.getByRole('region', { name: 'Report details' }))
  expect(details.getByText('1 result')).toBeTruthy()
  expect(details.queryByRole('navigation')).toBeNull()
  expect(details.queryByRole('combobox', { name: 'Results per page' })).toBeNull()
  expect(details.queryByText(/Filtered total:/)).toBeNull()
  expect(details.getAllByRole('columnheader')).toHaveLength(3)
  expect(details.queryByRole('columnheader', { name: 'Costed taxable sales' })).toBeNull()
  await userEvent.click(details.getByRole('button', { name: 'Details for Sample stock' }))
  const row = within(details.getByRole('region', { name: 'Details: Sample stock' }))
  expect(row.getByText('Costed taxable sales')).toBeTruthy()
  expect(row.getByText('\u20b1200.00')).toBeTruthy()
  expect(row.getByText('Estimated acquisition cost')).toBeTruthy()
  expect(row.getByText('\u20b1150.00')).toBeTruthy()
  expect(row.getByText(/Cost coverage: 66.67%/)).toBeTruthy()
})

it('retains shared cursor controls and page-size changes when more results exist', async () => {
  paginateItems = true
  const requests = mount(false, '/financial-reports?view=breakdown')
  await screen.findByText('Sample stock')
  expect(screen.getByRole('combobox', { name: 'Results per page' })).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('Second item')
  expect(screen.getByText('Page 2')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(false)
  await userEvent.click(screen.getByRole('combobox', { name: 'Results per page' }))
  await userEvent.click(screen.getByRole('option', { name: '50' }))
  await screen.findByText('Sample stock')
  expect(screen.getByText('Page 1')).toBeTruthy()
  expect(requests.at(-1)?.params).toMatchObject({ limit: 50 })
  expect(requests.at(-1)?.params).not.toHaveProperty('cursor')
})

it('formats month labels and refreshes totals and details independently', async () => {
  const requests = mount(false, '/financial-reports?view=breakdown')
  await screen.findByText('Sample stock')
  await userEvent.click(screen.getByRole('combobox', { name: 'Group by' }))
  await userEvent.click(screen.getByRole('option', { name: 'Month' }))
  await screen.findByText('November 2026')
  expect(screen.queryByRole('cell', { name: '2026-11' })).toBeNull()
  let before = requests.length
  await userEvent.click(screen.getByRole('button', { name: 'Refresh details' }))
  await screen.findByText('November 2026')
  expect(requests.slice(before)).toHaveLength(1)
  expect(requests.at(-1)?.params.groupBy).toBe('month')
  before = requests.length
  await userEvent.click(screen.getByRole('button', { name: 'Refresh totals' }))
  await waitFor(() => expect(requests.slice(before)).toHaveLength(3))
  expect(requests.slice(before).every((request) => request.params.groupBy === 'day')).toBe(true)
})

it('shows a filtered total only for a narrower customer selection with a different amount', async () => {
  mount(false, '/financial-reports?view=breakdown')
  await screen.findByText('Sample stock')
  expect(screen.queryByText(/Filtered total:/)).toBeNull()
  await userEvent.click(screen.getByRole('combobox', { name: 'Group by' }))
  await userEvent.click(screen.getByRole('option', { name: 'Customer' }))
  await screen.findByText('Sample party')
  expect(screen.queryByText(/Filtered total:/)).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Choose customer' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: /Customer A.*archived/ }))
  expect((await screen.findByText(/Filtered total:/)).textContent).toContain('\u20b125.00')
  expect(screen.getByRole('button', { name: 'Analyze Sales' }).textContent).toContain(
    '\u20b1100.00',
  )
})

it('explains changed report results plainly and retains technical information on demand', async () => {
  paginateItems = true
  failures.add('changed-details')
  mount(false, '/financial-reports?view=breakdown')
  await screen.findByText('Sample stock')
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText(
    'These results changed or are no longer available. Reload details to continue.',
  )
  const technical = screen.getByText('Report snapshot changed. Restart the report.')
  expect(technical.closest('details')?.open).toBe(false)
  failures.clear()
  await userEvent.click(screen.getByRole('button', { name: 'Reload details' }))
  await screen.findByText('Sample stock')
  expect(screen.getByText('Page 1')).toBeTruthy()
})
