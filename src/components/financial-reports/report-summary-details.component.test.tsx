import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it } from 'vitest'
import { ReportProfitNotice, ReportSummaryCards } from './ReportSummaryCards'
import type { ReportResult } from '@/features/financial-reports/financial-reports.types'
import cases from '@/features/financial-reports/report-test-fixtures.json'

const report = structuredClone(
  cases.find((entry) => entry.id === 'profit-partial-coverage')!.body,
) as ReportResult
it('shows static neutral KPI summaries with exact values, colored indicators and a costing warning', async () => {
  render(
    <ReportSummaryCards
      reports={{ sales: report, purchases: report, 'gross-profit-estimate': report }}
    />,
  )
  const metrics = within(screen.getByRole('region', { name: 'Financial metrics' }))
  expect(metrics.queryByRole('button')).toBeNull()
  const sales = metrics.getByRole('group', { name: 'Sales' })
  expect(sales.textContent).toContain('\u20b1300.00')
  expect(metrics.queryByText('Reconciled deliveries')).toBeNull()
  expect(metrics.queryByText('Accepted purchases')).toBeNull()
  expect(metrics.getByText('Estimated, not net profit')).toBeTruthy()
  const profit = metrics.getByRole('group', { name: 'Estimated gross profit' })
  expect(profit.textContent).toContain('\u20b150.00')
  expect(within(profit).getAllByRole('status')).toHaveLength(1)
  await userEvent.click(profit)
  expect(profit.hasAttribute('aria-pressed')).toBe(false)
  expect(profit.hasAttribute('tabindex')).toBe(false)
  const colors = ['rgb(106, 153, 78)', 'rgb(180, 83, 9)', 'rgb(29, 78, 216)']
  for (const [index, card] of metrics.getAllByRole('group').entries()) {
    expect(card.style.borderColor).toBe('')
    expect(card.className).not.toMatch(/hover:|cursor-pointer|focus-visible:/)
    expect(card.querySelector<HTMLElement>('[aria-hidden="true"]')?.style.backgroundColor).toBe(
      colors[index],
    )
  }
})

it.each(['quantity', 'amount', 'coverage'] as const)(
  'preserves a concise warning for missing cost %s',
  (reason) => {
    const incomplete = structuredClone(report)
    incomplete.totals.costCoveragePercent = reason === 'coverage' ? '99.99' : '100.00'
    incomplete.totals.uncostedTaxableSalesValue = reason === 'amount' ? '12.34' : '0.00'
    incomplete.totals.uncostedQuantityByUnit = reason === 'quantity' ? { piece: '1.00' } : {}
    const { container } = render(<ReportProfitNotice report={incomplete} />)
    expect(screen.getByRole('status').textContent).toBe(
      'Estimated gross profit may be incomplete because some purchase costs are missing.',
    )
    expect(container.querySelector('details')).toBeNull()
    expect(screen.queryByText(/Cost coverage:/)).toBeNull()
  },
)

it('does not add informational UI for fully costed figures', () => {
  const complete = structuredClone(report)
  complete.totals.costCoveragePercent = '100.00'
  complete.totals.uncostedTaxableSalesValue = '0.00'
  complete.totals.uncostedQuantityByUnit = {}
  const { container } = render(<ReportProfitNotice report={complete} />)
  expect(container.textContent).toBe('')
})

it('does not present unavailable coverage as complete', () => {
  const unavailable = structuredClone(report)
  unavailable.totals.costCoveragePercent = null
  unavailable.totals.uncostedTaxableSalesValue = '0.00'
  unavailable.totals.uncostedQuantityByUnit = {}
  render(<ReportProfitNotice report={unavailable} />)
  expect(screen.getByRole('status').textContent).toBe(
    'Cost coverage is unavailable for estimated gross profit.',
  )
})
