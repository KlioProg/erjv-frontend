import { formatOrderCurrency } from '@/lib/order-amounts'
import { expectedDateError } from '@/lib/order-entry.schema'
import type { Draft, ReportKind, ReportGroup, ReportQuery } from './financial-reports.types'
export const groups = (kind: ReportKind): ReportGroup[] => [
  'none',
  'day',
  'month',
  ...(kind === 'sales' ? ['client' as const] : kind === 'purchases' ? ['supplier' as const] : []),
  'item',
]
export const breakdown = (group: string) => ['item', 'client', 'supplier'].includes(group)
export function createDefaultReportFilters(now = new Date()): Draft {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
  return {
    from: today.slice(0, 8) + '01',
    through: today,
    groupBy: 'none',
    itemId: '',
    warehouseId: '',
    clientId: '',
    supplierId: '',
  }
}
export function filterErrors(kind: ReportKind, d: Draft): Record<string, string> {
  const e: Record<string, string> = {}
  for (const field of ['from', 'through'] as const)
    if (!d[field] || expectedDateError(d[field])) e[field] = 'Enter a valid date.'
  if (!e.from && !e.through) {
    const days = (Date.parse(d.through) - Date.parse(d.from)) / 86400000 + 1
    if (days < 1 || days > 366) e.through = 'Choose an ordered range of at most 366 days.'
  }
  if (!groups(kind).includes(d.groupBy)) e.groupBy = 'Choose a supported grouping.'
  for (const field of [
    'itemId',
    'warehouseId',
    ...(kind === 'sales' ? ['clientId'] : kind === 'purchases' ? ['supplierId'] : []),
  ] as (keyof Draft)[])
    if (d[field] && (!/^[1-9]\d*$/.test(d[field]) || Number(d[field]) > 2147483647))
      e[field] = 'Choose a valid record.'
  return e
}
export function buildReportQuery(kind: ReportKind, d: Draft): ReportQuery {
  const errors = filterErrors(kind, d)
  if (Object.keys(errors).length) throw Error(Object.values(errors).join(' '))
  const before = new Date(Date.parse(d.through + 'T00:00:00Z') + 86400000)
    .toISOString()
    .slice(0, 10)
  return {
    from: d.from + 'T00:00:00+08:00',
    before: before + 'T00:00:00+08:00',
    groupBy: d.groupBy,
    ...Object.fromEntries(
      [
        'itemId',
        'warehouseId',
        ...(kind === 'sales' ? ['clientId'] : kind === 'purchases' ? ['supplierId'] : []),
      ]
        .filter((k) => d[k as keyof Draft])
        .map((k) => [k, Number(d[k as keyof Draft])]),
    ),
  }
}
export const formatReportMoney = (v: string) =>
  v.startsWith('-') ? '-' + formatOrderCurrency(v.slice(1)) : formatOrderCurrency(v)
export const formatReportPercent = (v: string | null | undefined) =>
  v == null ? '— (Not available)' : v + '%'
