import { Button } from '@/components/ui/button'
import type { ReportKind, ReportResult } from '@/features/financial-reports/financial-reports.types'
import { metricAmount, reportMetrics } from '@/features/financial-reports/financial-report-visuals'
import {
  formatReportMoney,
  formatReportPercent,
} from '@/features/financial-reports/financial-reports.filters'

export function ReportSummaryCards({
  reports,
  selected,
  onSelection,
  errors = {},
  pending = [],
  fetching = [],
  onRetry,
}: {
  reports: Partial<Record<ReportKind, ReportResult>>
  selected: ReportKind
  onSelection: (kind: ReportKind) => void
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
          className="flex min-w-0 flex-col rounded-lg border bg-card"
          style={{ borderColor: selected === metric.kind ? metric.color : undefined }}
        >
          <button
            type="button"
            aria-label={`Analyze ${metric.label}`}
            aria-pressed={selected === metric.kind}
            onClick={() => onSelection(metric.kind)}
            className="min-w-0 flex-1 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-busy={fetching.includes(metric.kind)}
          >
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
            <span className="mt-1 block text-xs text-muted-foreground">
              {metric.kind === 'sales'
                ? 'Reconciled deliveries'
                : metric.kind === 'purchases'
                  ? 'Accepted purchases'
                  : 'Estimated, not net profit'}
            </span>
            <span className="sr-only">
              {selected === metric.kind ? 'Selected metric' : 'Select metric'}
            </span>
          </button>
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
