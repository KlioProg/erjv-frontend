import { formatProductUnit } from '@/lib/product-unit'
import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  MapPin,
  Package,
  Phone,
  Search,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useWarehouseStock } from '@/features/logistics/stock-items.hooks'
import { formatStockCents, parseStockCents, stockSortKey } from '@/features/logistics/stock-display'
import type { StockItemWithInventoryItem } from '@/features/logistics/stock-items.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { getErrorMessage } from '@/lib/api-client'
import { stockConditionForItem, stockConditionRank } from '@/features/logistics/stock-warnings'
import { StockIndicator } from '@/components/inventory/StockIndicator'
import { cn } from '@/lib/utils'

type StockRow = {
  stock: StockItemWithInventoryItem
  quantityCents: bigint | null
}

export function WarehouseInventory({
  warehouse,
  onBack,
}: {
  warehouse: Warehouse
  onBack: () => void
}) {
  const stockQuery = useWarehouseStock(warehouse.id)
  const [search, setSearch] = useState('')
  const rows = useMemo<StockRow[]>(
    () =>
      (stockQuery.data ?? [])
        .map((stock) => ({ stock, quantityCents: parseStockCents(stock.quantity) }))
        .sort(
          (a, b) =>
            stockConditionRank[stockConditionForItem(a.stock)] -
              stockConditionRank[stockConditionForItem(b.stock)] ||
            (a.stock.inventoryItem?.name ?? '').localeCompare(b.stock.inventoryItem?.name ?? '') ||
            a.stock.id - b.stock.id,
        ),
    [stockQuery.data],
  )
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term
      ? rows.filter(({ stock }) =>
          String(stock.inventoryItem?.name ?? '')
            .toLowerCase()
            .includes(term),
        )
      : rows
  }, [rows, search])
  const totalStockCents = rows.some((row) => row.quantityCents === null)
    ? null
    : rows.reduce((sum, row) => sum + (row.quantityCents ?? 0n), 0n)
  const summaryMetrics = [
    { label: 'Total stock', value: formatStockCents(totalStockCents), unit: 'units', icon: Boxes },
    { label: 'Products', value: rows.length.toLocaleString(), unit: 'products', icon: Package },
  ]

  const columns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        width: '55%',
        sortable: true,
        sortKey: (row) => row.stock.inventoryItem?.name ?? '',
        cell: ({ row }) => (
          <OverflowValue value={row.stock.inventoryItem?.name} className="text-sm font-medium" />
        ),
      },
      {
        id: 'unit',
        header: 'Unit',
        width: '20%',
        className: 'hidden sm:table-cell',
        headerClassName: 'hidden sm:table-cell',
        sortable: true,
        sortKey: (row) => row.stock.inventoryItem?.unit ?? '',
        cell: ({ row }) => (
          <OverflowValue
            value={formatProductUnit(row.stock.inventoryItem?.unit)}
            className="text-sm text-muted-foreground"
          />
        ),
      },
      {
        id: 'quantity',
        header: (
          <>
            <span className="sm:hidden">Qty</span>
            <span className="hidden sm:inline">Quantity</span>
          </>
        ),
        width: '25%',
        align: 'right',
        sortable: true,
        sortKey: (row) => stockSortKey(row.quantityCents),
        cell: ({ row }) => {
          const condition = stockConditionForItem(row.stock)
          const warning =
            condition === 'OUT' ? 'Out of stock' : condition === 'LOW' ? 'Low stock' : null
          return (
            <div
              className={cn(
                'flex min-w-0 flex-col items-end gap-0.5',
                condition === 'OUT' && 'text-destructive',
                condition === 'LOW' && 'text-status-warning-foreground',
              )}
            >
              <div className="flex max-w-full items-center justify-end gap-1.5">
                <StockIndicator
                  condition={condition}
                  label={`${warning}: ${row.stock.inventoryItem?.name ?? 'Product'} in ${warehouse.name}`}
                />
                <OverflowValue
                  value={formatStockCents(row.quantityCents)}
                  fullValue={row.quantityCents === null ? row.stock.quantity : undefined}
                  tooltipSuffix={formatProductUnit(row.stock.inventoryItem?.unit, 'units')}
                  className="text-right text-sm font-normal tabular-nums"
                />
              </div>
              {warning && <span className="text-xs font-medium">{warning}</span>}
              {condition === 'NORMAL' && row.stock.reorderThreshold == null && (
                <span className="text-xs text-muted-foreground">Threshold not set</span>
              )}
            </div>
          )
        },
      },
    ],
    [warehouse.name],
  )

  return (
    <div className="flex flex-col gap-6">
      <header>
        <nav
          aria-label="Breadcrumb"
          className="mb-2 flex min-w-0 items-center gap-1 text-xs text-muted-foreground"
        >
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            className="h-11 min-h-11 gap-2 border border-border px-3 text-sm font-medium"
          >
            <ArrowLeft className="size-4" />
            Back to Warehouses
          </Button>
          <ChevronRight className="size-3.5 shrink-0" />
          <OverflowValue value={warehouse.name} className="font-semibold text-foreground" />
        </nav>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 className="flex min-w-0 max-w-full items-center gap-2 text-2xl font-semibold">
                <WarehouseIcon className="size-5 shrink-0 text-muted-foreground" />
                <OverflowValue value={warehouse.name} className="font-semibold" />
              </h1>
              <Badge
                variant="outline"
                className={
                  warehouse.isActive === false
                    ? 'border-status-warning-foreground/30 text-status-warning-foreground'
                    : 'border-status-success-foreground/30 text-status-success-foreground'
                }
              >
                {warehouse.isActive === false ? 'Archived · View only' : 'Active'}
              </Badge>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="flex min-w-0 max-w-full items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                <OverflowValue value={warehouse.address} />
              </span>
              {warehouse.contactNumber && (
                <span className="flex min-w-0 max-w-full items-center gap-1.5">
                  <Phone className="size-3.5 shrink-0" />
                  <OverflowValue value={warehouse.contactNumber} />
                </span>
              )}
            </div>
          </div>
          <section aria-label="Warehouse stock summary" className="grid grid-cols-2 gap-3">
            {summaryMetrics.map(({ label, value, unit, icon: Icon }) => (
              <div
                key={label}
                className="min-w-0 rounded-lg border border-border bg-card px-4 py-3 lg:w-44"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                  <span>{label}</span>
                </div>
                <p className="mt-1 flex min-w-0 items-center text-2xl font-semibold tabular-nums leading-none">
                  <OverflowValue
                    value={stockQuery.isLoading || stockQuery.isError ? '—' : value}
                    tooltipSuffix={unit}
                  />
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>
                </p>
              </div>
            ))}
          </section>
        </div>
      </header>

      <section
        aria-label={`Inventory in ${warehouse.name}`}
        className="overflow-hidden rounded-lg border border-border bg-card"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h3 className="flex min-w-0 max-w-full items-center gap-1 text-base font-semibold">
            <span className="shrink-0">Inventory in</span>
            <OverflowValue value={warehouse.name} className="font-semibold" />
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              aria-label="Search warehouse products"
              placeholder="Search product..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 pl-9 text-[13px]"
            />
          </div>
        </div>
        {stockQuery.isError ? (
          <div role="alert" className="p-4 text-xs text-destructive">
            Warehouse stock could not be loaded: {getErrorMessage(stockQuery.error)}
            <Button variant="link" size="sm" onClick={() => void stockQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : (
          <DataTable
            data={filteredRows}
            columns={columns}
            getRowKey={(row) => row.stock.id}
            rowClassName={(row) => {
              const condition = stockConditionForItem(row.stock)
              return condition === 'OUT'
                ? 'bg-destructive/5 hover:bg-destructive/10'
                : condition === 'LOW'
                  ? 'bg-status-warning/50 hover:bg-status-warning'
                  : ''
            }}
            isLoading={stockQuery.isLoading}
            loadingMessage="Loading warehouse inventory..."
            emptyContent={
              <div className="px-4 py-12 text-center text-xs text-muted-foreground">
                {search
                  ? 'No products match your search.'
                  : 'No stock records for this warehouse yet.'}
              </div>
            }
            pageSizeOptions={[10, 25, 50, 100]}
            className="rounded-none border-0 shadow-none"
            tableClassName="table-fixed w-full"
          />
        )}
      </section>
    </div>
  )
}
