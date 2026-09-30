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
      (stockQuery.data ?? []).map((stock) => ({
        stock,
        quantityCents: parseStockCents(stock.quantity),
      })),
    [stockQuery.data],
  )
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term
      ? rows.filter(({ stock }) => String(stock.inventoryItem?.name ?? '').toLowerCase().includes(term))
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
        width: '40%',
        sortable: true,
        sortKey: (row) => row.stock.inventoryItem?.name ?? '',
        cell: ({ row }) => (
          <OverflowValue value={row.stock.inventoryItem?.name} className="text-xs font-semibold" />
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
          <OverflowValue value={row.stock.inventoryItem?.unit} className="text-xs text-muted-foreground" />
        ),
      },
      {
        id: 'quantity',
        header: <><span className="sm:hidden">Qty</span><span className="hidden sm:inline">Quantity</span></>,
        width: '20%',
        align: 'right',
        sortable: true,
        sortKey: (row) => stockSortKey(row.quantityCents),
        cell: ({ row }) => (
          <OverflowValue
            value={formatStockCents(row.quantityCents)}
            fullValue={row.quantityCents === null ? row.stock.quantity : undefined}
            tooltipSuffix="units"
            className="text-right text-xs font-bold tabular-nums"
          />
        ),
      },
      {
        id: 'status',
        header: 'Status',
        width: '20%',
        align: 'center',
        sortable: true,
        sortKey: (row) => (row.quantityCents === null ? -1 : row.quantityCents <= 0n ? 0 : row.quantityCents <= 2000n ? 1 : 2),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.quantityCents === null
                ? 'text-muted-foreground border-border'
                : row.quantityCents <= 0n
                ? 'text-rose-600 border-rose-500/30'
                : row.quantityCents <= 2000n
                  ? 'text-amber-600 border-amber-500/30'
                  : 'text-emerald-600 border-emerald-500/30'
            }
          >
            <span className="sm:hidden">
              {row.quantityCents === null ? 'N/A' : row.quantityCents <= 0n ? 'Out' : row.quantityCents <= 2000n ? 'Low' : 'In'}
            </span>
            <span className="hidden sm:inline">
              {row.quantityCents === null ? 'Unknown' : row.quantityCents <= 0n ? 'Out of Stock' : row.quantityCents <= 2000n ? 'Low Stock' : 'In Stock'}
            </span>
          </Badge>
        ),
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-5">
      <header>
        <nav aria-label="Breadcrumb" className="mb-2 flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 h-7 gap-1 px-2 text-xs">
            <ArrowLeft className="size-4" />
            Warehouses
          </Button>
          <ChevronRight className="size-3.5 shrink-0" />
          <OverflowValue value={warehouse.name} className="font-semibold text-foreground" />
        </nav>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="flex min-w-0 max-w-full items-center gap-2 text-xl font-bold">
                <WarehouseIcon className="size-5 shrink-0 text-primary" />
                <OverflowValue value={warehouse.name} className="font-bold" />
              </h2>
              <Badge
                variant="outline"
                className={warehouse.isActive === false
                  ? 'border-amber-500/30 text-amber-600'
                  : 'border-emerald-500/30 text-emerald-600'}
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
              <div key={label} className="min-w-0 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 lg:w-44">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="size-3.5 shrink-0 text-primary" />
                  <span>{label}</span>
                </div>
                <p className="mt-1 flex min-w-0 items-center text-lg font-bold tabular-nums leading-none">
                  <OverflowValue value={stockQuery.isLoading || stockQuery.isError ? '—' : value} tooltipSuffix={unit} />
                  <span className="ml-1 text-[11px] font-normal text-muted-foreground">{unit}</span>
                </p>
              </div>
            ))}
          </section>
        </div>
      </header>

      <section aria-label={`Inventory in ${warehouse.name}`} className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <h3 className="flex min-w-0 max-w-full items-center gap-1 text-sm font-bold">
            <span className="shrink-0">Inventory in</span>
            <OverflowValue value={warehouse.name} className="font-bold" />
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              aria-label="Search warehouse products"
              placeholder="Search product..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>
        </div>
        {stockQuery.isError ? (
          <div role="alert" className="p-4 text-xs text-destructive">
            Warehouse stock could not be loaded: {getErrorMessage(stockQuery.error)}
            <Button variant="link" size="sm" onClick={() => void stockQuery.refetch()}>Retry</Button>
          </div>
        ) : (
          <DataTable
            data={filteredRows}
            columns={columns}
            getRowKey={(row) => row.stock.id}
            isLoading={stockQuery.isLoading}
            loadingMessage="Loading warehouse inventory..."
            emptyContent={
              <div className="px-4 py-12 text-center text-xs text-muted-foreground">
                {search ? 'No products match your search.' : 'No stock records for this warehouse yet.'}
              </div>
            }
            pageSizeOptions={[10, 25, 50, 100]}
            className="rounded-none border-0 shadow-none"
            tableClassName="table-fixed w-full [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3.5 sm:[&_th]:px-3.5"
          />
        )}
      </section>
    </div>
  )
}
