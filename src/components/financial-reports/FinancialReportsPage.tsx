import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageHeader } from '@/components/ui/ManagementPage'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getErrorMessage, getApiError } from '@/lib/api-client'
import {
  buildReportQuery,
  createDefaultReportFilters,
} from '@/features/financial-reports/financial-reports.filters'
import { reportMetrics } from '@/features/financial-reports/financial-report-visuals'
import {
  changeReportFilters,
  initialReportFilters,
  reportDraft,
  type ReportFilterState,
} from '@/features/financial-reports/financial-report-periods'
import { useReportVisuals } from '@/features/financial-reports/financial-report-visuals.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { ReportKind } from '@/features/financial-reports/financial-reports.types'
import { ReportVisualFilters } from './ReportVisualFilters'
import { ReportLineChart } from './ReportCharts'
import { ReportCalendar } from './ReportCalendar'
import { ReportSummaryCards } from './ReportSummaryCards'
import { ReportDetails } from './ReportDetails'

const allKinds = reportMetrics.map((metric) => metric.kind)

export function FinancialReportsPage() {
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [today] = useState(() => createDefaultReportFilters().through)
  const rawView = params.get('view')
  const kind =
    reportMetrics.find((metric) => metric.kind === params.get('report'))?.kind ??
    (rawView === 'overview' ? 'gross-profit-estimate' : 'sales')
  const view =
    rawView === 'overview' || rawView === 'items' || rawView === 'breakdown'
      ? 'breakdown'
      : rawView === 'calendar'
        ? 'calendar'
        : 'trends'
  const [filters, setFilters] = useState<ReportFilterState>(() => initialReportFilters(today))
  const updateParam = (key: string, value: string) =>
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      next.set(key, value)
      if (key === 'view') next.set('report', kind)
      return next
    })

  if (!isAdmin) return <p>Financial reports are available to administrators only.</p>

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description="Monitor sales, purchases, and estimated gross profit.">
        Financial Reports
      </PageHeader>
      <ReportVisualFilters
        value={filters}
        today={today}
        onChange={(action) => setFilters((current) => changeReportFilters(current, action))}
      />
      <VisualSession
        filters={filters}
        kind={kind}
        view={view}
        onSelection={(value) => updateParam('report', value)}
        onView={(value) => updateParam('view', value)}
      />
    </div>
  )
}

function ReportError({ error, restart }: { error: unknown; restart: () => void }) {
  const source = (getApiError(error) as Record<string, unknown> | undefined)?.source as
    { type?: string; id?: string } | undefined
  return (
    <Alert variant="destructive">
      <AlertDescription>
        {getErrorMessage(error)} {source && `Source: ${source.type} #${source.id}.`}{' '}
        <Button type="button" variant="outline" onClick={restart}>
          Restart report
        </Button>
      </AlertDescription>
    </Alert>
  )
}

function VisualSession({
  filters,
  kind,
  view,
  onSelection,
  onView,
}: {
  filters: ReportFilterState
  kind: ReportKind
  view: 'trends' | 'breakdown' | 'calendar'
  onSelection: (kind: ReportKind) => void
  onView: (view: string) => void
}) {
  const scope = buildReportQuery('sales', reportDraft(filters))
  const query = useReportVisuals(scope, allKinds, false)
  const [chartKinds, setChartKinds] = useState<ReportKind[]>([kind])
  const [openedBreakdowns, setOpenedBreakdowns] = useState<ReportKind[]>([])
  if (view === 'breakdown' && !openedBreakdowns.includes(kind))
    setOpenedBreakdowns((opened) => [...opened, kind])
  if (!query.authorized) return <p>Financial reports are available to administrators only.</p>
  const data = query.data ?? {}
  const report = data[kind]
  const metric = reportMetrics.find((metric) => metric.kind === kind)!
  return (
    <div className="min-w-0 space-y-4">
      <ReportSummaryCards
        reports={data}
        errors={query.errors}
        pending={query.pending}
        fetching={query.fetching}
        onRetry={query.restart}
      />
      <Tabs value={view} onValueChange={onView}>
        <section aria-label="Financial analysis" className="min-w-0 rounded-lg border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            {view === 'trends' ? (
              <h2 className="text-sm font-semibold">
                {chartKinds.length === 1
                  ? reportMetrics.find((item) => item.kind === chartKinds[0])!.label
                  : 'Financial trends'}
              </h2>
            ) : (
              <Select value={kind} onValueChange={(value) => onSelection(value as ReportKind)}>
                <SelectTrigger aria-label="Report metric" className="h-9 w-56 max-w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportMetrics.map((item) => (
                    <SelectItem key={item.kind} value={item.kind}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <TabsList aria-label="Analysis view" className="h-auto flex-wrap">
                <TabsTrigger value="trends">Trends</TabsTrigger>
                <TabsTrigger value="breakdown">Details</TabsTrigger>
                <TabsTrigger value="calendar">Calendar</TabsTrigger>
              </TabsList>
            </div>
          </div>
          <div className="min-w-0 p-4">
            <TabsContent value="trends" className="mt-0">
              {reportMetrics
                .filter((item) => chartKinds.includes(item.kind))
                .map((item) => (
                  <div key={item.kind}>
                    {query.errors[item.kind] ? (
                      <div className="mb-2">
                        <p className="text-sm font-medium">{item.label} unavailable</p>
                        <ReportError
                          error={query.errors[item.kind]}
                          restart={() => query.restart(item.kind)}
                        />
                      </div>
                    ) : !data[item.kind] ? (
                      <p role="status">Loading {item.label.toLowerCase()} report...</p>
                    ) : null}
                  </div>
                ))}
              <ReportLineChart
                key={JSON.stringify(scope)}
                selected={chartKinds}
                onToggle={(toggled) =>
                  setChartKinds((current) =>
                    current.includes(toggled)
                      ? current.filter((item) => item !== toggled)
                      : [...current, toggled],
                  )
                }
                reports={data}
                period={filters.period}
              />
            </TabsContent>
            <TabsContent value="calendar" className="mt-0">
              {query.errors[kind] ? (
                <ReportError error={query.errors[kind]} restart={() => query.restart(kind)} />
              ) : !report ? (
                <p role="status">Loading {metric.label.toLowerCase()} report...</p>
              ) : (
                <ReportCalendar
                  key={JSON.stringify(filters)}
                  kind={kind}
                  rows={report.rows}
                  filters={filters}
                />
              )}
            </TabsContent>
            <TabsContent
              value="breakdown"
              forceMount
              hidden={view !== 'breakdown'}
              className="mt-0"
            >
              {view === 'breakdown' &&
                (query.errors[kind] ? (
                  <ReportError error={query.errors[kind]} restart={() => query.restart(kind)} />
                ) : !report ? (
                  <p role="status">Loading {metric.label.toLowerCase()} report...</p>
                ) : null)}
              {openedBreakdowns.map(
                (openedKind) =>
                  data[openedKind] && (
                    <div key={openedKind} hidden={kind !== openedKind}>
                      <ReportDetails
                        kind={openedKind}
                        metrics={data[openedKind]!.totals}
                        filters={filters}
                      />
                    </div>
                  ),
              )}
            </TabsContent>
          </div>
        </section>
      </Tabs>
    </div>
  )
}
