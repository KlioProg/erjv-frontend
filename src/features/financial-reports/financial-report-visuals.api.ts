import { fetchFinancialReportApi } from './financial-reports.api'
import type { ReportKind, ReportQuery, ReportResult } from './financial-reports.types'

export async function fetchCompleteItemReport(
  kind: ReportKind,
  scope: ReportQuery,
  signal?: AbortSignal,
): Promise<ReportResult> {
  let first: ReportResult | undefined
  const rows: ReportResult['rows'] = []
  const cursors = new Set<string>(),
    ids = new Set<string>()
  let cursor: string | undefined
  do {
    const page = await fetchFinancialReportApi(
      kind,
      { ...scope, groupBy: 'item', limit: 100, ...(cursor ? { cursor } : {}) },
      signal,
    )
    if (
      first &&
      (JSON.stringify(page.period) !== JSON.stringify(first.period) ||
        JSON.stringify(page.totals) !== JSON.stringify(first.totals))
    )
      throw Error('Report snapshot changed. Restart the report.')
    first ??= page
    for (const row of page.rows) {
      if (ids.has(row.key)) throw Error('Repeated report item. Restart the report.')
      ids.add(row.key)
      rows.push(row)
    }
    if (page.nextCursor && cursors.has(page.nextCursor))
      throw Error('Repeated report cursor. Restart the report.')
    cursor = page.nextCursor ?? undefined
    if (cursor) cursors.add(cursor)
  } while (cursor)
  return { ...first!, rows, nextCursor: null }
}
