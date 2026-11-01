import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { ReportProfitNotice, ReportSummaryCards } from './ReportSummaryCards'
import type { ReportResult } from '@/features/financial-reports/financial-reports.types'
import cases from '@/features/financial-reports/report-test-fixtures.json'

const report = structuredClone(
  cases.find((entry) => entry.id === 'profit-partial-coverage')!.body,
) as ReportResult

it('shows summary cards from loaded report totals and opens inline details for the selected metric', async () => {
  const view = render(
    <ReportSummaryCards
      reports={{ sales: report, purchases: report, 'gross-profit-estimate': report }}
      visibleKinds={['sales', 'gross-profit-estimate']}
      filters={{ period: 'monthly', anchor: '2026-10-01', itemId: '', warehouseId: '' }}
      view="trends"
    />,
  )
  expect(screen.getAllByText('Full applied period, all report rows')).toHaveLength(2)
  expect(screen.getByRole('button', { name: /Sales details/ })).toBeTruthy()
  expect(screen.getByRole('button', { name: /Estimated gross profit details/ })).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Purchases details/ })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: /Sales details/ }))
  expect(screen.getByRole('heading', { name: 'Sales details' })).toBeTruthy()
  expect(screen.getByRole('combobox', { name: 'Break down by' })).toBeTruthy()
  view.rerender(
    <ReportSummaryCards
      reports={{ sales: report, purchases: report, 'gross-profit-estimate': report }}
      visibleKinds={['gross-profit-estimate']}
      filters={{ period: 'monthly', anchor: '2026-10-01', itemId: '', warehouseId: '' }}
      view="trends"
    />,
  )
  view.rerender(
    <ReportSummaryCards
      reports={{ sales: report, purchases: report, 'gross-profit-estimate': report }}
      visibleKinds={['sales', 'gross-profit-estimate']}
      filters={{ period: 'monthly', anchor: '2026-10-01', itemId: '', warehouseId: '' }}
      view="trends"
    />,
  )
  expect(screen.getByRole('button', { name: /Sales details/ }).getAttribute('aria-expanded')).toBe(
    'false',
  )
})

it('shows profit basis and warns about positive uncosted quantity even when the profit card is hidden', () => {
  const uncosted = structuredClone(report)
  uncosted.totals.uncostedTaxableSalesValue = '0.00'
  uncosted.totals.uncostedQuantityByUnit = { piece: '1.00' }
  render(
    <>
      <ReportSummaryCards
        reports={{ sales: report, 'gross-profit-estimate': uncosted }}
        visibleKinds={['sales']}
        filters={{ period: 'monthly', anchor: '2026-10-01', itemId: '', warehouseId: '' }}
        view="trends"
      />
      <ReportProfitNotice report={uncosted} />
    </>,
  )
  expect(screen.queryByRole('button', { name: /Estimated gross profit details/ })).toBeNull()
  expect(screen.getByText(/moving weighted average acquisition cost/)).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('incomplete cost coverage')
})

it('keeps open details when another line is added and closes when the detailed metric is hidden', async () => {
  const props = {
    reports: { sales: report, purchases: report, 'gross-profit-estimate': report },
    filters: { period: 'monthly' as const, anchor: '2026-10-01', itemId: '', warehouseId: '' },
    view: 'trends' as const,
  }
  const view = render(
    <ReportSummaryCards {...props} visibleKinds={['sales', 'gross-profit-estimate']} />,
  )
  await userEvent.click(screen.getByRole('button', { name: /Estimated gross profit details/ }))
  view.rerender(
    <ReportSummaryCards
      {...props}
      visibleKinds={['sales', 'purchases', 'gross-profit-estimate']}
    />,
  )
  expect(
    screen
      .getByRole('button', { name: /Estimated gross profit details/ })
      .getAttribute('aria-expanded'),
  ).toBe('true')
  view.rerender(<ReportSummaryCards {...props} visibleKinds={['sales', 'purchases']} />)
  expect(screen.queryByRole('heading', { name: 'Estimated gross profit details' })).toBeNull()
  view.rerender(
    <ReportSummaryCards
      {...props}
      visibleKinds={['sales', 'purchases', 'gross-profit-estimate']}
    />,
  )
  expect(
    screen
      .getByRole('button', { name: /Estimated gross profit details/ })
      .getAttribute('aria-expanded'),
  ).toBe('false')
})
