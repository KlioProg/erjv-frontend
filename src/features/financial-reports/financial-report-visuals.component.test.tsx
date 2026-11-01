import { afterEach, expect, it } from 'vitest'
import { apiClient } from '@/lib/api-client'
import cases from './report-test-fixtures.json'
import { calendarMetric, itemContributions, reportPeriod } from './financial-report-visuals'
import { fetchCompleteItemReport } from './financial-report-visuals.api'
import type { ReportResult } from './financial-reports.types'

it.each([
  ['annual', '2024-05-20', '2024-01-01', '2024-12-31'],
  ['semiannual', '2026-06-30', '2026-01-01', '2026-06-30'],
  ['semiannual', '2026-07-01', '2026-07-01', '2026-12-31'],
  ['quarterly', '2026-11-01', '2026-10-01', '2026-12-31'],
  ['monthly', '2024-02-29', '2024-02-01', '2024-02-29'],
  ['weekly', '2027-01-01', '2026-12-28', '2027-01-03'],
] as const)('finds the full %s Manila calendar period for %s', (period, anchor, from, through) => {
  expect(reportPeriod(period, anchor)).toEqual({ from, through })
})
it('uses profit for mixed selections even when the profit line is hidden', () => {
  expect(calendarMetric(['sales'])).toBe('sales')
  expect(calendarMetric(['purchases'])).toBe('purchases')
  expect(calendarMetric(['sales', 'purchases'])).toBe('gross-profit-estimate')
})
it('calculates exact item shares without rounding huge money through Number', () => {
  const result = itemContributions(
    [
      { key: 'a', name: 'A', value: '20000000000000000000.00' },
      { key: 'b', name: 'B', value: '10000000000000000000.00' },
    ],
    '30000000000000000000.00',
  )
  expect(result.items.map((r) => r.percent)).toEqual(['66.67', '33.33'])
  expect(result.canDonut).toBe(true)
})
it('keeps losses signed and rejects a part-to-whole donut for negative amounts', () => {
  const result = itemContributions(
    [
      { key: 'a', value: '100.00' },
      { key: 'b', value: '-25.00' },
    ],
    '75.00',
  )
  expect(result.canDonut).toBe(false)
  expect(result.items.map((r) => r.percent)).toEqual(['133.33', '-33.33'])
  expect(itemContributions([{ key: 'a', value: '0.00' }], '0.00').items[0].percent).toBeNull()
})
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
const fixture = (id: string) =>
  structuredClone(cases.find((c) => c.id === id)!.body) as ReportResult
const scope = {
  from: '2026-10-01T00:00:00+08:00',
  before: '2026-10-03T00:00:00+08:00',
  groupBy: 'item' as const,
}
function pages(second: (p: ReportResult) => ReportResult = (p) => p) {
  apiClient.defaults.adapter = async (config) => ({
    data: config.params.cursor
      ? second(fixture('sales-items-page-2'))
      : fixture('sales-items-page-1'),
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
}
it('includes every item page before returning a distribution', async () => {
  pages()
  const result = await fetchCompleteItemReport('sales', scope)
  expect(result.rows.map((r) => r.name)).toEqual(['Sample Item A', 'Sample Item B'])
  expect(result.totals.totalAmount).toBe('300.00')
  expect(result.nextCursor).toBeNull()
})
it('rejects a changed item snapshot instead of returning a partial distribution', async () => {
  pages((p) => ({ ...p, period: { ...p.period, asOf: '2026-10-04T00:00:00+08:00' } }))
  await expect(fetchCompleteItemReport('sales', scope)).rejects.toThrow(/snapshot/i)
})
it('rejects a repeated cursor instead of looping or double counting', async () => {
  pages((p) => ({ ...p, nextCursor: 'fixture-only-sales-items-page-2' }))
  await expect(fetchCompleteItemReport('sales', scope)).rejects.toThrow(/cursor/i)
})

it('discards the whole distribution when a continuation page fails', async () => {
  apiClient.defaults.adapter = async (config) => {
    if (config.params.cursor) throw Error('Continuation unavailable')
    return {
      data: fixture('sales-items-page-1'),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  await expect(fetchCompleteItemReport('sales', scope)).rejects.toThrow('Continuation unavailable')
})
