import { DataTableFilters, DataTableFilterChips, type DataTableFilter } from '@/components/ui/data-table-filters'
import { useStockMetadata } from '@/features/logistics/use-stock-metadata'
import { useResourcePage } from '@/lib/use-cursor-page'
import { DataTableFooter, DataTableFrame } from '@/components/ui/DataTableFooter'
import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import type { QuarantineCondition, QuarantineLot } from '@/features/logistics/quarantine.types'
import { getErrorMessage } from '@/lib/api-client'
import { QuarantineLotDialog } from './QuarantineLotDialog'

const conditionLabels: Record<QuarantineCondition, string> = { DAMAGED: 'Damaged', SPOILED: 'Spoiled' }
const sourceLabels: Record<QuarantineLot['sourceKind'], string> = {
  MANUAL: 'Manual',
  INCOMING_DELIVERY: 'Incoming Delivery',
  OUTGOING_DELIVERY: 'Outgoing Delivery',
  WAREHOUSE_TRANSFER: 'Warehouse Transfer',
}

export function QuarantinedStock({ stockItemId }: { stockItemId?: number } = {}) {
  const [stockSearch, setStockSearch] = useState('')
  const stocks = useStockItems({ q: stockSearch || undefined })
  const [stockId, setStockId] = useState(stockItemId === undefined ? 'ALL' : String(stockItemId))
  const [condition, setCondition] = useState<QuarantineCondition | 'ALL'>('ALL')
  const [openOnly, setOpenOnly] = useState(true)
  const [selected, setSelected] = useState<QuarantineLot>()
  const query = useResourcePage<QuarantineLot>('/stock-items/quarantine-lots', {
    ...(stockId !== 'ALL' ? { stockItemId: Number(stockId) } : {}),
    ...(condition !== 'ALL' ? { condition } : {}),
    openOnly,
  })
  const selectedStock = useStockMetadata(stockId !== 'ALL' && !stocks.items.some(item => item.id === Number(stockId)) ? Number(stockId) : undefined)
  function stockLabel(id: number) {
    const stock = stocks.data?.find((candidate) => candidate.id === id) ?? (selectedStock.data?.id === id ? selectedStock.data : undefined)
    return stock
      ? `${stock.inventoryItem.name} — ${stock.warehouse.name}`
      : 'Stock details unavailable'
  }
  const stockFilterControl = (
    <div className="flex min-w-64 flex-1 flex-col gap-2">
      <Label htmlFor="quarantine-stock-filter">Stock record</Label>
      <SearchableDropdown
        id="quarantine-stock-filter"
        onSearchChange={setStockSearch}
        footer={
          stocks.hasNextPage ? (
            <Button
              variant="ghost"
              disabled={stocks.isFetching}
              onClick={() => void stocks.fetchNextPage()}
            >
              Load more stock records
            </Button>
          ) : undefined
        }
        selectedLabel={stockId === 'ALL' ? undefined : stockLabel(Number(stockId))}
        value={stockId}
        onValueChange={setStockId}
        options={[
          { value: 'ALL', label: 'All stock records' },
          ...(stocks.data ?? []).map((stock) => ({
            value: String(stock.id),
            label: stockLabel(stock.id),
          })),
        ]}
        getOptionValue={(option) => option.value}
        getOptionLabel={(option) => option.label}
        placeholder="All stock records"
        searchPlaceholder="Search product name"
        emptyMessage="No matching stock records"
        ariaLabel="Filter quarantine by stock record"
      />
    </div>
  )
  const tableFilters: DataTableFilter[] = [
    {
      kind: 'custom',
      id: 'stock-record',
      label: 'Stock record',
      active: stockId !== 'ALL',
      valueLabel: stockId !== 'ALL' ? stockLabel(Number(stockId)) : undefined,
      onClear: () => setStockId('ALL'),
      content: stockFilterControl,
    },
    {
      kind: 'select',
      id: 'condition',
      label: 'Condition',
      value: condition,
      onChange: (value) => setCondition(value as typeof condition),
      options: [
        { value: 'ALL', label: 'All conditions' },
        { value: 'DAMAGED', label: 'Damaged' },
        { value: 'SPOILED', label: 'Spoiled' },
      ],
    },
    {
      kind: 'select',
      id: 'lot-status',
      label: 'Lot status',
      value: openOnly ? 'OPEN' : 'ALL',
      onChange: (value) => setOpenOnly(value === 'OPEN'),
      options: [
        { value: 'ALL', label: 'All lots' },
        { value: 'OPEN', label: 'Open lots' },
      ],
    },
  ]
  const columns: ColumnDef<QuarantineLot>[] = [
    {
      id: 'stock',
      header: 'Product / Warehouse',
      cell: ({ row }) => <QuarantineStockLabel id={row.stockItemId} label={stocks.items.some(stock => stock.id === row.stockItemId) ? stockLabel(row.stockItemId) : undefined} />,
      sortable: false,
      sortKey: (row) => stockLabel(row.stockItemId),
    },
    { id: 'condition', header: 'Current condition', accessorKey: 'condition', sortable: false, cell: ({ row }) => conditionLabels[row.condition] },
    { id: 'reported', header: 'Originally reported', accessorKey: 'reportedCondition', cell: ({ row }) => conditionLabels[row.reportedCondition] },
    { id: 'source', header: 'Source', cell: ({ row }) => row.sourceKind === 'WAREHOUSE_TRANSFER'
      ? `${sourceLabels[row.sourceKind]}${row.warehouseTransferItemId ? ` · Line #${row.warehouseTransferItemId}` : ''}`
      : sourceLabels[row.sourceKind] },
    {
      id: 'remaining',
      header: 'Remaining quantity',
      accessorKey: 'remainingQuantity',
      align: 'right',
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: ({ row }) => (
        <DataTableActions onView={() => setSelected(row)} viewLabel="Review & Resolve" />
      ),
    },
  ]
  return (
    <section aria-label="Quarantined Stock" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">

        <DataTableFilters filters={tableFilters} />
      </div>
      <DataTableFilterChips filters={tableFilters} />
      {stocks.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Stock labels could not be loaded. {getErrorMessage(stocks.error)}
            <Button variant="link" onClick={() => void stocks.refetch()}>
              Retry stock labels
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <DataTableFrame>
      {query.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getErrorMessage(query.error)}
            <Button variant="link" onClick={() => void query.reload()}>
              Retry quarantine list
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable
          appearance="management"
          pagination={false}
          manualSorting
          data={query.items}
          columns={columns}
          getRowKey={(lot) => lot.id}
          isLoading={query.isFetching}
          emptyContent="No quarantine lots match these filters."
        />
      )}
      <DataTableFooter {...query} rowCount={query.items.length} label="Quarantine lot" />
      </DataTableFrame>
      {selected && (
        <QuarantineLotDialog
          key={selected.id}
          selectedLot={selected}
          stock={stocks.data?.find((stock) => stock.id === selected.stockItemId)}
          onClose={() => setSelected(undefined)}
        />
      )}
    </section>
  )
}

function QuarantineStockLabel({ id, label }: { id: number; label?: string }) {
  const query = useStockMetadata(label ? undefined : id)
  return <>{label ?? (query.data ? `${query.data.inventoryItem.name} - ${query.data.warehouse.name}` : query.isError ? `Stock #${id} unavailable` : `Loading stock #${id}...`)}</>
}
