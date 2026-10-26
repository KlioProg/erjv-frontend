import { DataTableExpandedSection } from '@/components/ui/DataTableExpandedSection'
import { Button } from '@/components/ui/button'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useWarehouseStock } from '@/features/logistics/stock-items.hooks'
import type { StockItemWithInventoryItem } from '@/features/logistics/stock-items.types'
import { formatStockCents, parseStockCents, stockSortKey } from '@/features/logistics/stock-display'
import { getErrorMessage } from '@/lib/api-client'
import { formatProductUnit } from '@/lib/product-unit'
import { StockStatusBadge } from '@/components/inventory/StockBalanceSummary'

const columns: ColumnDef<StockItemWithInventoryItem>[] = [
  {
    id: 'product',
    header: 'Product',
    width: '30%',
    sortable: true,
    sortKey: (row) => row.inventoryItem?.name ?? '',
    cell: ({ row }) => (
      <OverflowValue value={row.inventoryItem?.name} className="text-sm font-medium" />
    ),
  },
  {
    id: 'unit',
    header: 'Unit',
    width: '10%',
    cell: ({ row }) => (
      <span className="whitespace-normal [overflow-wrap:anywhere]">
        {formatProductUnit(row.inventoryItem?.unit, '—')}
      </span>
    ),
  },
  {
    id: 'quantity',
    header: 'Physical',
    width: '15%',
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
  ...(
    [
      ['reservedQuantity', 'Reserved'],
      ['damagedQuantity', 'Damaged'],
      ['availableQuantity', 'Available'],
    ] as const
  ).map(([field, label]): ColumnDef<StockItemWithInventoryItem> => ({
    id: field,
    header: label,
    width: '15%',
    align: 'right',
    sortable: true,
    sortKey: (row) => stockSortKey(parseStockCents(row[field])),
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col items-end gap-1">
        <OverflowValue
          value={formatStockCents(parseStockCents(row[field]))}
          className="text-right tabular-nums"
        />
        {field === 'availableQuantity' && <StockStatusBadge stock={row} />}
      </div>
    ),
  })),
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
        tableClassName="min-w-[640px] w-full table-fixed"
      />
    </DataTableExpandedSection>
  )
}
