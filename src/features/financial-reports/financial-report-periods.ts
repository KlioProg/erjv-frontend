import { reportPeriod, shiftPeriod, type ReportPeriod } from './financial-report-visuals'
import type { Draft } from './financial-reports.types'

export type ReportFilterState = {
  period: ReportPeriod
  anchor: string
  itemId: string
  warehouseId: string
}

export type PeriodAction =
  | { type: 'period'; value: ReportFilterState['period'] }
  | { type: 'year' | 'month' | 'week'; value: number }
  | { type: 'step'; value: -1 | 1 }
  | { type: 'itemId' | 'warehouseId'; value: string }
  | { type: 'reset'; today: string }

export type PeriodSelectors = {
  year: number
  half: 1 | 2
  quarter: 1 | 2 | 3 | 4
  month: number
  week: number
  weeksInYear: number
}

export type PeriodOption = { value: number; label: string }

const MIN_YEAR = 1900
const MAX_YEAR = 2100
const DAY_MS = 86_400_000

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return date.toISOString().slice(0, 10) === value ? date : null
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function isoWeekYearAndNumber(date: Date) {
  const thursday = new Date(date)
  thursday.setUTCDate(thursday.getUTCDate() + 3 - ((thursday.getUTCDay() + 6) % 7))
  const year = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const firstMonday = new Date(jan4)
  firstMonday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  const monday = new Date(date)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return { year, week: Math.floor((monday.getTime() - firstMonday.getTime()) / (7 * DAY_MS)) + 1 }
}

function weeksInISOYear(year: number) {
  return isoWeekYearAndNumber(new Date(Date.UTC(year, 11, 28))).week
}

function dateForISOWeek(year: number, week: number) {
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const firstMonday = new Date(jan4)
  firstMonday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7))
  firstMonday.setUTCDate(firstMonday.getUTCDate() + (week - 1) * 7)
  return iso(firstMonday)
}

function validFilters(filters: ReportFilterState): boolean {
  const date = parseDate(filters.anchor)
  return Boolean(
    date &&
    date.getUTCFullYear() >= MIN_YEAR &&
    date.getUTCFullYear() <= MAX_YEAR &&
    ['annual', 'semiannual', 'quarterly', 'monthly', 'weekly'].includes(filters.period) &&
    validId(filters.itemId) &&
    validId(filters.warehouseId),
  )
}

function validId(value: string) {
  return value === '' || (/^[1-9]\d*$/.test(value) && Number(value) <= 2_147_483_647)
}

export function initialReportFilters(today: string): ReportFilterState {
  const filters = { period: 'monthly' as const, anchor: today, itemId: '', warehouseId: '' }
  if (!validFilters(filters)) throw Error('Invalid initial financial report date.')
  return filters
}

export function periodSelectors(filters: ReportFilterState): PeriodSelectors {
  assertFilters(filters)
  const date = parseDate(filters.anchor)!
  const calendarYear = date.getUTCFullYear()
  const month = date.getUTCMonth() + 1
  const isoWeek = isoWeekYearAndNumber(date)
  return {
    year: filters.period === 'weekly' ? isoWeek.year : calendarYear,
    half: month <= 6 ? 1 : 2,
    quarter: (Math.floor((month - 1) / 3) + 1) as PeriodSelectors['quarter'],
    month,
    week: isoWeek.week,
    weeksInYear: weeksInISOYear(isoWeek.year),
  }
}

function assertFilters(filters: ReportFilterState): void {
  if (!validFilters(filters)) throw Error('Invalid financial report filter state.')
}

export function changeReportFilters(
  filters: ReportFilterState,
  action: PeriodAction,
): ReportFilterState {
  if (!validFilters(filters)) return filters
  if (action.type === 'reset') {
    const next = { period: 'monthly' as const, anchor: action.today, itemId: '', warehouseId: '' }
    if (!validFilters(next)) return filters
    if (
      filters.period === next.period &&
      filters.anchor === next.anchor &&
      filters.itemId === '' &&
      filters.warehouseId === ''
    )
      return filters
    return next
  }
  if (action.type === 'period') {
    if (!['annual', 'semiannual', 'quarterly', 'monthly', 'weekly'].includes(action.value))
      return filters
    return action.value === filters.period ? filters : { ...filters, period: action.value }
  }
  if (action.type === 'itemId' || action.type === 'warehouseId') {
    if (!validId(action.value) || filters[action.type] === action.value) return filters
    return { ...filters, [action.type]: action.value }
  }
  if (action.type === 'year') {
    if (
      !Number.isInteger(action.value) ||
      action.value < MIN_YEAR ||
      action.value > MAX_YEAR ||
      filters.period === 'monthly' ||
      filters.period === 'weekly' ||
      periodSelectors(filters).year === action.value
    )
      return filters
    const date = parseDate(filters.anchor)!
    const month = date.getUTCMonth()
    const day = Math.min(
      date.getUTCDate(),
      new Date(Date.UTC(action.value, month + 1, 0)).getUTCDate(),
    )
    return { ...filters, anchor: iso(new Date(Date.UTC(action.value, month, day))) }
  }
  if (action.type === 'month') {
    if (
      filters.period !== 'monthly' ||
      !Number.isInteger(action.value) ||
      action.value < 1 ||
      action.value > 12 ||
      periodSelectors(filters).month === action.value
    )
      return filters
    const date = parseDate(filters.anchor)!
    const day = Math.min(
      date.getUTCDate(),
      new Date(Date.UTC(date.getUTCFullYear(), action.value, 0)).getUTCDate(),
    )
    return {
      ...filters,
      anchor: iso(new Date(Date.UTC(date.getUTCFullYear(), action.value - 1, day))),
    }
  }
  if (action.type === 'week') {
    if (
      filters.period !== 'weekly' ||
      !Number.isInteger(action.value) ||
      action.value < 1 ||
      action.value > periodSelectors(filters).weeksInYear ||
      periodSelectors(filters).week === action.value
    )
      return filters
    const year = periodSelectors(filters).year
    return { ...filters, anchor: dateForISOWeek(year, action.value) }
  }
  if (action.type === 'step') {
    if (action.value !== -1 && action.value !== 1) return filters
    const anchor = shiftPeriod(filters.period, filters.anchor, action.value)
    const next = { ...filters, anchor }
    if (
      !validFilters(next) ||
      periodSelectors(next).year < MIN_YEAR ||
      periodSelectors(next).year > MAX_YEAR
    )
      return filters
    return anchor === filters.anchor ? filters : next
  }
  return filters
}

export function reportDraft(filters: ReportFilterState): Draft {
  assertFilters(filters)
  const range = reportPeriod(filters.period, filters.anchor)
  return {
    ...range,
    groupBy: 'day',
    itemId: filters.itemId,
    warehouseId: filters.warehouseId,
    clientId: '',
    supplierId: '',
  }
}

function intervalLabel(from: string, through: string): string {
  const left = new Date(`${from}T00:00:00.000Z`)
  const right = new Date(`${through}T00:00:00.000Z`)
  const leftYear = left.getUTCFullYear()
  const rightYear = right.getUTCFullYear()
  const leftLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    ...(leftYear === rightYear ? {} : { year: 'numeric' as const }),
    timeZone: 'UTC',
  }).format(left)
  const rightLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(right)
  return `${leftLabel} – ${rightLabel}`
}

export function weekOptions(anchor: string): PeriodOption[] {
  const date = parseDate(anchor)
  if (!date) throw Error('Invalid weekly report anchor.')
  const { year } = isoWeekYearAndNumber(date)
  return Array.from({ length: weeksInISOYear(year) }, (_, index) => {
    const from = dateForISOWeek(year, index + 1)
    const last = new Date(`${from}T00:00:00.000Z`)
    last.setUTCDate(last.getUTCDate() + 6)
    const through = iso(last)
    return { value: index + 1, label: intervalLabel(from, through) }
  })
}

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function monthOptions(): PeriodOption[] {
  return months.map((label, index) => ({ value: index + 1, label }))
}
