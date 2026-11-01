import { expect, it } from 'vitest'
import {
  buildReportQuery,
  createDefaultReportFilters,
  formatReportMoney,
} from './financial-reports.filters'
it('serializes inclusive Manila dates independently of browser timezone', () => {
  const q = buildReportQuery('sales', {
    ...createDefaultReportFilters(new Date('2026-11-01T12:00:00Z')),
    from: '2026-11-01',
    through: '2026-11-30',
  })
  expect(q.from).toBe('2026-11-01T00:00:00+08:00')
  expect(q.before).toBe('2026-12-01T00:00:00+08:00')
  expect(q).not.toHaveProperty('limit')
})
it('rejects invalid dates and incompatible party scope', () => {
  const d = createDefaultReportFilters()
  expect(() => buildReportQuery('sales', { ...d, from: '2026-02-30' })).toThrow()
  expect(buildReportQuery('gross-profit-estimate', { ...d, clientId: '4' })).not.toHaveProperty(
    'clientId',
  )
})
it('preserves exact and signed peso values', () => {
  expect(formatReportMoney('12345678901234567890.12')).toBe('₱12,345,678,901,234,567,890.12')
  expect(formatReportMoney('-25.00')).toBe('-₱25.00')
})
