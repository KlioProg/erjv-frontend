import { DataTableExpandedSection } from '@/components/ui/DataTableExpandedSection'
import { Button } from '@/components/ui/button'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useWarehouseStock } from '@/features/logistics/stock-items.hooks'
import type { StockItemWithInventoryItem } from '@/features/logistics/stock-items.types'
import { formatStockCents, parseStockCents, stockSortKey } from '@/features/logistics/stock-display'
import { getErrorMessage } from '@/lib/api-client'
import { formatProductUnit } from '@/lib/product-unit'

const columns: ColumnDef<StockItemWithInventoryItem>[] = [
  {
    id: 'product',
    header: 'Product',
    width: '60%',
    sortable: true,
    sortKey: (row) => row.inventoryItem?.name ?? '',
    cell: ({ row }) => (
      <OverflowValue value={row.inventoryItem?.name} className="text-sm font-medium" />
    ),
  },
  {
    id: 'unit',
    header: 'Unit',
    width: '20%',
    cell: ({ row }) => (
      <span className="whitespace-normal [overflow-wrap:anywhere]">
        {formatProductUnit(row.inventoryItem?.unit, '—')}
      </span>
    ),
  },
  {
    id: 'quantity',
    header: 'Quantity',
    width: '20%',
    align: 'right',
    sortable: true,
    sortKey: (row) => stockSortKey(parseStockCents(row.quantity)),
    cell: ({ row }) => (
      <OverflowValue
        value={formatStockCents(parseStockCents(row.quantity))}
        className="text-right tabular-nums"
      />
    ),
  },
]

export function WarehouseProducts({
  warehouseId,
  warehouseName,
}: {
  warehouseId: number
  warehouseName: string
}) {
  const stockQuery = useWarehouseStock(warehouseId)
  return (
    <DataTableExpandedSection
      id={`warehouse-products-${warehouseId}`}
      title={`Products at ${warehouseName}`}
      isLoading={stockQuery.isLoading}
      loadingContent={<p role="status">Loading products...</p>}
      isEmpty={stockQuery.data?.length === 0}
      emptyContent={<p className="text-muted-foreground">No products in this warehouse.</p>}
      errorContent={
        stockQuery.isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
            Products could not be loaded: {getErrorMessage(stockQuery.error)}
            <Button variant="link" size="sm" onClick={() => void stockQuery.refetch()}>
              Retry
            </Button>
          </div>
        ) : undefined
      }
    >
      <DataTable
        data={stockQuery.data ?? []}
        columns={columns}
        pagination={false}
        defaultSort={{ key: 'product', direction: 'asc' }}
        appearance="subtle"
        className="rounded-none border-0 bg-transparent shadow-none"
        tableClassName="w-full table-fixed"
      />
    </DataTableExpandedSection>
  )
}
