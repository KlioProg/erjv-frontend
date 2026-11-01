import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageHeader } from '@/components/ui/ManagementPage'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { getErrorMessage, getApiError } from '@/lib/api-client'
import {
  buildReportQuery,
  createDefaultReportFilters,
} from '@/features/financial-reports/financial-reports.filters'
import {
  calendarMetric,
  reportMetrics,
} from '@/features/financial-reports/financial-report-visuals'
import {
  changeReportFilters,
  initialReportFilters,
  reportDraft,
  type PeriodAction,
  type ReportFilterState,
} from '@/features/financial-reports/financial-report-periods'
import { useReportVisuals } from '@/features/financial-reports/financial-report-visuals.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { ReportKind } from '@/features/financial-reports/financial-reports.types'
import { ReportVisualFilters } from './ReportVisualFilters'
import { ReportLineChart, ReportItemCharts } from './ReportCharts'
import { ReportCalendar } from './ReportCalendar'
import { ReportProfitNotice, ReportSummaryCards } from './ReportSummaryCards'

export function FinancialReportsPage() {
  const { isAdmin, isManager } = useAuth()
  const [params, setParams] = useSearchParams()
  const [today] = useState(() => createDefaultReportFilters().through)
  const raw = params.get('report')
  const initialKind = reportMetrics.find((metric) => metric.kind === raw)?.kind
  const [selected, setSelected] = useState<ReportKind[]>(() =>
    initialKind ? [initialKind] : reportMetrics.map((metric) => metric.kind),
  )
  const [single, setSingle] = useState<ReportKind>(initialKind ?? 'gross-profit-estimate')
  const [filters, setFilters] = useState<ReportFilterState>(() => initialReportFilters(today))
  const overview = params.get('view') === 'overview'
  const calendar = calendarMetric(selected)
  const kinds = overview ? [single] : [...new Set([...selected, calendar])]

  if (!isAdmin && !isManager)
    return <p>Financial reports are available to administrators and managers.</p>

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <PageHeader description="Track sales, accepted purchases and estimated gross profit across time.">
        Financial Reports
      </PageHeader>
      <div role="group" aria-label="Report view">
        <StatusTabNav
          tabs={[
            { value: 'trends', label: 'Trends' },
            { value: 'overview', label: 'Overview' },
          ]}
          activeTab={overview ? 'overview' : 'trends'}
          onTabChange={(view) => {
            if ((view === 'overview') === overview) return
            if (view === 'overview') setSingle(calendarMetric(selected))
            setParams((previous) => {
              const next = new URLSearchParams(previous)
              next.set('view', view)
              return next
            })
          }}
        />
      </div>
      <ReportVisualFilters
        value={filters}
        today={today}
        onChange={(action: PeriodAction) =>
          setFilters((current) => changeReportFilters(current, action))
        }
      />
      <VisualSession
        filters={filters}
        kinds={kinds}
        selected={selected}
        calendar={calendar}
        single={single}
        overview={overview}
        onSelection={(kind) => {
          if (overview) setSingle(kind)
          else
            setSelected((current) =>
              current.includes(kind)
                ? current.length > 1
                  ? current.filter((selectedKind) => selectedKind !== kind)
                  : current
                : [...current, kind],
            )
        }}
      />
    </div>
  )
}

function VisualSession({
  filters,
  kinds,
  selected,
  calendar,
  single,
  overview,
  onSelection,
}: {
  filters: ReportFilterState
  kinds: ReportKind[]
  selected: ReportKind[]
  calendar: ReportKind
  single: ReportKind
  overview: boolean
  onSelection: (kind: ReportKind) => void
}) {
  const draft = reportDraft(filters)
  const scope = buildReportQuery('sales', draft)
  const query = useReportVisuals(scope, kinds, overview)
  if (!query.authorized)
    return <p>Financial reports are available to administrators and managers.</p>

  const displayed = overview ? [single] : selected
  const data = query.isError ? undefined : query.data
  const source = (getApiError(query.error) as Record<string, unknown> | undefined)?.source as
    { type?: string; id?: string } | undefined

  return (
    <div className="min-w-0 space-y-5">
      <div
        role="group"
        aria-label={overview ? 'Overview metric' : 'Trend lines'}
        className="flex flex-wrap gap-2"
      >
        {reportMetrics.map((metric) => (
          <Button
            type="button"
            key={metric.kind}
            variant={displayed.includes(metric.kind) ? 'default' : 'outline'}
            aria-pressed={displayed.includes(metric.kind)}
            disabled={!overview && selected.length === 1 && selected.includes(metric.kind)}
            onClick={() => onSelection(metric.kind)}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-current"
              style={{ backgroundColor: metric.color }}
              aria-hidden="true"
            />
            {metric.label}
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Sales (income): reconciled deliveries. Purchases (expense): accepted purchases, excluding
        other operating expenses.
      </p>
      {query.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {getErrorMessage(query.error)} {source && `Source: ${source.type} #${source.id}.`}{' '}
            <Button variant="outline" onClick={query.restart}>
              Restart report
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {!data && !query.isError && (
        <p role="status">
          {overview ? 'Loading complete item distribution…' : 'Loading financial trends…'}
        </p>
      )}
      {data && (
        <>
          <ReportSummaryCards
            key={JSON.stringify([overview ? 'overview' : 'trends', scope])}
            reports={data}
            visibleKinds={displayed}
            filters={filters}
            view={overview ? 'overview' : 'trends'}
          />
          <p className="text-xs text-muted-foreground">
            {kinds
              .map(
                (kind) =>
                  `${reportMetrics.find((metric) => metric.kind === kind)!.label} as of ${new Date(data[kind]!.period.asOf).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}`,
              )
              .join(' · ')}
          </p>
          {overview ? (
            <>
              <ReportProfitNotice report={data['gross-profit-estimate']} />
              <ReportItemCharts kind={single} report={data[single]!} />
            </>
          ) : (
            <>
              <ReportLineChart selected={selected} reports={data} period={filters.period} />
              <div className="space-y-3">
                <ReportCalendar
                  key={JSON.stringify(filters)}
                  kind={calendar}
                  rows={data[calendar]!.rows}
                  filters={filters}
                />
                <ReportProfitNotice report={data['gross-profit-estimate']} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
