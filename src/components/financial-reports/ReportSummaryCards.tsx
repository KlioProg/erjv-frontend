import { useState } from 'react'
import type { ReportFilterState } from '@/features/financial-reports/financial-report-periods'
import { metricAmount, reportMetrics } from '@/features/financial-reports/financial-report-visuals'
import {
  formatReportMoney,
  formatReportPercent,
} from '@/features/financial-reports/financial-reports.filters'
import type { ReportKind, ReportResult } from '@/features/financial-reports/financial-reports.types'
import { ReportDetails } from './ReportDetails'

export function ReportSummaryCards({
  reports,
  visibleKinds,
  filters,
  view,
}: {
  reports: Partial<Record<ReportKind, ReportResult>>
  visibleKinds: ReportKind[]
  filters: ReportFilterState
  view: 'trends' | 'overview'
}) {
  return (
    <ReportSummaryCardsContent
      reports={reports}
      visibleKinds={visibleKinds}
      filters={filters}
      view={view}
    />
  )
}

function ReportSummaryCardsContent({
  reports,
  visibleKinds,
  filters,
  view,
}: {
  reports: Partial<Record<ReportKind, ReportResult>>
  visibleKinds: ReportKind[]
  filters: ReportFilterState
  view: 'trends' | 'overview'
}) {
  const [expanded, setExpanded] = useState<ReportKind | null>(null)
  const visibleKey = visibleKinds.join('|')
  const [previousVisibleKey, setPreviousVisibleKey] = useState(visibleKey)
  if (previousVisibleKey !== visibleKey) {
    setPreviousVisibleKey(visibleKey)
    if (expanded && !visibleKinds.includes(expanded)) setExpanded(null)
  }
  const cards = reportMetrics.filter(
    (metric) => visibleKinds.includes(metric.kind) && reports[metric.kind],
  )

  return (
    <section aria-label="Report summary and details" className="space-y-3">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((metric) => (
          <div key={metric.kind} className="rounded-lg border bg-card px-4 py-3">
            <dt className="text-xs text-muted-foreground">{metric.label}</dt>
            <dd className="text-2xl font-semibold leading-8 tabular-nums text-foreground">
              {formatReportMoney(metricAmount(reports[metric.kind]!.totals, metric.kind))}
            </dd>
            <p className="text-xs text-muted-foreground">Full applied period, all report rows</p>
            <button
              type="button"
              className="mt-2 text-sm font-medium underline underline-offset-4"
              aria-expanded={expanded === metric.kind}
              aria-controls={`financial-report-details-${metric.kind}`}
              onClick={() =>
                setExpanded((current) => (current === metric.kind ? null : metric.kind))
              }
            >
              {metric.label} details
            </button>
          </div>
        ))}
      </dl>
      {reportMetrics.map((metric) => (
        <div
          key={metric.kind}
          id={`financial-report-details-${metric.kind}`}
          hidden={expanded !== metric.kind}
          className="rounded-lg border bg-card p-4"
        >
          {expanded === metric.kind && reports[metric.kind] && (
            <ReportDetails
              kind={metric.kind}
              metrics={reports[metric.kind]!.totals}
              filters={filters}
              view={view}
            />
          )}
        </div>
      ))}
    </section>
  )
}

export function ReportProfitNotice({ report }: { report?: ReportResult }) {
  const profit = report?.totals
  if (!profit) return null
  const hasUncosted =
    profit.uncostedTaxableSalesValue !== '0.00' ||
    Object.values(profit.uncostedQuantityByUnit ?? {}).some((quantity) => Number(quantity) > 0)
  return (
    <div className="space-y-1 text-xs text-muted-foreground" role="note">
      <p>
        Estimated gross profit uses costed taxable sales and moving weighted average acquisition
        cost. It is not net profit or sales minus purchases.
      </p>
      <p>
        Cost coverage: {formatReportPercent(profit.costCoveragePercent)} · uncosted taxable sales:{' '}
        {formatReportMoney(profit.uncostedTaxableSalesValue ?? '0.00')}.
      </p>
      {hasUncosted && (
        <div
          role="status"
          className="rounded-md border border-amber-600/50 p-3 text-sm text-foreground"
        >
          Some sales have no known acquisition cost. The estimated gross profit has incomplete cost
          coverage.
        </div>
      )}
    </div>
  )
}
