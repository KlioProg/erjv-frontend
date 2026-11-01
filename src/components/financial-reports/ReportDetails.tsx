import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { CursorLookup } from '@/components/ui/CursorLookup'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
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
    ? 'No breakdown'
    : group === 'client'
      ? 'Customer'
      : group[0].toUpperCase() + group.slice(1)

export function ReportDetails({
  kind,
  metrics,
  filters,
  view,
}: {
  kind: ReportKind
  metrics: Metrics
  filters: ReportFilterState
  view: 'trends' | 'overview'
}) {
  const [groupBy, setGroupBy] = useState<ReportGroup>('none')
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
      <h2 className="text-lg font-semibold">
        {kind === 'gross-profit-estimate'
          ? 'Estimated gross profit'
          : kind === 'sales'
            ? 'Sales'
            : 'Purchases'}{' '}
        details
      </h2>
      <p className="text-sm text-muted-foreground">
        Full-period totals from the applied report. Breakdown filters below are independent.
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          Break down by
          <Select
            value={groupBy}
            onValueChange={(value) => {
              setGroupBy(value as ReportGroup)
              setPartyId('')
            }}
          >
            <SelectTrigger aria-label="Break down by">
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
          key={`${view}:${kind}:${groupBy}:${partyId}`}
          kind={kind}
          scope={scope}
          groupBy={groupBy}
        />
      )}
    </div>
  )
}

function ReportBreakdown({
  kind,
  scope,
  groupBy,
}: {
  kind: ReportKind
  scope: ReportQuery
  groupBy: ReportGroup
}) {
  const query = useFinancialReport(kind, scope)
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  if (query.isError) {
    const error = getApiError(query.error)
    const source = (error as (Record<string, unknown> & { status?: number }) | undefined)
      ?.source as { type?: string; id?: string } | undefined
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {getErrorMessage(query.error)} {source && `Source: ${source.type} #${source.id}.`}{' '}
          <Button variant="outline" onClick={query.restart}>
            Restart breakdown
          </Button>
        </AlertDescription>
      </Alert>
    )
  }
  if (!query.data) return <p role="status">Loading narrowed breakdown…</p>
  const result = query.data as ReportResult
  const profit = kind === 'gross-profit-estimate'
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  const columns: ColumnDef<ReportRow>[] = [
    {
      id: 'group',
      header: groupLabel(groupBy),
      accessorFn: (row) => row.name ?? row.key,
      sortable: false,
    },
    ...(profit
      ? ['costedTaxableSalesValue', 'estimatedAcquisitionCost', 'estimatedGrossProfitAmount']
      : ['taxableAmount', 'taxAmount', 'totalAmount']
    ).map((key) => ({
      id: key,
      header: labels[key as keyof Metrics] ?? key,
      align: 'right' as const,
      sortable: false,
      cell: ({ row }: { row: ReportRow }) =>
        formatReportMoney(String(row[key as keyof Metrics] ?? '0.00')),
    })),
    ...(profit
      ? [
          {
            id: 'margin',
            header: 'Estimated margin',
            align: 'right' as const,
            sortable: false,
            cell: ({ row }: { row: ReportRow }) =>
              formatReportPercent(row.estimatedGrossMarginPercent),
          },
          {
            id: 'coverage',
            header: 'Cost coverage',
            align: 'right' as const,
            sortable: false,
            cell: ({ row }: { row: ReportRow }) => formatReportPercent(row.costCoveragePercent),
          },
        ]
      : [
          {
            id: 'orders',
            header: 'Orders',
            accessorKey: 'orderCount' as const,
            align: 'right' as const,
            sortable: false,
          },
        ]),
    {
      id: 'details',
      header: 'Details',
      cell: ({ row }) => (
        <DataTableExpandToggle
          expanded={expanded.has(row.key)}
          controls={`report-breakdown-${row.key}`}
          ariaLabel={`Details for ${row.name ?? row.key}`}
          onToggle={() => toggle(row.key)}
        >
          Details
        </DataTableExpandToggle>
      ),
    },
  ]
  return (
    <section className="space-y-2" aria-label="Narrowed report breakdown">
      <p className="text-sm font-medium">
        {groupLabel(groupBy)} breakdown · these totals reflect the breakdown filters only
      </p>
      <p className="text-sm">
        Narrowed total:{' '}
        {formatReportMoney(
          String(
            profit
              ? (result.totals.estimatedGrossProfitAmount ?? '0.00')
              : result.totals.totalAmount,
          ),
        )}
      </p>
      <DataTable
        appearance="management"
        data={result.rows}
        columns={columns}
        getRowKey={(row) => row.key}
        pagination={!breakdown(groupBy)}
        manualSorting
        tableClassName="min-w-[600px]"
        emptyContent={<p>No rows for this breakdown.</p>}
        renderExpandedRow={(row) =>
          expanded.has(row.key) ? (
            <DataTableExpandedSection
              id={`report-breakdown-${row.key}`}
              title={`Details: ${row.name ?? row.key}`}
            >
              <BreakdownRowDetails metrics={row} profit={profit} />
            </DataTableExpandedSection>
          ) : null
        }
      />
      {breakdown(groupBy) && <CursorPageControls {...query} label="Breakdown row" />}
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
