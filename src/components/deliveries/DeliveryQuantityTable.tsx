import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { ProductIdentity } from '@/components/order-entry/OrderEntryFields'
import { deliveryQuantityError } from '@/features/logistics/delivery-quantities'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import { deliveryFormStyles } from './shared/delivery-form.styles'

export type DeliveryQuantityRow = {
  id: number
  name: string
  variety?: string | null
  unit?: string
  ordered: string
  committed: string
  remaining: string | null
  quantity: string
  detail?: string
  quantityLimit?: string | null
}

export function DeliveryQuantityTable({
  rows,
  direction,
  onChange,
  disabled,
  compact = false,
}: {
  rows: DeliveryQuantityRow[]
  direction: 'Incoming' | 'Outgoing'
  onChange: (id: number, quantity: string) => void
  disabled: boolean
  compact?: boolean
}) {
  const verb = direction === 'Incoming' ? 'receive' : 'ship'
  const columns: ColumnDef<DeliveryQuantityRow>[] = [
    {
      id: 'product',
      header: 'Product',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <ProductIdentity name={row.name} variety={row.variety} unit={row.unit} />
          {row.detail && <span className="text-xs text-muted-foreground">{row.detail}</span>}
        </div>
      ),
    },
    {
      id: 'ordered',
      header: direction === 'Incoming' ? 'Ordered' : 'Allocated',
      align: 'right',
      cell: ({ row }) => formatStockCents(parseStockCents(row.ordered)),
    },
    {
      id: 'committed',
      header: 'Already arranged',
      align: 'right',
      cell: ({ row }) => formatStockCents(parseStockCents(row.committed)),
    },
    {
      id: 'remaining',
      header: 'Remaining',
      align: 'right',
      cell: ({ row }) => formatStockCents(parseStockCents(row.remaining)),
    },
    {
      id: 'quantity',
      header: compact ? 'This Delivery' : `Qty to ${verb}`,
      align: 'right',
      width: 140,
      cell: ({ row }) => {
        const limit = row.quantityLimit === undefined ? row.remaining : row.quantityLimit
        const issue = deliveryQuantityError(row.quantity, limit)
        const unavailable = limit === null || (!compact && parseStockCents(limit) === 0n)
        return (
          <div className="flex flex-col items-end gap-1">
            <Input
              id={`delivery-quantity-${row.id}`}
              aria-label={`Quantity to ${verb} for ${row.name}`}
              inputMode="decimal"
              value={row.quantity}
              onChange={(event) => onChange(row.id, event.target.value)}
              disabled={disabled || unavailable}
              aria-invalid={!!issue}
              aria-describedby={issue ? `delivery-quantity-error-${row.id}` : undefined}
              className={`${deliveryFormStyles.control} w-24 text-right tabular-nums`}
            />
            {issue && (
              <span
                id={`delivery-quantity-error-${row.id}`}
                className="max-w-40 text-xs text-destructive"
              >
                {issue}
              </span>
            )}
          </div>
        )
      },
    },
  ]
  return (
    <DataTable
      data={rows}
      columns={
        compact
          ? columns.filter((column) => column.id !== 'ordered' && column.id !== 'committed')
          : columns
      }
      getRowKey={(row) => row.id}
      pagination={false}
      tableClassName={`${compact ? 'min-w-[460px]' : 'min-w-[580px]'} [&_td]:text-sm [&_td]:tabular-nums`}
    />
  )
}
