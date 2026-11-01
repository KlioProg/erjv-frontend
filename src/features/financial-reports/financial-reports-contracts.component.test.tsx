import { afterEach, expect, it } from 'vitest'
import cases from './report-test-fixtures.json'
import { validateReport, fetchFinancialReportApi } from './financial-reports.api'
import { apiClient } from '@/lib/api-client'
import type { ReportKind } from './financial-reports.types'
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
it.each(cases.filter((c) => c.status === 200 && c.id !== 'sales-malformed-response'))(
  'preserves $id envelope and exact metrics',
  (c) => {
    const kind = c.request.path.split('/').at(-1) as ReportKind
    expect(validateReport(c.body, kind)).toEqual(c.body)
  },
)
it('rejects incomplete financial data rather than supplying zero', () => {
  const c = cases.find((c) => c.id === 'sales-malformed-response')!
  expect(() => validateReport(c.body, 'sales')).toThrow('incomplete report')
})
it('uses the endpoint and propagates abort signal', async () => {
  const body = cases[0].body
  const controller = new AbortController()
  let called = false
  apiClient.defaults.adapter = async (config) => {
    called = true
    expect(config.url).toBe('/financial-reports/sales')
    expect(config.signal).toBe(controller.signal)
    expect(config.params).not.toHaveProperty('limit')
    return { data: body, status: 200, statusText: 'OK', headers: {}, config }
  }
  await fetchFinancialReportApi(
    'sales',
    { from: '2026-10-01T00:00:00+08:00', before: '2026-10-03T00:00:00+08:00', groupBy: 'none' },
    controller.signal,
  )
  expect(called).toBe(true)
})

it('rejects object row labels and array-valued cost quantities', () => {
  const base = structuredClone(cases.find((c) => c.id === 'sales-items-page-1')!.body)
  ;(base as unknown as { rows: { name: unknown }[] }).rows[0].name = { bad: true }
  expect(() => validateReport(base, 'sales')).toThrow()
  const profit = structuredClone(cases.find((c) => c.id === 'profit-partial-coverage')!.body)
  ;(
    profit as unknown as { totals: { uncostedQuantityByUnit: unknown } }
  ).totals.uncostedQuantityByUnit = []
  expect(() => validateReport(profit, 'gross-profit-estimate')).toThrow()
})
