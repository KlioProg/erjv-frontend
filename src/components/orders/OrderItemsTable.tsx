import { Minus, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import type { StockItem } from '@/features/logistics/stock-items.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { OrderLine } from './OrderModal'

type OrderItemsTableProps = {
  lines: OrderLine[]
  stockItems: StockItem[]
  warehouseMap: Map<number, Warehouse>
  quantityDrafts: Record<number, string>
  getAvailableStock: (stock?: StockItem | null) => number
  formatCurrency: (value: number) => string
  onQuantityChange: (productId: number, change: number) => void
  onQuantityInput: (productId: number, value: string) => void
  onQuantityCommit: (productId: number) => void
  onWarehouseChange: (productId: number, stockItemId: number) => void
  onRemove: (productId: number) => void
  disabled?: boolean
}

function OrderQuantityControl({
  line,
  maxAvailable,
  draft,
  disabled,
  onQuantityChange,
  onQuantityInput,
  onQuantityCommit,
}: {
  line: OrderLine
  maxAvailable: number
  draft?: string
} & Pick<
  OrderItemsTableProps,
  'disabled' | 'onQuantityChange' | 'onQuantityInput' | 'onQuantityCommit'
>) {
  const isMaxReached = line.quantity >= maxAvailable
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="inline-flex max-w-full items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Decrease ${line.name} quantity`}
          disabled={disabled || line.quantity <= 1}
          onClick={() => onQuantityChange(line.productId, -1)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <Input
          type="number"
          inputMode="numeric"
          min={1}
          max={maxAvailable}
          disabled={disabled}
          value={draft ?? line.quantity}
          onChange={(event) => onQuantityInput(line.productId, event.target.value)}
          onBlur={() => onQuantityCommit(line.productId)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          aria-label={`Quantity for ${line.name}`}
          className="h-10 w-12 px-1 text-center text-base tabular-nums sm:text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Increase ${line.name} quantity`}
          disabled={disabled || isMaxReached || maxAvailable <= 0}
          title={
            isMaxReached
              ? `All available stock (${maxAvailable} ${line.unit || 'units'}) taken`
              : 'Increase quantity'
          }
          onClick={() => onQuantityChange(line.productId, 1)}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
      <span className="text-xs text-muted-foreground">
        {isMaxReached ? 'At stock limit' : `Max ${maxAvailable}`} {line.unit || 'units'}
      </span>
    </div>
  )
}

/** Editable order lines use the same table as the rest of the sales domain. */
export function OrderItemsTable({
  lines,
  stockItems,
  warehouseMap,
  quantityDrafts,
  getAvailableStock,
  formatCurrency,
  onQuantityChange,
  onQuantityInput,
  onQuantityCommit,
  onWarehouseChange,
  onRemove,
  disabled = false,
}: OrderItemsTableProps) {
  const columns: ColumnDef<OrderLine>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: ({ row: line }) => {
        const maxAvailable = getAvailableStock(
          stockItems.find((stock) => stock.id === line.stockItemId),
        )
        const availableWarehouses = stockItems
          .filter(
            (stock) => stock.inventoryItemId === line.productId && getAvailableStock(stock) > 0,
          )
          .map((stock) => ({
            stock,
            avail: getAvailableStock(stock),
            warehouse: warehouseMap.get(stock.warehouseId),
          }))
        return (
          <div className="flex min-w-0 flex-col gap-1.5">
            <OverflowValue value={line.name} className="font-semibold" />
            {line.variety && (
              <OverflowValue value={line.variety} className="text-muted-foreground" />
            )}
            {availableWarehouses.length > 1 ? (
              <select
                aria-label={`Warehouse for ${line.name}`}
                value={line.stockItemId}
                disabled={disabled}
                onChange={(event) => onWarehouseChange(line.productId, Number(event.target.value))}
                className="h-9 w-full min-w-0 max-w-full rounded-md border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {availableWarehouses.map(({ stock, avail, warehouse }) => (
                  <option key={stock.id} value={stock.id}>
                    {warehouse?.name || `Warehouse #${stock.warehouseId}`} ({avail}{' '}
                    {line.unit || 'units'} available)
                  </option>
                ))}
              </select>
            ) : (
              <OverflowValue
                value={
                  line.warehouseId
                    ? warehouseMap.get(line.warehouseId)?.name || `Warehouse #${line.warehouseId}`
                    : 'No warehouse stock record'
                }
                tooltipSuffix={`${maxAvailable} ${line.unit || 'units'} available`}
                className="text-muted-foreground"
              />
            )}
            <span className="text-muted-foreground md:hidden">
              {formatCurrency(line.unitPrice)} per unit
            </span>
            <span className="font-semibold sm:hidden">
              {formatCurrency(line.unitPrice * line.quantity)}
            </span>
            <div className="mt-1 flex flex-wrap items-center gap-3 sm:hidden">
              <span className="text-muted-foreground">Quantity</span>
              <OrderQuantityControl
                line={line}
                maxAvailable={maxAvailable}
                draft={quantityDrafts[line.productId]}
                disabled={disabled}
                onQuantityChange={onQuantityChange}
                onQuantityInput={onQuantityInput}
                onQuantityCommit={onQuantityCommit}
              />
            </div>
          </div>
        )
      },
    },
    {
      id: 'quantity',
      header: 'Quantity',
      align: 'center',
      width: 136,
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      cell: ({ row: line }) => (
        <OrderQuantityControl
          line={line}
          maxAvailable={getAvailableStock(
            stockItems.find((stock) => stock.id === line.stockItemId),
          )}
          draft={quantityDrafts[line.productId]}
          disabled={disabled}
          onQuantityChange={onQuantityChange}
          onQuantityInput={onQuantityInput}
          onQuantityCommit={onQuantityCommit}
        />
      ),
    },
    {
      id: 'price',
      header: 'Unit price',
      align: 'right',
      width: '16%',
      className: 'hidden md:table-cell',
      headerClassName: 'hidden md:table-cell',
      cell: ({ row }) => (
        <OverflowValue value={formatCurrency(row.unitPrice)} className="text-right tabular-nums" />
      ),
    },
    {
      id: 'subtotal',
      header: 'Subtotal',
      align: 'right',
      width: '18%',
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      cell: ({ row }) => (
        <OverflowValue
          value={formatCurrency(row.unitPrice * row.quantity)}
          className="text-right font-semibold tabular-nums"
        />
      ),
    },
    {
      id: 'remove',
      header: <span className="sr-only">Remove item</span>,
      align: 'right',
      width: 44,
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Remove ${row.name}`}
          disabled={disabled}
          onClick={() => onRemove(row.productId)}
        >
          <Trash2 aria-hidden="true" />
        </Button>
      ),
    },
  ]
  return (
    <DataTable
      data={lines}
      columns={columns}
      getRowKey={(line) => line.productId}
      pagination={false}
      tableClassName="table-fixed w-full"
      className="shadow-none"
      emptyContent={
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Search for a product above to add your first item.
        </p>
      }
    />
  )
}
