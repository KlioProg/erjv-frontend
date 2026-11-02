import { Link } from 'react-router'
import { useFinancialReport } from '@/features/financial-reports/financial-reports.hooks'
import {
  buildReportQuery,
  createDefaultReportFilters,
  formatReportMoney,
} from '@/features/financial-reports/financial-reports.filters'
import { metricAmount } from '@/features/financial-reports/financial-report-visuals'
import type { ReportKind } from '@/features/financial-reports/financial-reports.types'
import { ReportProfitNotice } from '@/components/financial-reports/ReportSummaryCards'
import { Button } from '@/components/ui/button'
import { ROUTES } from '@/routes'
import { DashboardDataTimes } from './DashboardDataTimes'

const metrics: { kind: ReportKind; label: string; basis: string }[] = [
  { kind: 'sales', label: 'Sales', basis: 'Reconciled deliveries' },
  { kind: 'purchases', label: 'Purchases', basis: 'Accepted purchases' },
  {
    kind: 'gross-profit-estimate',
    label: 'Estimated Gross Profit',
    basis: 'Based on recorded costs',
  },
]

function FinancialMetric({
  kind,
  label,
  basis,
  query,
}: (typeof metrics)[number] & { query: ReturnType<typeof useFinancialReport> }) {
  return (
    <div className="min-h-28 min-w-0 rounded-lg border p-4">
      <Link
        to={`${ROUTES.financialReports}?report=${kind}`}
        className="block rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <h3 className="text-sm font-medium">{label}</h3>
        <p
          className="mt-2 break-words text-2xl font-semibold tabular-nums tracking-tight"
          aria-live="polite"
        >
          {query.isError
            ? 'Unavailable'
            : query.isPending
              ? 'Loading…'
              : formatReportMoney(metricAmount(query.data.totals, kind))}
        </p>
      </Link>
      <p className="mt-1 text-xs text-muted-foreground">{basis}</p>
      {query.isError && (
        <Button variant="ghost" size="sm" onClick={query.refresh}>
          Retry {label}
        </Button>
      )}
    </div>
  )
}

export function DashboardFinancialOverview({ now }: { now: Date }) {
  const filters = createDefaultReportFilters(now)
  const reports = {
    sales: useFinancialReport('sales', buildReportQuery('sales', filters)),
    purchases: useFinancialReport('purchases', buildReportQuery('purchases', filters)),
    'gross-profit-estimate': useFinancialReport(
      'gross-profit-estimate',
      buildReportQuery('gross-profit-estimate', filters),
    ),
  }
  return (
    <section aria-labelledby="financial-overview" className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 id="financial-overview" className="text-base font-semibold">
            Financial Overview
          </h2>
          <p className="text-sm text-muted-foreground">
            {new Intl.DateTimeFormat('en-PH', {
              timeZone: 'Asia/Manila',
              month: 'long',
              year: 'numeric',
            }).format(now)}{' '}
            · Month to date
          </p>
        </div>
        <Link
          to={ROUTES.financialReports}
          className="text-sm font-medium underline underline-offset-4"
        >
          View Financial Reports
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {metrics.map((metric) => (
          <FinancialMetric key={metric.kind} {...metric} query={reports[metric.kind]} />
        ))}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1">
        {!reports['gross-profit-estimate'].isError && (
          <div className="min-w-0 flex-1 [&_summary]:min-h-11">
            <ReportProfitNotice
              report={reports['gross-profit-estimate'].data}
              summaryLabel="How is this calculated?"
            />
          </div>
        )}
        <DashboardDataTimes
          label="Report times"
          sources={metrics.map(({ kind, label }) => ({
            label,
            time:
              reports[kind].data && !reports[kind].isError
                ? Date.parse(reports[kind].data.period.asOf)
                : undefined,
            status: reports[kind].isError
              ? 'Unavailable'
              : reports[kind].isPending
                ? 'Loading…'
                : undefined,
          }))}
        />
      </div>
    </section>
  )
}
