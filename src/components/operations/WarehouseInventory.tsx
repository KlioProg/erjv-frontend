import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  MapPin,
  Package,
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
  reserved: number
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
        reserved: Number(stock.reservedQuantity ?? 0),
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

  const columns = useMemo<ColumnDef<StockRow>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        sortable: true,
        sortKey: (row) => row.stock.inventoryItem.name,
        cell: ({ row }) => (
          <span className="text-xs font-semibold">{row.stock.inventoryItem.name}</span>
        ),
      },
      {
        id: 'unit',
        header: 'Unit',
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
        align: 'right',
        sortable: true,
        sortKey: 'quantity',
        cell: ({ row }) => <span className="text-xs font-bold">{row.quantity.toLocaleString()}</span>,
      },
      {
        id: 'available',
        header: 'Available',
        align: 'right',
        sortable: true,
        sortKey: (row) => Math.max(0, row.quantity - row.reserved),
        cell: ({ row }) => (
          <span className="text-xs">
            {Math.max(0, row.quantity - row.reserved).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
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
    <div className="flex flex-col gap-4">
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 h-7 gap-1 px-2 text-xs">
            <ArrowLeft className="size-4" />
            Warehouses
          </Button>
          <ChevronRight className="size-3.5" />
          <span className="truncate font-semibold text-foreground">{warehouse.name}</span>
        </div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <WarehouseIcon className="size-5 text-primary" />
          {warehouse.name}
        </h2>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {warehouse.address}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/25 px-3 py-2 text-xs">
          <Boxes className="size-4 text-primary" />
          <span className="font-bold">{stockQuery.isLoading || stockQuery.isError ? '—' : totalUnits.toLocaleString()}</span>
          <span className="text-muted-foreground">units</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/25 px-3 py-2 text-xs">
          <Package className="size-4 text-primary" />
          <span className="font-bold">{stockQuery.isLoading || stockQuery.isError ? '—' : rows.length}</span>
          <span className="text-muted-foreground">products</span>
        </div>
        <Badge
          variant="outline"
          className={warehouse.isActive === false
            ? 'border-amber-500/30 text-amber-600'
            : 'border-emerald-500/30 text-emerald-600'}
        >
          {warehouse.isActive === false ? 'Archived · View only' : 'Active'}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Inventory in {warehouse.name}</h3>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            aria-label="Search warehouse products"
            placeholder="Search product..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>
      {stockQuery.isError ? (
        <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive">
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
          emptyContent={search
            ? 'No products match your search.'
            : 'No stock records for this warehouse yet.'}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      )}
    </div>
  )
}
