import { describe, expect, it } from 'vitest'
import {
  changeReportFilters,
  initialReportFilters,
  monthOptions,
  periodSelectors,
  reportDraft,
  weekOptions,
} from './financial-report-periods'
import { trendPoints, validateTrendReport } from './financial-report-visuals'
import type { ReportPeriod } from './financial-report-visuals'
import type { ReportQuery, ReportResult } from './financial-reports.types'

const filters = (period: ReportPeriod, anchor: string) => ({
  period,
  anchor,
  itemId: '',
  warehouseId: '',
})

describe('financial report period state', () => {
  it('derives date ranges and selectors for each period from one anchor', () => {
    expect(reportDraft(filters('annual', '2024-05-20'))).toMatchObject({
      from: '2024-01-01',
      through: '2024-12-31',
      groupBy: 'day',
      clientId: '',
      supplierId: '',
    })
    expect(reportDraft(filters('semiannual', '2026-07-01'))).toMatchObject({
      from: '2026-07-01',
      through: '2026-12-31',
    })
    expect(reportDraft(filters('quarterly', '2026-11-01'))).toMatchObject({
      from: '2026-10-01',
      through: '2026-12-31',
    })
    expect(reportDraft(filters('monthly', '2024-02-29'))).toMatchObject({
      from: '2024-02-01',
      through: '2024-02-29',
    })
    expect(reportDraft(filters('weekly', '2027-01-01'))).toMatchObject({
      from: '2026-12-28',
      through: '2027-01-03',
    })
    expect(periodSelectors(filters('weekly', '2027-01-01'))).toMatchObject({
      year: 2026,
      week: 53,
      weeksInYear: 53,
    })
  })

  it('starts and resets to the supplied Manila date and clears item filters', () => {
    const initial = initialReportFilters('2026-11-02')
    const selected = { ...initial, itemId: '101', warehouseId: '2' }
    expect(initial).toEqual(filters('monthly', '2026-11-02'))
    expect(changeReportFilters(selected, { type: 'reset', today: '2026-11-02' })).toEqual(initial)
  })

  it('changes calendar year while preserving month and clamps leap day', () => {
    expect(
      changeReportFilters(filters('annual', '2024-02-29'), { type: 'year', value: 2025 }),
    ).toEqual(filters('annual', '2025-02-28'))
    expect(
      reportDraft(
        changeReportFilters(filters('semiannual', '2026-08-31'), { type: 'year', value: 2027 }),
      ),
    ).toMatchObject({ from: '2027-07-01', through: '2027-12-31' })
    expect(
      reportDraft(
        changeReportFilters(filters('quarterly', '2026-11-30'), { type: 'year', value: 2027 }),
      ),
    ).toMatchObject({ from: '2027-10-01', through: '2027-12-31' })
    expect(
      changeReportFilters(filters('annual', '2024-06-01'), { type: 'year', value: 1899 }),
    ).toMatchObject({ anchor: '2024-06-01' })
    expect(
      changeReportFilters(filters('annual', '2024-06-01'), { type: 'year', value: 2101 }),
    ).toMatchObject({ anchor: '2024-06-01' })
    expect(
      changeReportFilters(filters('annual', '2024-06-01'), { type: 'year', value: 1900 }),
    ).toMatchObject({ anchor: '1900-06-01' })
    expect(
      changeReportFilters(filters('annual', '2099-06-01'), { type: 'year', value: 2100 }),
    ).toMatchObject({ anchor: '2100-06-01' })
  })

  it('throws for malformed initial dates or programmer-supplied filter states', () => {
    expect(() => initialReportFilters('2026-02-30')).toThrow(/initial/i)
    expect(() => reportDraft(filters('monthly', '2026-2-01'))).toThrow(/filter/i)
  })

  it('steps by year, half, quarter, month, and ISO week', () => {
    expect(
      reportDraft(changeReportFilters(filters('annual', '2026-10-20'), { type: 'step', value: 1 })),
    ).toMatchObject({ from: '2027-01-01', through: '2027-12-31' })
    expect(
      reportDraft(
        changeReportFilters(filters('semiannual', '2026-06-30'), { type: 'step', value: 1 }),
      ),
    ).toMatchObject({ from: '2026-07-01', through: '2026-12-31' })
    expect(
      reportDraft(
        changeReportFilters(filters('quarterly', '2026-12-31'), { type: 'step', value: 1 }),
      ),
    ).toMatchObject({ from: '2027-01-01', through: '2027-03-31' })
    expect(
      reportDraft(
        changeReportFilters(filters('monthly', '2026-12-15'), { type: 'step', value: 1 }),
      ),
    ).toMatchObject({ from: '2027-01-01', through: '2027-01-31' })
    expect(
      reportDraft(changeReportFilters(filters('weekly', '2027-01-01'), { type: 'step', value: 1 })),
    ).toMatchObject({ from: '2027-01-04', through: '2027-01-10' })
  })

  it('applies month and week dropdown values only in their matching modes', () => {
    expect(
      reportDraft(
        changeReportFilters(filters('monthly', '2026-11-15'), { type: 'month', value: 2 }),
      ),
    ).toMatchObject({ from: '2026-02-01', through: '2026-02-28' })
    expect(
      reportDraft(changeReportFilters(filters('weekly', '2027-01-01'), { type: 'week', value: 1 })),
    ).toMatchObject({ from: '2025-12-29', through: '2026-01-04' })
    const annual = filters('annual', '2026-11-15')
    expect(changeReportFilters(annual, { type: 'month', value: 2 })).toBe(annual)
    expect(changeReportFilters(annual, { type: 'week', value: 1 })).toBe(annual)
  })

  it('ignores invalid values and returns the same state for no-op actions', () => {
    const value = filters('monthly', '2026-11-15')
    expect(changeReportFilters(value, { type: 'month', value: 13 })).toBe(value)
    expect(changeReportFilters(value, { type: 'year', value: 2027 })).toBe(value)
    expect(changeReportFilters(value, { type: 'step', value: 0 as -1 | 1 })).toBe(value)
    expect(changeReportFilters(value, { type: 'itemId', value: '01' })).toBe(value)
    expect(changeReportFilters(value, { type: 'warehouseId', value: '2147483648' })).toBe(value)
    expect(changeReportFilters(value, { type: 'itemId', value: '' })).toBe(value)
  })

  it('labels every ISO week as a Monday-to-Sunday date interval', () => {
    const options = weekOptions('2027-01-01')
    expect(options).toHaveLength(53)
    expect(options[0]).toEqual({ value: 1, label: 'December 29, 2025 – January 4, 2026' })
    expect(options.at(-1)).toEqual({ value: 53, label: 'December 28, 2026 – January 3, 2027' })
    expect(weekOptions('2027-01-04')).toHaveLength(52)
    expect(monthOptions()).toHaveLength(12)
    expect(monthOptions()[0]).toEqual({ value: 1, label: 'January' })
    expect(monthOptions()[11]).toEqual({ value: 12, label: 'December' })
  })
})

const dailyResult = (dates: string[], amounts: string[] = []): ReportResult => {
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
  return {
    period: {
      from: '2024-01-01T00:00:00+08:00',
      before: '2024-02-01T00:00:00+08:00',
      businessTimezone: 'Asia/Manila',
      asOf: '2024-02-01T00:00:00+08:00',
    },
    basis: 'RECONCILED_DELIVERIES',
    totals: zero,
    rows: dates.map((key, index) => ({
      ...zero,
      key,
      totalAmount: amounts[index] ?? '0.00',
      estimatedGrossProfitAmount: amounts[index] ?? '0.00',
    })),
    nextCursor: null,
  }
}

const query: ReportQuery = {
  from: '2024-01-01T00:00:00+08:00',
  before: '2024-02-01T00:00:00+08:00',
  groupBy: 'day',
}

describe('financial report daily trend data', () => {
  it('validates and chronologically sorts complete Manila dates without mutating rows', () => {
    const dates = Array.from(
      { length: 31 },
      (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`,
    ).reverse()
    const input = dailyResult(dates)
    const originalRows = [...input.rows]
    const sorted = validateTrendReport(input, query)
    expect(sorted.rows.map((row) => row.key)).toEqual(
      Array.from({ length: 31 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`),
    )
    expect(input.rows).toEqual(originalRows)
    expect(sorted.totals).toBe(input.totals)
  })

  it.each([
    ['missing', ['2024-01-01']],
    [
      'duplicate',
      [
        '2024-01-01',
        '2024-01-01',
        ...Array.from({ length: 29 }, (_, i) => `2024-01-${String(i + 2).padStart(2, '0')}`),
      ],
    ],
    [
      'out of range',
      [
        '2023-12-31',
        ...Array.from({ length: 30 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`),
      ],
    ],
    [
      'malformed',
      [
        '2024-1-01',
        ...Array.from({ length: 30 }, (_, i) => `2024-01-${String(i + 1).padStart(2, '0')}`),
      ],
    ],
  ])('rejects %s daily buckets', (_label, dates) => {
    expect(() => validateTrendReport(dailyResult(dates), query)).toThrow(/incomplete/i)
  })

  it('compares returned period instants rather than timestamp spellings', () => {
    const report = dailyResult([
      '2024-01-01',
      ...Array.from({ length: 30 }, (_, i) => `2024-01-${String(i + 2).padStart(2, '0')}`),
    ])
    report.period.from = '2023-12-31T16:00:00Z'
    report.period.before = '2024-01-31T16:00:00Z'
    expect(() => validateTrendReport(report, query)).not.toThrow()
    report.period.before = '2024-02-01T16:00:00Z'
    expect(() => validateTrendReport(report, query)).toThrow(/period/i)
  })

  it('aggregates large and negative exact decimal amounts into calendar-month points', () => {
    const dates = Array.from({ length: 366 }, (_, i) => {
      const date = new Date(Date.UTC(2024, 0, i + 1))
      return date.toISOString().slice(0, 10)
    })
    const amounts = Array.from({ length: 366 }, () => '0.00')
    amounts[0] = '0.01'
    amounts[1] = '0.02'
    amounts[2] = '-25.00'
    amounts[3] = '12345678901234567890.12'
    const points = trendPoints(dailyResult(dates, amounts).rows, 'sales', 'annual')
    expect(points).toHaveLength(12)
    expect(points[0]).toEqual({ key: '2024-01-01', value: '12345678901234567865.15' })
  })

  it('keeps daily points in Monthly and Weekly periods and emits zero months for longer periods', () => {
    const datesBetween = (from: string, through: string) => {
      const result: string[] = []
      for (
        let time = Date.parse(`${from}T00:00:00.000Z`);
        time <= Date.parse(`${through}T00:00:00.000Z`);
        time += 86_400_000
      )
        result.push(new Date(time).toISOString().slice(0, 10))
      return result
    }
    const monthRows = dailyResult(datesBetween('2024-02-01', '2024-02-29')).rows
    expect(trendPoints(monthRows, 'sales', 'monthly')).toHaveLength(29)
    const weekRows = dailyResult(datesBetween('2026-12-28', '2027-01-03')).rows
    expect(trendPoints(weekRows, 'sales', 'weekly').map((point) => point.key)).toEqual(
      datesBetween('2026-12-28', '2027-01-03'),
    )
    expect(
      trendPoints(dailyResult(datesBetween('2024-01-01', '2024-12-31')).rows, 'sales', 'annual'),
    ).toHaveLength(12)
    expect(
      trendPoints(
        dailyResult(datesBetween('2024-01-01', '2024-06-30')).rows,
        'sales',
        'semiannual',
      ),
    ).toHaveLength(6)
    expect(
      trendPoints(dailyResult(datesBetween('2024-10-01', '2024-12-31')).rows, 'sales', 'quarterly'),
    ).toHaveLength(3)
    expect(
      trendPoints(
        dailyResult(datesBetween('2024-01-01', '2024-03-31')).rows,
        'sales',
        'quarterly',
      ).map((point) => point.value),
    ).toEqual(['0.00', '0.00', '0.00'])
  })
})
