import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { DataTableFooter } from '@/components/ui/DataTableFooter'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import {
  DataTableExpandedSection,
  DataTableExpandToggle,
} from '@/components/ui/DataTableExpandedSection'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFinancialReport } from '@/features/financial-reports/financial-reports.hooks'
import {
  breakdown,
  buildReportQuery,
  formatReportMoney,
  formatReportPercent,
  groups,
} from '@/features/financial-reports/financial-reports.filters'
import {
  reportDraft,
  type ReportFilterState,
} from '@/features/financial-reports/financial-report-periods'
import {
  moneyKeys,
  profitMoneyKeys,
  type Metrics,
  type ReportGroup,
  type ReportKind,
  type ReportQuery,
  type ReportResult,
  type ReportRow,
} from '@/features/financial-reports/financial-reports.types'
import { getApiError, getErrorMessage } from '@/lib/api-client'
import {
  metricAmount,
  reportDateLabel,
} from '@/features/financial-reports/financial-report-visuals'
import { formatProductUnit } from '@/lib/product-unit'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'

const labels: Partial<Record<keyof Metrics, string>> = {
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
const groupLabel = (group: ReportGroup) =>
  group === 'none'
    ? 'No grouping'
    : group === 'client'
      ? 'Customer'
      : group[0].toUpperCase() + group.slice(1)

export function ReportDetails({
  kind,
  metrics,
  filters,
}: {
  kind: ReportKind
  metrics: Metrics
  filters: ReportFilterState
}) {
  const [groupBy, setGroupBy] = useState<ReportGroup>('item')
  const [partyId, setPartyId] = useState('')
  const profit = kind === 'gross-profit-estimate'
  const amountKeys = profit
    ? ([
        'costedTaxableSalesValue',
        'estimatedAcquisitionCost',
        'estimatedGrossProfitAmount',
        'uncostedTaxableSalesValue',
      ] as const)
    : (['subtotalAmount', 'discountAmount', 'taxableAmount', 'taxAmount', 'totalAmount'] as const)
  const groupsForKind = groups(kind)
  const scope = buildReportQuery(kind, {
    ...reportDraft(filters),
    groupBy,
    ...(kind === 'sales' ? { clientId: partyId } : { supplierId: partyId }),
  })
  const party = groupBy === 'client' || groupBy === 'supplier'

  return (
    <div className="space-y-4">
      <details>
        <summary className="min-h-9 cursor-pointer rounded py-1 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          More financial details
        </summary>
        <h2 className="mt-3 text-base font-semibold">
          {kind === 'gross-profit-estimate'
            ? 'Estimated gross profit'
            : kind === 'sales'
              ? 'Sales'
              : 'Purchases'}{' '}
          details
        </h2>
        <p className="text-sm text-muted-foreground">
          These totals match the cards above.
        </p>
        <dl className="grid gap-2 sm:grid-cols-2">
          {amountKeys.map((key) => (
            <div key={key}>
              <dt className="text-xs text-muted-foreground">{labels[key]}</dt>
              <dd className="tabular-nums">{formatReportMoney(String(metrics[key] ?? '0.00'))}</dd>
            </div>
          ))}
          <div>
            <dt className="text-xs text-muted-foreground">Events · Orders · Parties</dt>
            <dd>
              {metrics.eventCount} · {metrics.orderCount} · {metrics.partyCount}
            </dd>
          </div>
          {Object.entries(metrics.quantitiesByUnit).map(([unit, quantities]) => (
            <div key={unit}>
              <dt className="text-xs text-muted-foreground">{formatProductUnit(unit)}</dt>
              <dd>
                {formatStockCents(parseStockCents(quantities.quantity))} · Returned damaged{' '}
                {formatStockCents(parseStockCents(quantities.returnedDamagedQuantity))} · Missing{' '}
                {formatStockCents(parseStockCents(quantities.missingQuantity))}
              </dd>
            </div>
          ))}
          {profit && (
            <>
              <div>
                <dt className="text-xs text-muted-foreground">Estimated gross margin</dt>
                <dd>{formatReportPercent(metrics.estimatedGrossMarginPercent)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Cost coverage</dt>
                <dd>{formatReportPercent(metrics.costCoveragePercent)}</dd>
              </div>
              {Object.entries(metrics.uncostedQuantityByUnit ?? {}).map(([unit, quantity]) => (
                <div key={unit}>
                  <dt className="text-xs text-muted-foreground">Uncosted quantity ({unit})</dt>
                  <dd>{quantity}</dd>
                </div>
              ))}
            </>
          )}
        </dl>
      </details>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Group by
          <Select
            value={groupBy}
            onValueChange={(value) => {
              setGroupBy(value as ReportGroup)
              setPartyId('')
            }}
          >
            <SelectTrigger aria-label="Group by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {groupsForKind.map((group) => (
                <SelectItem key={group} value={group}>
                  {groupLabel(group)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {party && (
          <div className="space-y-1 text-sm">
            {groupBy === 'client' ? 'Customer' : 'Supplier'} (optional)
            <div className="flex gap-2">
              <CursorLookup<{ id: number; name: string; isActive?: boolean }>
                id="report-detail-party"
                path={groupBy === 'client' ? '/clients' : '/suppliers'}
                filter={{ includeInactive: 'true' }}
                value={partyId}
                label={groupBy === 'client' ? 'Customer' : 'Supplier'}
                getLabel={(entry) =>
                  `${entry.name}${entry.isActive === false ? ' (archived)' : ''}`
                }
                onChange={setPartyId}
              />
              <Button type="button" variant="outline" onClick={() => setPartyId('')}>
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>
      {groupBy !== 'none' && (
        <ReportBreakdown
          key={JSON.stringify([kind, groupBy, partyId, scope])}
          kind={kind}
          scope={scope}
          groupBy={groupBy}
          totals={metrics}
        />
      )}
    </div>
  )
}

function ReportBreakdown({
  kind,
  scope,
  groupBy,
  totals,
}: {
  kind: ReportKind
  scope: ReportQuery
  groupBy: ReportGroup
  totals: Metrics
}) {
  const query = useFinancialReport(kind, scope)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  if (query.isError) {
    const error = getApiError(query.error)
    const source = (error as (Record<string, unknown> & { status?: number }) | undefined)
      ?.source as { type?: string; id?: string } | undefined
    const message = getErrorMessage(query.error)
    const needsReload = /snapshot|cursor/i.test(message)
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {needsReload
            ? 'These results changed or are no longer available. Reload details to continue.'
            : message}{' '}
          {source && `Source: ${source.type} #${source.id}.`}{' '}
          {needsReload && (
            <details>
              <summary className="min-h-9 cursor-pointer py-1">Error information</summary>
              <p>{message}</p>
            </details>
          )}
          <Button variant="outline" onClick={query.restart}>
            Reload details
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (!query.data) return <p role="status">Loading details…</p>
  const result = query.data as ReportResult
  const profit = kind === 'gross-profit-estimate'
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const rowLabel = (row: ReportRow) =>
    groupBy === 'month' && /^\d{4}-(0[1-9]|1[0-2])$/.test(row.key)
      ? reportDateLabel(row.key + '-01', { month: 'long', year: 'numeric' })
      : (row.name ?? row.key)
  const hasPages = query.hasPrevious || query.hasNext
  const filteredTotal =
    Boolean(scope.clientId || scope.supplierId) &&
    metricAmount(result.totals, kind) !== metricAmount(totals, kind)
  const columns: ColumnDef<ReportRow>[] = [
    {
      id: 'group',
      header: groupLabel(groupBy),
      accessorFn: rowLabel,
      sortable: false,
    },
    ...(profit ? ['estimatedGrossProfitAmount'] : ['totalAmount']).map((key) => ({
      id: key,
      header:
        key === 'totalAmount'
          ? kind === 'sales'
            ? 'Sales'
            : 'Purchases'
          : labels[key as keyof Metrics]!,
      align: 'right' as const,
      sortable: false,
      cell: ({ row }: { row: ReportRow }) =>
        formatReportMoney(String(row[key as keyof Metrics] ?? '0.00')),
    })),
    ...(!profit
      ? [
          {
            id: 'orders',
            header: 'Orders',
            accessorKey: 'orderCount' as const,
            align: 'right' as const,
            sortable: false,
          },
        ]
      : []),
    {
      id: 'details',
      header: 'Details',
      cell: ({ row }) => (
        <DataTableExpandToggle
          expanded={expanded.has(row.key)}
          controls={`report-breakdown-${row.key}`}
          ariaLabel={`Details for ${rowLabel(row)}`}
          onToggle={() => toggle(row.key)}
        >
          Details
        </DataTableExpandToggle>
      ),
    },
  ]
  return (
    <section className="space-y-3" aria-label="Report details">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <details className="text-sm text-muted-foreground">
          <summary className="min-h-9 cursor-pointer rounded py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            About these results
          </summary>
          <p className="mt-2">
            Report as of{' '}
            {new Date(result.period.asOf).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}.
            Details and totals above may have different report times.
          </p>
        </details>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={query.refresh}
        >
          Refresh details
        </Button>
      </div>
      {filteredTotal && (
        <p className="text-sm">
          Filtered total: {formatReportMoney(metricAmount(result.totals, kind))}
        </p>
      )}
      <DataTable
        appearance="management"
        data={result.rows}
        columns={columns}
        getRowKey={(row) => row.key}
        pagination={!breakdown(groupBy) && result.rows.length > 10}
        manualSorting
        tableClassName="min-w-[400px]"
        emptyContent={<p>No rows for this breakdown.</p>}
        renderExpandedRow={(row) =>
          expanded.has(row.key) ? (
            <DataTableExpandedSection
              id={`report-breakdown-${row.key}`}
              title={`Details: ${rowLabel(row)}`}
            >
              <BreakdownRowDetails metrics={row} profit={profit} />
            </DataTableExpandedSection>
          ) : null
        }
      />
      {breakdown(groupBy) && hasPages ? (
        <DataTableFooter {...query} rowCount={result.rows.length} label="Result" />
      ) : (
        result.rows.length <= (breakdown(groupBy) ? query.pageSize : 10) && (
          <p className="text-sm text-muted-foreground">
            {result.rows.length} {result.rows.length === 1 ? 'result' : 'results'}
          </p>
        )
      )}
    </section>
  )
}

function BreakdownRowDetails({ metrics, profit }: { metrics: Metrics; profit: boolean }) {
  const keys = [...moneyKeys, ...(profit ? profitMoneyKeys : [])]
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {keys
        .filter((key) => metrics[key] !== undefined)
        .map((key) => (
          <div key={key}>
            <dt>{labels[key]}</dt>
            <dd className="tabular-nums">{formatReportMoney(metrics[key]!)}</dd>
          </div>
        ))}
      <div>
        Events: {metrics.eventCount} · Orders: {metrics.orderCount} · Parties: {metrics.partyCount}
      </div>
      {profit && (
        <>
          <div>
            Estimated gross margin: {formatReportPercent(metrics.estimatedGrossMarginPercent)}
          </div>
          <div>Cost coverage: {formatReportPercent(metrics.costCoveragePercent)}</div>
        </>
      )}
      {Object.entries(metrics.quantitiesByUnit).map(([unit, quantity]) => (
        <div key={unit}>
          {formatProductUnit(unit)}: {formatStockCents(parseStockCents(quantity.quantity))} ·
          Returned damaged: {formatStockCents(parseStockCents(quantity.returnedDamagedQuantity))} ·
          Missing: {formatStockCents(parseStockCents(quantity.missingQuantity))}
        </div>
      ))}
      {profit &&
        Object.entries(metrics.uncostedQuantityByUnit ?? {}).map(([unit, quantity]) => (
          <div key={unit}>
            Uncosted {formatProductUnit(unit)}: {formatStockCents(parseStockCents(quantity))}
          </div>
        ))}
    </dl>
  )
}
