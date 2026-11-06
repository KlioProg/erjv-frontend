import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable } from '@/components/ui/data-table'
import { DataTableFooter } from '@/components/ui/DataTableFooter'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useTransferCatalog } from '@/features/warehouse-transfers/use-transfer-catalog'
import { formatStockCents } from '@/features/logistics/stock-display'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { formatProductUnit } from '@/lib/product-unit'
import { decimalLimitError } from '@/lib/decimal-limits'
import { decimalString, parseOrderDecimal } from '@/lib/order-amounts'

export function TransferProductCatalog({
  source,
  selected,
  busy,
  onAdd,
}: {
  source: string
  selected: Record<number, string>
  busy: boolean
  onAdd: (product: InventoryItemResponse, quantity: string, available: bigint) => void
}) {
  const [search, setSearch] = useState('')
  const catalog = useTransferCatalog(source, search)
  return (
    <section
      aria-label="Available Products"
      className="flex min-h-0 min-w-0 flex-col gap-3 lg:overflow-y-auto lg:border-l lg:pl-5"
    >
      <h2 className="text-base font-semibold">Available Products</h2>
      {!source ? (
        <div className="py-8 text-center">
          <h3 className="font-medium">Choose a Source Warehouse</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Select where the goods will come from to see available products.
          </p>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              aria-label="Search available products"
              placeholder="Search product names..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Available stock at the source warehouse. Products are shown by page.
          </p>
          {catalog.isError ? (
            <div role="alert" className="text-sm text-destructive">
              Could not load warehouse stock or verify product eligibility.
              <Button
                type="button"
                variant="link"
                disabled={catalog.stock.isFetching}
                onClick={() => {
                  void catalog.stock.reload()
                  void catalog.products.refetch()
                }}
              >
                Retry
              </Button>
            </div>
          ) : (
            <DataTable
              data={catalog.rows}
              getRowKey={(row) => row.stock.id}
              pagination={false}
              appearance="management"
              isLoading={catalog.isLoading}
              loadingMessage="Loading warehouse products..."
              emptyContent={
                <div className="p-4 text-center text-sm">
                  <p className="font-medium">
                    {catalog.stock.hasNext || catalog.stock.hasPrevious
                      ? 'No available products on this page'
                      : search
                        ? 'No matching products'
                        : 'No Available Products'}
                  </p>
                  <p className="mt-2 text-muted-foreground">
                    {catalog.stock.hasNext || catalog.stock.hasPrevious
                      ? 'Try another page to continue browsing this warehouse.'
                      : search
                        ? 'Try a different product name.'
                        : 'No transferable products are currently available at this warehouse.'}
                  </p>
                </div>
              }
              columns={[
                {
                  id: 'add',
                  header: 'Add',
                  width: 52,
                  align: 'center',
                  cell: ({ row }) => {
                    const quantity = selected[row.product.id]
                    const current = quantity === undefined ? null : parseOrderDecimal(quantity)
                    const candidate =
                      row.available === null
                        ? null
                        : quantity === undefined
                          ? row.available < 100n
                            ? row.available
                            : 100n
                          : current === null
                            ? null
                            : current + 100n
                    const nextQuantity =
                      candidate === null
                        ? null
                        : quantity === undefined
                          ? formatStockCents(candidate)
                          : decimalString(candidate)
                    const quantityError =
                      quantity === undefined ? undefined : decimalLimitError(quantity, true)
                    const candidateError =
                      nextQuantity === null ? undefined : decimalLimitError(nextQuantity, true)
                    const verifyingAvailability = catalog.stock.isFetching
                    const addDisabled =
                      busy ||
                      verifyingAvailability ||
                      row.available === null ||
                      row.available === 0n ||
                      candidate === null ||
                      candidate > row.available ||
                      Boolean(quantityError || candidateError) ||
                      (quantity === undefined && Object.keys(selected).length >= 100)
                    const disabledReason = busy
                      ? 'Transfer is saving.'
                      : verifyingAvailability
                        ? 'Verifying availability.'
                      : row.available === null
                        ? 'Availability could not be verified.'
                        : row.available === 0n
                          ? 'No stock available.'
                          : quantityError
                            ? 'Enter a valid quantity first.'
                            : candidate !== null && candidate > row.available
                              ? 'Maximum available quantity selected.'
                              : candidateError
                                ? 'Maximum quantity selected.'
                                : 'Maximum number of products selected.'
                    const addButton = (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 text-primary pointer-coarse:size-11"
                        aria-label={`Add ${row.product.name}`}
                        disabled={addDisabled}
                        onClick={() => {
                          if (nextQuantity !== null && row.available !== null)
                            onAdd(row.product, nextQuantity, row.available)
                        }}
                      >
                        <Plus aria-hidden="true" className="size-4" />
                      </Button>
                    )
                    return addDisabled ? (
                      <OverflowValue
                        asChild
                        value="+"
                        fullValue={disabledReason}
                        showFullValueOnHover
                      >
                        <span
                          role="group"
                          tabIndex={0}
                          aria-label={disabledReason}
                          className="inline-flex"
                        >
                          {addButton}
                        </span>
                      </OverflowValue>
                    ) : (
                      <OverflowValue
                        asChild
                        value="+"
                        fullValue={`Add or increment ${row.product.name}`}
                        showFullValueOnHover
                      >
                        {addButton}
                      </OverflowValue>
                    )
                  },
                },
                {
                  id: 'product',
                  header: 'Product',
                  cell: ({ row }) => (
                    <div className="min-w-0">
                      <OverflowValue value={row.product.name} className="max-w-48 font-medium" />
                      {row.product.variety && (
                        <OverflowValue
                          value={row.product.variety}
                          className="max-w-48 text-xs text-muted-foreground"
                        />
                      )}
                    </div>
                  ),
                },
                {
                  id: 'available',
                  header: 'Available',
                  align: 'right',
                  cell: ({ row }) => (
                    <span className="whitespace-nowrap tabular-nums">
                      {formatStockCents(row.available)} {formatProductUnit(row.product.unit)}
                    </span>
                  ),
                },
              ]}
            />
          )}
          <DataTableFooter {...catalog.stock} label="Warehouse product" />
        </>
      )}
    </section>
  )
}

export function TransferAvailability({
  available,
  isError,
  onRetry,
  unit,
}: {
  available: bigint | null
  isError: boolean
  onRetry: () => void
  unit?: string | null
}) {
  return (
    <div className="flex items-center justify-end gap-2 text-sm">
      <span className="whitespace-nowrap tabular-nums">
        {formatStockCents(available)} {formatProductUnit(unit)}
      </span>
      {isError && (
        <Button type="button" variant="link" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  )
}
