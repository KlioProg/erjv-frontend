import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { ReportProfitNotice, ReportSummaryCards } from './ReportSummaryCards'
import type { ReportResult } from '@/features/financial-reports/financial-reports.types'
import cases from '@/features/financial-reports/report-test-fixtures.json'

const report = structuredClone(
  cases.find((entry) => entry.id === 'profit-partial-coverage')!.body,
) as ReportResult
it('shows exact backend totals in three selectable KPI cards with financial definitions', async () => {
  const onSelection = vi.fn()
  render(
    <ReportSummaryCards
      reports={{ sales: report, purchases: report, 'gross-profit-estimate': report }}
      selected="sales"
      onSelection={onSelection}
    />,
  )
  const metrics = within(screen.getByRole('region', { name: 'Financial metrics' }))
  expect(metrics.getAllByRole('button')).toHaveLength(3)
  expect(metrics.getByRole('button', { name: 'Analyze Sales', pressed: true })).toBeTruthy()
  expect(metrics.getByText('Reconciled deliveries')).toBeTruthy()
  expect(metrics.getByText('Accepted purchases')).toBeTruthy()
  expect(metrics.getByText('Estimated, not net profit')).toBeTruthy()
  const profit = metrics.getByRole('button', { name: 'Analyze Estimated gross profit' })
  expect(profit.textContent).toContain('\u20b150.00')
  await userEvent.click(profit)
  expect(onSelection).toHaveBeenCalledWith('gross-profit-estimate')
})

it('warns about positive uncosted quantity even with zero uncosted taxable sales', () => {
  const uncosted = structuredClone(report)
  uncosted.totals.uncostedTaxableSalesValue = '0.00'
  uncosted.totals.uncostedQuantityByUnit = { piece: '1.00' }
  render(<ReportProfitNotice report={uncosted} />)
  expect(screen.getByText(/moving weighted average acquisition cost/)).toBeTruthy()
  expect(screen.getByRole('status').textContent).toContain('may be incomplete')
  expect(screen.getByText(/Cost coverage:/).textContent).toContain('0.00')
})
