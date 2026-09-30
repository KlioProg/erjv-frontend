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
import { useWarehouseStock } from '@/features/logistics/stock-items.hooks'
import type { StockItemWithInventoryItem } from '@/features/logistics/stock-items.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { getErrorMessage } from '@/lib/api-client'

type StockRow = {
  stock: StockItemWithInventoryItem
  quantity: number
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
        quantity: Number(stock.quantity),
      })),
    [stockQuery.data],
  )
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term
      ? rows.filter(({ stock }) => stock.inventoryItem.name.toLowerCase().includes(term))
      : rows
  }, [rows, search])
  const totalUnits = rows.reduce((sum, row) => sum + row.quantity, 0)
  const summaryMetrics = [
    { label: 'Total stock', value: totalUnits, unit: 'units', icon: Boxes },
    { label: 'Products', value: rows.length, unit: 'products', icon: Package },
  ]

  const columns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        width: '40%',
        sortable: true,
        sortKey: (row) => row.stock.inventoryItem.name,
        cell: ({ row }) => (
          <span className="text-xs font-semibold">{row.stock.inventoryItem.name}</span>
        ),
      },
      {
        id: 'unit',
        header: 'Unit',
        width: '20%',
        sortable: true,
        sortKey: (row) => row.stock.inventoryItem.unit ?? '',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.stock.inventoryItem.unit ?? '—'}
          </span>
        ),
      },
      {
        id: 'quantity',
        header: 'Quantity',
        width: '20%',
        align: 'right',
        sortable: true,
        sortKey: 'quantity',
        cell: ({ row }) => <span className="text-xs font-bold tabular-nums">{row.quantity.toLocaleString()}</span>,
      },
      {
        id: 'status',
        header: 'Status',
        width: '20%',
        align: 'center',
        sortable: true,
        sortKey: (row) => (row.quantity <= 0 ? 0 : row.quantity <= 20 ? 1 : 2),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.quantity <= 0
                ? 'text-rose-600 border-rose-500/30'
                : row.quantity <= 20
                  ? 'text-amber-600 border-amber-500/30'
                  : 'text-emerald-600 border-emerald-500/30'
            }
          >
            {row.quantity <= 0 ? 'Out of Stock' : row.quantity <= 20 ? 'Low Stock' : 'In Stock'}
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
          <span className="truncate font-semibold text-foreground">{warehouse.name}</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h2 className="flex min-w-0 items-center gap-2 text-xl font-bold">
            <WarehouseIcon className="size-5 shrink-0 text-primary" />
            {warehouse.name}
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
          <span className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0" />
            {warehouse.address}
          </span>
          {warehouse.contactNumber && (
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5 shrink-0" />
              {warehouse.contactNumber}
            </span>
          )}
        </div>
      </header>

      <section aria-label="Warehouse stock summary" className="grid grid-cols-2 gap-3 sm:flex">
        {summaryMetrics.map(({ label, value, unit, icon: Icon }) => (
          <div key={label} className="min-w-0 rounded-xl border border-border/80 bg-muted/20 px-4 py-3 sm:w-48">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="size-3.5 shrink-0 text-primary" />
              <span>{label}</span>
            </div>
            <p className="mt-1 text-lg font-bold tabular-nums leading-none">
              {stockQuery.isLoading || stockQuery.isError ? '—' : value.toLocaleString()}
              <span className="ml-1 text-[11px] font-normal text-muted-foreground">{unit}</span>
            </p>
          </div>
        ))}
      </section>

      <section aria-label={`Inventory in ${warehouse.name}`} className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
          <h3 className="text-sm font-bold">Inventory in {warehouse.name}</h3>
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
          />
        )}
      </section>
    </div>
  )
}
