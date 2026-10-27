import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SearchableDropdown } from '@/components/ui/SearchableDropdown'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { useQuarantineLots } from '@/features/logistics/quarantine.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import type { QuarantineCondition, QuarantineLot } from '@/features/logistics/stock-items.types'
import { getErrorMessage } from '@/lib/api-client'
import { QuarantineLotDialog } from './QuarantineLotDialog'

export function QuarantinedStock() {
  const stocks = useStockItems()
  const [stockId, setStockId] = useState('ALL')
  const [condition, setCondition] = useState<QuarantineCondition | 'ALL'>('ALL')
  const [openOnly, setOpenOnly] = useState(true)
  const [selected, setSelected] = useState<QuarantineLot>()
  const query = useQuarantineLots({
    ...(stockId !== 'ALL' ? { stockItemId: Number(stockId) } : {}),
    ...(condition !== 'ALL' ? { condition } : {}),
    openOnly,
  })
  function stockLabel(id: number) {
    const stock = stocks.data?.find((candidate) => candidate.id === id)
    return stock
      ? `${stock.inventoryItem.name} — ${stock.warehouse.name}`
      : 'Stock details unavailable'
  }
  const columns: ColumnDef<QuarantineLot>[] = [
    {
      id: 'stock',
      header: 'Product / Warehouse',
      cell: ({ row }) => stockLabel(row.stockItemId),
      sortable: true,
      sortKey: (row) => stockLabel(row.stockItemId),
    },
    { id: 'condition', header: 'Current condition', accessorKey: 'condition', sortable: true },
    { id: 'reported', header: 'Originally reported', accessorKey: 'reportedCondition' },
    { id: 'source', header: 'Source', cell: ({ row }) => row.sourceKind.replaceAll('_', ' ') },
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
        <div className="flex min-w-64 flex-1 flex-col gap-2">
          <Label htmlFor="quarantine-stock-filter">Stock record</Label>
          <SearchableDropdown
            id="quarantine-stock-filter"
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
            searchPlaceholder="Search product or warehouse"
            emptyMessage="No matching stock records"
            ariaLabel="Filter quarantine by stock record"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quarantine-condition-filter">Condition</Label>
          <Select
            value={condition}
            onValueChange={(value) => setCondition(value as typeof condition)}
          >
            <SelectTrigger id="quarantine-condition-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">All conditions</SelectItem>
                <SelectItem value="DAMAGED">Damaged</SelectItem>
                <SelectItem value="SPOILED">Spoiled</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="quarantine-open-filter">Lot status</Label>
          <Select
            value={openOnly ? 'OPEN' : 'ALL'}
            onValueChange={(value) => setOpenOnly(value === 'OPEN')}
          >
            <SelectTrigger id="quarantine-open-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="OPEN">Open lots</SelectItem>
                <SelectItem value="ALL">All lots</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>
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
      {query.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {getErrorMessage(query.error)}
            <Button variant="link" onClick={() => void query.refetch()}>
              Retry quarantine list
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <DataTable
          data={query.data ?? []}
          columns={columns}
          getRowKey={(lot) => lot.id}
          isLoading={query.isLoading}
          emptyContent="No quarantine lots match these filters."
        />
      )}
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
