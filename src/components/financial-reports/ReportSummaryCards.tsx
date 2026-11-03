import { Button } from '@/components/ui/button'
import type { ReportKind, ReportResult } from '@/features/financial-reports/financial-reports.types'
import { metricAmount, reportMetrics } from '@/features/financial-reports/financial-report-visuals'
import { formatReportMoney } from '@/features/financial-reports/financial-reports.filters'

export function ReportSummaryCards({
  reports,
  errors = {},
  pending = [],
  fetching = [],
  onRetry,
}: {
  reports: Partial<Record<ReportKind, ReportResult>>
  errors?: Partial<Record<ReportKind, Error>>
  pending?: ReportKind[]
  fetching?: ReportKind[]
  onRetry?: (kind: ReportKind) => void
}) {
  return (
    <section aria-label="Financial metrics" className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {reportMetrics.map((metric) => (
        <div
          key={metric.kind}
          role="group"
          aria-label={metric.label}
          className="flex min-w-0 flex-col rounded-lg border bg-card"
        >
          <div className="min-w-0 flex-1 px-4 py-3" aria-busy={fetching.includes(metric.kind)}>
            <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              {metric.label}
              <span
                aria-hidden="true"
                className="size-2 rounded-full"
                style={{ backgroundColor: metric.color }}
              />
            </span>
            <span className="mt-1 block break-words text-xl font-semibold leading-8 tabular-nums text-foreground xl:text-2xl">
              {errors[metric.kind]
                ? 'Unavailable'
                : pending.includes(metric.kind)
                  ? 'Loading...'
                  : reports[metric.kind]
                    ? formatReportMoney(metricAmount(reports[metric.kind]!.totals, metric.kind))
                    : 'Not available'}
            </span>
            {metric.kind === 'gross-profit-estimate' && (
              <span className="mt-1 block text-xs text-muted-foreground">
                Estimated, not net profit
              </span>
            )}
          </div>
          {errors[metric.kind] && onRetry && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Retry ${metric.label}`}
              onClick={() => onRetry(metric.kind)}
            >
              Retry report
            </Button>
          )}
          {metric.kind === 'gross-profit-estimate' && !errors[metric.kind] && (
            <ReportProfitNotice report={reports[metric.kind]} className="mx-4 mb-3" />
          )}
        </div>
      ))}
    </section>
  )
}

export function ReportProfitNotice({
  report,
  className = '',
}: {
  report?: ReportResult
  className?: string
}) {
  const profit = report?.totals
  if (!profit) return null
  const hasUncosted =
    (profit.costCoveragePercent != null && Number(profit.costCoveragePercent) < 100) ||
    profit.uncostedTaxableSalesValue !== '0.00' ||
    Object.values(profit.uncostedQuantityByUnit ?? {}).some((quantity) => Number(quantity) > 0)
  if (!hasUncosted && profit.costCoveragePercent != null) return null
  return (
    <p role="status" className={`text-xs text-foreground ${className}`}>
      {hasUncosted
        ? 'Estimated gross profit may be incomplete because some purchase costs are missing.'
        : 'Cost coverage is unavailable for estimated gross profit.'}
    </p>
  )
}
