import { formatProductUnit } from '@/lib/product-unit'
import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { DataTableActions } from '@/components/ui/DataTableActions'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import {
  buildCatalogStockMap,
  filterCatalogProducts,
} from '@/features/products/products.catalog.utils'
import { formatStockCents, stockSortKey } from '@/features/logistics/stock-display'
import { ProductPickerOption } from './OrderEntryFields'

export type OrderCatalogState = {
  productsLoading?: boolean
  stockLoading?: boolean
  productsError?: string
  stockError?: string
  onRetry?: () => void
}

export function OrderProductCatalog({
  products,
  stockItems,
  onAdd,
  sales = false,
  busy,
  state = {},
}: {
  products: InventoryItemResponse[]
  stockItems: StockItem[]
  onAdd: (product: InventoryItemResponse) => void
  sales?: boolean
  busy: boolean
  state?: OrderCatalogState
}) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const stockMap = useMemo(() => buildCatalogStockMap(stockItems), [stockItems])
  const filtered = useMemo(
    () =>
      filterCatalogProducts(
        products.filter((product) => product.isActive),
        search,
      ),
    [products, search],
  )
  const isAddDisabled = (product: InventoryItemResponse) => {
    const available =
      stockMap.get(product.id)?.availableCents ?? (stockMap.has(product.id) ? null : 0n)
    return (
      busy ||
      (sales &&
        (!!state.stockLoading || !!state.stockError || available === null || available <= 0n))
    )
  }
  const addProduct = (product: InventoryItemResponse) => {
    if (!isAddDisabled(product)) onAdd(product)
  }
  const columns: ColumnDef<InventoryItemResponse>[] = [
    {
      id: 'add',
      header: 'Add',
      width: 60,
      align: 'center',
      className: 'px-2',
      headerClassName: 'px-2',
      cell: ({ row }) => (
        <DataTableActions>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 text-primary hover:bg-primary-selected pointer-coarse:size-11"
            aria-label={`Add ${row.name}`}
            title={
              busy
                ? 'Order is read-only'
                : isAddDisabled(row)
                  ? `No available stock for ${row.name}`
                  : `Add ${row.name}`
            }
            disabled={isAddDisabled(row)}
            onClick={() => addProduct(row)}
          >
            <Plus aria-hidden="true" className="size-4" />
          </Button>
        </DataTableActions>
      ),
    },
    {
      id: 'product',
      header: 'Product',
      sortable: true,
      sortKey: 'name',
      cell: ({ row }) => (
        <ProductPickerOption name={row.name} variety={row.variety} description={row.description} />
      ),
    },
    {
      id: 'stock',
      header: sales ? 'Available Stock' : 'Total Stock',
      width: sales ? 140 : 118,
      align: 'right',
      sortable: true,
      sortKey: (product) => {
        const stock = stockMap.get(product.id)
        return stockSortKey(stock ? (sales ? stock.availableCents : stock.totalCents) : 0n)
      },
      cell: ({ row }) => {
        const stock = stockMap.get(row.id)
        const unknown = state.stockLoading || !!state.stockError
        return (
          <div className="flex flex-col gap-0.5 text-right text-sm tabular-nums">
            <span>
              {unknown
                ? '—'
                : `${formatStockCents(stock ? (sales ? stock.availableCents : stock.totalCents) : 0n)}${row.unit ? ` ${formatProductUnit(row.unit)}` : ''}`}
            </span>
            {sales && (
              <span className="text-xs text-muted-foreground">
                {unknown
                  ? 'Stock unavailable'
                  : `${formatStockCents(stock ? stock.totalCents : 0n)}${row.unit ? ` ${formatProductUnit(row.unit)}` : ''} on hand`}
              </span>
            )}
          </div>
        )
      },
    },
  ]
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Products</h2>
          <span className="text-xs text-muted-foreground">{filtered.length} products</span>
        </div>
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Search inventory products"
            placeholder="Search products, variety, description…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
            className="h-9 pl-9 text-ui"
          />
        </div>
        {(state.productsError || state.stockError) && (
          <div role="alert" className="text-xs text-destructive">
            {state.productsError
              ? `Products could not be loaded: ${state.productsError}`
              : `Stock could not be loaded: ${state.stockError}`}
            {state.onRetry && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="text-primary-contrast"
                onClick={state.onRetry}
              >
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
        {!state.productsError && (
          <DataTable
            data={filtered}
            columns={columns}
            getRowKey={(product) => product.id}
            onRowClick={addProduct}
            rowClassName={(product) =>
              isAddDisabled(product) ? 'cursor-default hover:bg-transparent' : 'hover:bg-accent'
            }
            isLoading={state.productsLoading}
            loadingMessage="Loading products…"
            page={page}
            onPageChange={setPage}
            pageSizeOptions={[10, 25, 50, 100]}
            className="order-composer-catalog-table h-auto shadow-none"
            tableClassName="table-fixed [&_th]:h-11 [&_td]:py-2 [&_td]:text-sm"
            emptyContent={
              <p className="px-3 py-6 text-center text-ui text-muted-foreground">
                {search ? 'No products match your search.' : 'No active products available.'}
              </p>
            }
          />
        )}
      </div>
    </div>
  )
}
