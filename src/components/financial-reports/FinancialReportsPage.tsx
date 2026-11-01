import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import { useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  ManagementPage,
  PageHeader,
  PageToolbar,
  PageOverview,
} from '@/components/ui/ManagementPage'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
import {
  DataTableExpandedSection,
  DataTableExpandToggle,
} from '@/components/ui/DataTableExpandedSection'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getApiError, getErrorMessage } from '@/lib/api-client'
import { formatProductUnit } from '@/lib/product-unit'
import { useFinancialReport } from '@/features/financial-reports/financial-reports.hooks'
import {
  createDefaultReportFilters,
  buildReportQuery,
  filterErrors,
  groups,
  breakdown,
  formatReportMoney,
  formatReportPercent,
} from '@/features/financial-reports/financial-reports.filters'
import {
  moneyKeys,
  profitMoneyKeys,
  type Draft,
  type Metrics,
  type ReportKind,
  type ReportQuery,
  type ReportRow,
} from '@/features/financial-reports/financial-reports.types'
const tabs = [
  { value: 'sales', label: 'Sales' },
  { value: 'purchases', label: 'Purchases' },
  { value: 'gross-profit-estimate', label: 'Gross Profit Estimate' },
]
const labels: Record<string, string> = {
  subtotalAmount: 'Subtotal',
  discountAmount: 'Discount',
  taxableAmount: 'Taxable amount',
  taxAmount: 'Tax',
  totalAmount: 'Total',
  costedTaxableSalesValue: 'Costed taxable sales',
  estimatedAcquisitionCost: 'Estimated acquisition cost',
  estimatedGrossProfitAmount: 'Estimated gross profit',
  uncostedTaxableSalesValue: 'Uncosted taxable sales',
}
function Details({ metrics, profit }: { metrics: Metrics; profit: boolean }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {[...moneyKeys, ...(profit ? profitMoneyKeys : [])].map((k) => (
        <div key={k}>
          <dt>{labels[k]}</dt>
          <dd className="tabular-nums">{formatReportMoney(metrics[k]!)}</dd>
        </div>
      ))}
      <div>
        Events: {metrics.eventCount} · Orders: {metrics.orderCount} · Parties: {metrics.partyCount}
      </div>
      {Object.entries(metrics.quantitiesByUnit).map(([unit, q]) => (
        <div key={unit}>
          {formatProductUnit(unit)}: {formatStockCents(parseStockCents(q.quantity))} · Returned
          damaged: {formatStockCents(parseStockCents(q.returnedDamagedQuantity))} · Missing:{' '}
          {formatStockCents(parseStockCents(q.missingQuantity))}
        </div>
      ))}
      {profit && (
        <>
          <div>
            Estimated gross margin: {formatReportPercent(metrics.estimatedGrossMarginPercent)}
          </div>
          <div>Cost coverage: {formatReportPercent(metrics.costCoveragePercent)}</div>
          {Object.entries(metrics.uncostedQuantityByUnit ?? {}).map(([unit, q]) => (
            <div key={unit}>
              Uncosted {formatProductUnit(unit)}: {formatStockCents(parseStockCents(q))}
            </div>
          ))}
        </>
      )}
    </dl>
  )
}
export function FinancialReportsPage() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('report')
  const kind: ReportKind = raw === 'purchases' || raw === 'gross-profit-estimate' ? raw : 'sales'
  const [common, setCommon] = useState(createDefaultReportFilters)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description="Review reconciled sales, accepted purchases and estimated gross profit.">
        Financial Reports
      </PageHeader>
      <div role="group" aria-label="Report selection">
        <StatusTabNav tabs={tabs} activeTab={kind} onTabChange={(v) => setParams({ report: v })} />
      </div>
      <ReportSession key={kind} kind={kind} initial={common} onApplied={setCommon} />
    </div>
  )
}
function ReportSession({
  kind,
  initial,
  onApplied,
}: {
  kind: ReportKind
  initial: Draft
  onApplied: (d: Draft) => void
}) {
  const start = { ...initial, groupBy: 'none' as const, clientId: '', supplierId: '' }
  const [draft, setDraft] = useState<Draft>(start)
  const [applied, setApplied] = useState<ReportQuery>(() => buildReportQuery(kind, start))
  const [generation, setGeneration] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const summary = useRef<HTMLDivElement>(null)
  const change = (key: keyof Draft, value: string) => setDraft((d) => ({ ...d, [key]: value }))
  const reset = () => {
    setDraft(createDefaultReportFilters())
    setErrors({})
  }
  const apply = () => {
    const e = filterErrors(kind, draft)
    setErrors(e)
    if (Object.keys(e).length) {
      requestAnimationFrame(() => summary.current?.focus())
      return
    }
    setApplied(buildReportQuery(kind, draft))
    onApplied(draft)
    setGeneration((g) => g + 1)
  }
  const preset = (value: string) => {
    const today = createDefaultReportFilters()
    if (value === 'today') setDraft((d) => ({ ...d, from: today.through, through: today.through }))
    else if (value === 'month')
      setDraft((d) => ({ ...d, from: today.from, through: today.through }))
    else if (value === 'last') {
      const end = new Date(Date.parse(today.from + 'T00:00:00Z') - 86400000)
        .toISOString()
        .slice(0, 10)
      setDraft((d) => ({ ...d, from: end.slice(0, 8) + '01', through: end }))
    }
  }
  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          apply()
        }}
        className="flex flex-col gap-4"
        noValidate
      >
        {Object.keys(errors).length > 0 && (
          <Alert
            ref={summary}
            tabIndex={-1}
            aria-labelledby="report-error-heading"
            variant="destructive"
          >
            <h2 id="report-error-heading">Review report filters</h2>
            <ul>
              {Object.entries(errors).map(([k, v]) => (
                <li key={k}>
                  <a
                    className="underline"
                    href={'#report-' + k}
                    onClick={(e) => {
                      e.preventDefault()
                      document.getElementById('report-' + k)?.focus()
                    }}
                  >
                    {v}
                  </a>
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <PageToolbar>
          {['today', 'month', 'last'].map((p) => (
            <Button type="button" variant="outline" key={p} onClick={() => preset(p)}>
              {p === 'today' ? 'Today' : p === 'month' ? 'Month to date' : 'Last month'}
            </Button>
          ))}
        </PageToolbar>
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(['from', 'through'] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={'report-' + k}>
                {k === 'from' ? 'From' : 'Through'} (inclusive, Manila)
              </Label>
              <Input
                className="focus-visible:ring-2 focus-visible:ring-ring"
                id={'report-' + k}
                type="date"
                value={draft[k]}
                onChange={(e) => change(k, e.target.value)}
                aria-invalid={!!errors[k]}
                aria-describedby={errors[k] ? 'error-' + k : undefined}
              />
              {errors[k] && (
                <p id={'error-' + k} className="text-sm text-destructive">
                  {errors[k]}
                </p>
              )}
            </div>
          ))}
          <div className="space-y-1">
            <Label htmlFor="report-groupBy">Group by</Label>
            <Select value={draft.groupBy} onValueChange={(v) => change('groupBy', v)}>
              <SelectTrigger id="report-groupBy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {groups(kind).map((g) => (
                  <SelectItem key={g} value={g}>
                    {g === 'none' ? 'Overview' : g.charAt(0).toUpperCase() + g.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {[
            { field: 'itemId', path: '/inventory-items', label: 'Item' },
            { field: 'warehouseId', path: '/warehouses', label: 'Warehouse' },
            ...(kind === 'sales'
              ? [{ field: 'clientId', path: '/clients', label: 'Customer' }]
              : kind === 'purchases'
                ? [{ field: 'supplierId', path: '/suppliers', label: 'Supplier' }]
                : []),
          ].map(({ field, path, label }) => (
            <div key={field} className="space-y-1">
              <Label htmlFor={'report-' + field}>
                {label} {draft[field as keyof Draft] ? '' : '(All)'}
              </Label>
              <div className="flex gap-2">
                <CursorLookup<{ id: number; name: string; isActive?: boolean; variety?: string }>
                  id={'report-' + field}
                  path={path}
                  filter={{ includeInactive: 'true' }}
                  value={draft[field as keyof Draft]}
                  label={label}
                  error={errors[field]}
                  getLabel={(r) =>
                    [r.name, r.variety, r.isActive === false ? '(archived)' : '']
                      .filter(Boolean)
                      .join(' ')
                  }
                  onChange={(v) => change(field as keyof Draft, v)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => change(field as keyof Draft, '')}
                  aria-label={'Clear ' + label.toLowerCase()}
                >
                  Clear
                </Button>
              </div>
            </div>
          ))}
        </div>
        <PageToolbar>
          <Button type="submit">Apply filters</Button>
          <Button type="button" variant="outline" onClick={reset}>
            Reset filters
          </Button>
          <p className="text-sm text-muted-foreground">
            Changes take effect when you apply filters.
          </p>
        </PageToolbar>
      </form>
      <Results key={generation} kind={kind} scope={applied} />
    </>
  )
}
function Results({ kind, scope }: { kind: ReportKind; scope: ReportQuery }) {
  const query = useFinancialReport(kind, scope)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const profit = kind === 'gross-profit-estimate'
  if (query.isError) {
    const e = getApiError(query.error)
    const source = (e as (Record<string, unknown> & { status?: number }) | undefined)?.source as
      { type?: string; id?: string } | undefined
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {getErrorMessage(query.error)} {source && `Source: ${source.type} #${source.id}.`}{' '}
          <Button variant="outline" onClick={query.restart}>
            Restart report
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  const data = query.data
  if (!data) return <p role="status">Loading financial report…</p>
  const metrics = data.totals
  const main = profit
    ? [
        'costedTaxableSalesValue',
        'estimatedAcquisitionCost',
        'estimatedGrossProfitAmount',
        'uncostedTaxableSalesValue',
      ]
    : ['subtotalAmount', 'discountAmount', 'taxableAmount', 'taxAmount', 'totalAmount']
  const columns: ColumnDef<ReportRow>[] = [
    {
      id: 'group',
      header:
        scope.groupBy === 'client'
          ? 'Customer'
          : scope.groupBy === 'supplier'
            ? 'Supplier'
            : 'Group',
      accessorFn: (r) => r.name ?? r.key,
      sortable: false,
    },
    ...(profit
      ? ['costedTaxableSalesValue', 'estimatedAcquisitionCost', 'estimatedGrossProfitAmount']
      : ['taxableAmount', 'taxAmount', 'totalAmount']
    ).map((k) => ({
      id: k,
      header: labels[k],
      align: 'right' as const,
      sortable: false,
      cell: ({ row }: { row: ReportRow }) => formatReportMoney(row[k as keyof Metrics] as string),
    })),
    ...(profit
      ? [
          {
            id: 'margin',
            header: 'Estimated margin',
            align: 'right' as const,
            cell: ({ row }: { row: ReportRow }) =>
              formatReportPercent(row.estimatedGrossMarginPercent),
          },
          {
            id: 'coverage',
            header: 'Cost coverage',
            align: 'right' as const,
            cell: ({ row }: { row: ReportRow }) => formatReportPercent(row.costCoveragePercent),
          },
        ]
      : [
          {
            id: 'orders',
            header: 'Orders',
            accessorKey: 'orderCount' as const,
            align: 'right' as const,
          },
        ]),
    {
      id: 'details',
      header: 'Details',
      cell: ({ row }) => (
        <DataTableExpandToggle
          expanded={expanded.has(row.key)}
          controls={'report-details-' + row.key}
          ariaLabel={'Details for ' + (row.name ?? row.key)}
          onToggle={() =>
            setExpanded((s) => {
              const n = new Set(s)
              if (n.has(row.key)) n.delete(row.key)
              else n.add(row.key)
              return n
            })
          }
        >
          Details
        </DataTableExpandToggle>
      ),
    },
  ]
  return (
    <ManagementPage
      summary={main.map((k) => ({
        label: labels[k],
        value: formatReportMoney(metrics[k as keyof Metrics] as string),
        hint: 'Full filtered report, all pages',
      }))}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            {kind === 'purchases' ? 'Accepted purchases' : 'Reconciled deliveries'} · Asia/Manila
            <br />
            Period:{' '}
            {new Date(data.period.from).toLocaleDateString('en-PH', {
              timeZone: 'Asia/Manila',
            })}{' '}
            through{' '}
            {new Date(Date.parse(data.period.before) - 1).toLocaleDateString('en-PH', {
              timeZone: 'Asia/Manila',
            })}
            <br />
            As of {new Date(data.period.asOf).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}
          </p>
          <Button variant="outline" disabled={query.isFetching} onClick={query.refresh}>
            Refresh
          </Button>
          {query.isFetching && <span role="status">Updating report…</span>}
        </div>
        <PageOverview />
        {profit && (
          <>
            <p className="text-sm">
              Moving weighted average estimate. Profit and margin cover only costed taxable sales,
              excluding uncosted sales; this is not net profit.
            </p>
            <p>
              Estimated gross margin: {formatReportPercent(metrics.estimatedGrossMarginPercent)} ·
              Cost coverage: {formatReportPercent(metrics.costCoveragePercent)}
            </p>
            {(metrics.uncostedTaxableSalesValue !== '0.00' ||
              Object.values(metrics.uncostedQuantityByUnit ?? {}).some((q) => q !== '0.00')) && (
              <Alert>
                <AlertDescription>
                  Some sales have no known acquisition cost. Review uncosted values and quantities
                  below.
                </AlertDescription>
              </Alert>
            )}
          </>
        )}
        <details>
          <summary className="cursor-pointer font-medium">
            Full report totals and quantities
          </summary>
          <Details metrics={metrics} profit={profit} />
        </details>
        {scope.groupBy === 'none' ? (
          <p>Select a grouping and apply filters to see a breakdown.</p>
        ) : (
          <>
            <DataTable
              appearance="management"
              data={data.rows}
              columns={columns}
              getRowKey={(r) => r.key}
              pagination={!breakdown(scope.groupBy)}
              manualSorting
              loadingMessage="Loading report rows"
              tableClassName="min-w-[760px]"
              emptyContent={<p>No results for this report period and filters.</p>}
              renderExpandedRow={(row) =>
                expanded.has(row.key) ? (
                  <DataTableExpandedSection
                    id={'report-details-' + row.key}
                    title={'Details: ' + (row.name ?? row.key)}
                  >
                    <Details metrics={row} profit={profit} />
                  </DataTableExpandedSection>
                ) : null
              }
            />
            {breakdown(scope.groupBy) && <CursorPageControls {...query} label="Report row" />}
          </>
        )}
      </div>
    </ManagementPage>
  )
}
