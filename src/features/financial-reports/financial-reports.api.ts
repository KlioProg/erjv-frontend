import { apiClient } from '@/lib/api-client'
import {
  moneyKeys,
  profitMoneyKeys,
  type ReportKind,
  type ReportQuery,
  type ReportResult,
} from './financial-reports.types'
const decimal = (v: unknown) => typeof v === 'string' && /^-?\d+\.\d{2}$/.test(v)
export function validateReport(data: unknown, kind: ReportKind): ReportResult {
  const fail = () => {
    throw Error('The server returned an incomplete report. Restart the report before continuing.')
  }
  if (!data || typeof data !== 'object') return fail()
  const r = data as ReportResult
  if (
    !r.period ||
    !['from', 'before', 'asOf'].every(
      (k) =>
        typeof r.period[k as 'from'] === 'string' &&
        Number.isFinite(Date.parse(r.period[k as 'from'])),
    ) ||
    r.period.businessTimezone !== 'Asia/Manila' ||
    !Array.isArray(r.rows) ||
    !(r.nextCursor === null || (typeof r.nextCursor === 'string' && r.nextCursor.length > 0)) ||
    r.basis !== (kind === 'purchases' ? 'ACCEPTED_PURCHASES' : 'RECONCILED_DELIVERIES')
  )
    return fail()
  for (const m of [r.totals, ...r.rows]) {
    if (
      !m ||
      !moneyKeys.every((k) => decimal(m[k])) ||
      !['eventCount', 'orderCount', 'partyCount'].every(
        (k) => Number.isSafeInteger(m[k as 'eventCount']) && m[k as 'eventCount'] >= 0,
      ) ||
      !m.quantitiesByUnit ||
      typeof m.quantitiesByUnit !== 'object' ||
      Array.isArray(m.quantitiesByUnit)
    )
      return fail()
    if (
      !Object.values(m.quantitiesByUnit).every(
        (q) =>
          q &&
          ['quantity', 'returnedDamagedQuantity', 'missingQuantity'].every((k) =>
            decimal(q[k as 'quantity']),
          ),
      )
    )
      return fail()
    if (
      kind === 'gross-profit-estimate' &&
      (!profitMoneyKeys.every((k) => decimal(m[k])) ||
        !['estimatedGrossMarginPercent', 'costCoveragePercent'].every(
          (k) => m[k as 'costCoveragePercent'] === null || decimal(m[k as 'costCoveragePercent']),
        ) ||
        m.costingMethod !== 'MOVING_WEIGHTED_AVERAGE_ESTIMATE' ||
        !m.uncostedQuantityByUnit ||
        typeof m.uncostedQuantityByUnit !== 'object' ||
        Array.isArray(m.uncostedQuantityByUnit) ||
        !Object.values(m.uncostedQuantityByUnit).every(decimal))
    )
      return fail()
  }
  if (
    r.rows.some(
      (row) =>
        typeof row.key !== 'string' ||
        !row.key ||
        (row.name !== undefined && typeof row.name !== 'string') ||
        (row.unit !== undefined && typeof row.unit !== 'string'),
    ) ||
    new Set(r.rows.map((row) => row.key)).size !== r.rows.length
  )
    return fail()
  if (kind === 'gross-profit-estimate' && r.costingMethod !== 'MOVING_WEIGHTED_AVERAGE_ESTIMATE')
    return fail()
  return r
}
export async function fetchFinancialReportApi(
  kind: ReportKind,
  query: ReportQuery,
  signal?: AbortSignal,
) {
  const { data } = await apiClient.get('/financial-reports/' + kind, { params: query, signal })
  return validateReport(data, kind)
}
