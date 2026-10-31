import { CursorPageControls } from '@/components/ui/CursorPageControls'
import { useResourcePage } from '@/lib/use-cursor-page'
import { DataTableExpandedSection } from '@/components/ui/DataTableExpandedSection'
import { Button } from '@/components/ui/button'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import type { StockItemWithInventoryItem } from '@/features/logistics/stock-items.types'
import { formatStockCents, parseStockCents, stockSortKey } from '@/features/logistics/stock-display'
import { getErrorMessage } from '@/lib/api-client'
import { formatProductUnit } from '@/lib/product-unit'
import { StockIndicator } from '@/components/inventory/StockIndicator'
import { stockConditionForItem } from '@/features/logistics/stock-warnings'

const columns: ColumnDef<StockItemWithInventoryItem>[] = [
  {
    id: 'product',
    header: 'Product',
    width: '28%',
    sortable: false,
    sortKey: (row) => row.inventoryItem?.name ?? '',
    cell: ({ row }) => (
      <OverflowValue value={row.inventoryItem?.name} className="text-sm font-medium" />
    ),
  },
  {
    id: 'unit',
    header: 'Unit',
    width: 72,
    cell: ({ row }) => (
      <span className="whitespace-normal [overflow-wrap:anywhere]">
        {formatProductUnit(row.inventoryItem?.unit, '—')}
      </span>
    ),
  },
  {
    id: 'quantity',
    header: 'Physical',
    width: 96,
    align: 'right',
    sortable: false,
    sortKey: (row) => stockSortKey(parseStockCents(row.onHandQuantity)),
    cell: ({ row }) => (
      <OverflowValue
        value={formatStockCents(parseStockCents(row.onHandQuantity))}
        className="text-right tabular-nums"
      />
    ),
  },
  ...(
    [
      ['inTransitQuantity', 'In transit'],
      ['quarantinedQuantity', 'Quarantined'],
      ['availableQuantity', 'Available'],
    ] as const
  ).map(([field, label]): ColumnDef<StockItemWithInventoryItem> => ({
    id: field,
    header: label,
    width: 96,
    align: 'right',
    sortable: false,
    sortKey: (row) => stockSortKey(parseStockCents(row[field])),
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center justify-end gap-1.5">
        {field === 'availableQuantity' && (
          <StockIndicator
            condition={stockConditionForItem(row)}
            label={`${stockConditionForItem(row) === 'LOW' ? 'Low stock' : 'Out of stock'}: ${row.inventoryItem?.name ?? 'Product'}`}
          />
        )}
        <OverflowValue
          value={formatStockCents(parseStockCents(row[field]))}
          className="text-right tabular-nums"
        />
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
  const stockQuery = useResourcePage<StockItemWithInventoryItem>(`/stock-items/warehouses/${warehouseId}`)
  return (
    <>
    <DataTableExpandedSection
      id={`warehouse-products-${warehouseId}`}
      title={<OverflowValue value={`Products at ${warehouseName}`} />}
      ariaLabel={`Products at ${warehouseName}`}
      isLoading={stockQuery.isLoading}
      loadingContent={<p role="status">Loading products...</p>}
      isEmpty={stockQuery.items?.length === 0}
      emptyContent={<p className="text-muted-foreground">No products in this warehouse.</p>}
      errorContent={
        stockQuery.isError ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-destructive">
            Products could not be loaded: {getErrorMessage(stockQuery.error)}
            <Button variant="link" size="sm" onClick={() => void stockQuery.reload()}>
              Retry
            </Button>
          </div>
        ) : undefined
      }
    >
      <DataTable
        data={stockQuery.items ?? []}
        columns={columns}
        pagination={false}
        manualSorting
        appearance="subtle"
        className="rounded-none border-0 bg-transparent shadow-none"
        tableClassName="min-w-[760px] w-full table-fixed"
      />
    </DataTableExpandedSection>
    <CursorPageControls {...stockQuery} label="Stock record" />
    </>
  )
}
