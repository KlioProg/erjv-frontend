import { decimalString, parseOrderDecimal } from '@/lib/order-amounts'
import type { Metrics, ReportKind } from './financial-reports.types'
import type { ReportQuery, ReportResult, ReportRow } from './financial-reports.types'

export const reportMetrics: { kind: ReportKind; label: string; color: string; dash?: string }[] = [
  { kind: 'sales', label: 'Sales', color: '#6A994E', dash: '7 4' },
  { kind: 'purchases', label: 'Purchases', color: '#b45309', dash: '2 4' },
  { kind: 'gross-profit-estimate', label: 'Estimated gross profit', color: '#1d4ed8' },
]
export type ReportPeriod = 'annual' | 'semiannual' | 'quarterly' | 'monthly' | 'weekly'
export const reportPeriods: { value: ReportPeriod; label: string }[] = [
  { value: 'annual', label: 'Annual' },
  { value: 'semiannual', label: 'Semi-Annual' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'weekly', label: 'Weekly' },
]
const iso = (d: Date) => d.toISOString().slice(0, 10)
export function reportPeriod(period: ReportPeriod, anchor: string) {
  const date = new Date(anchor + 'T00:00:00Z')
  const year = date.getUTCFullYear(),
    month = date.getUTCMonth()
  if (period === 'weekly') {
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
    const from = iso(date)
    date.setUTCDate(date.getUTCDate() + 6)
    return { from, through: iso(date) }
  }
  const size =
    period === 'annual' ? 12 : period === 'semiannual' ? 6 : period === 'quarterly' ? 3 : 1
  const first = Math.floor(month / size) * size
  return {
    from: iso(new Date(Date.UTC(year, first, 1))),
    through: iso(new Date(Date.UTC(year, first + size, 0))),
  }
}
export function shiftPeriod(period: ReportPeriod, anchor: string, direction: number) {
  const { from } = reportPeriod(period, anchor)
  const date = new Date(from + 'T00:00:00Z')
  if (period === 'weekly') date.setUTCDate(date.getUTCDate() + 7 * direction)
  else
    date.setUTCMonth(
      date.getUTCMonth() +
        direction *
          (period === 'annual' ? 12 : period === 'semiannual' ? 6 : period === 'quarterly' ? 3 : 1),
    )
  return iso(date)
}
export function calendarMetric(selected: ReportKind[]): ReportKind {
  return selected.length === 1 ? selected[0] : 'gross-profit-estimate'
}
export function metricAmount(metrics: Metrics, kind: ReportKind): string {
  const value =
    kind === 'gross-profit-estimate' ? metrics.estimatedGrossProfitAmount : metrics.totalAmount
  if (value === undefined)
    throw Error('The report is missing a financial amount. Restart the report.')
  return value
}
export function moneyCents(value: string): bigint {
  const negative = value.startsWith('-')
  const amount = parseOrderDecimal(negative ? value.slice(1) : value)
  if (amount === null) throw Error('Invalid financial amount.')
  return negative ? -amount : amount
}
// Only bounded ratios enter SVG coordinates; exact amounts remain decimal strings.
export function scaledRatio(value: bigint, total: bigint): number {
  return total === 0n ? 0 : Number((value * 1_000_000n) / total) / 1_000_000
}
export function itemContributions(
  rows: { key: string; name?: string; value: string }[],
  total: string,
) {
  const denominator = moneyCents(total)
  const items = rows.map((r) => {
    const cents = moneyCents(r.value)
    const negative = cents < 0n !== denominator < 0n
    const absolute = cents < 0n ? -cents : cents
    const divisor = denominator < 0n ? -denominator : denominator
    const percent =
      divisor === 0n
        ? null
        : (negative && cents !== 0n ? '-' : '') +
          decimalString((absolute * 10_000n + divisor / 2n) / divisor)
    return { ...r, cents, percent, ratio: scaledRatio(cents, denominator) }
  })
  const sum = items.reduce((s, r) => s + r.cents, 0n)
  return {
    items,
    canDonut: denominator > 0n && items.every((r) => r.cents >= 0n) && sum === denominator,
  }
}
export function reportDateLabel(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' },
) {
  return new Intl.DateTimeFormat('en-PH', { ...options, timeZone: 'Asia/Manila' }).format(
    new Date(date + 'T00:00:00+08:00'),
  )
}
export type TrendPoint = { key: string; value: string }

function dateInManila(instant: number): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant))
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)!.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateTrendReport(report: ReportResult, scope: ReportQuery): ReportResult {
  const requestedFrom = Date.parse(scope.from)
  const requestedBefore = Date.parse(scope.before)
  const actualFrom = Date.parse(report.period.from)
  const actualBefore = Date.parse(report.period.before)
  if (
    !Number.isFinite(requestedFrom) ||
    !Number.isFinite(requestedBefore) ||
    requestedBefore <= requestedFrom ||
    !Number.isFinite(actualFrom) ||
    !Number.isFinite(actualBefore) ||
    actualFrom !== requestedFrom ||
    actualBefore !== requestedBefore ||
    report.period.businessTimezone !== 'Asia/Manila'
  )
    throw Error('Report period does not match the requested trend period. Restart the report.')

  if (scope.groupBy !== 'day')
    throw Error(
      'Incomplete financial trend report: daily grouping is required. Restart the report.',
    )

  const first = dateInManila(requestedFrom)
  const last = dateInManila(requestedBefore - 1)
  const expected: string[] = []
  for (
    let time = Date.parse(`${first}T00:00:00.000Z`);
    time <= Date.parse(`${last}T00:00:00.000Z`);
    time += 86_400_000
  )
    expected.push(new Date(time).toISOString().slice(0, 10))
  const expectedSet = new Set(expected)
  const seen = new Set<string>()
  for (const row of report.rows) {
    if (!isDateKey(row.key) || !expectedSet.has(row.key) || seen.has(row.key))
      throw Error(
        'Incomplete financial trend report: duplicated or out-of-range daily bucket. Restart the report.',
      )
    seen.add(row.key)
  }
  if (seen.size !== expectedSet.size)
    throw Error('Incomplete financial trend report: missing daily bucket. Restart the report.')

  return { ...report, rows: [...report.rows].sort((a, b) => a.key.localeCompare(b.key)) }
}

export function trendPoints(
  rows: ReportRow[],
  kind: ReportKind,
  period: ReportPeriod,
): TrendPoint[] {
  const ordered = [...rows].sort((a, b) => a.key.localeCompare(b.key))
  if (period === 'monthly' || period === 'weekly')
    return ordered.map((row) => ({ key: row.key, value: metricAmount(row, kind) }))

  const monthly = new Map<string, bigint>()
  for (const row of ordered) {
    if (!isDateKey(row.key)) throw Error('Invalid financial trend date.')
    const key = `${row.key.slice(0, 7)}-01`
    monthly.set(key, (monthly.get(key) ?? 0n) + moneyCents(metricAmount(row, kind)))
  }
  return [...monthly.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, cents]) => ({ key, value: decimalString(cents) }))
}
