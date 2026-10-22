import { DataTable } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { useMediaQuery } from '@/lib/use-media-query'
import { formatStockCents } from '@/features/logistics/stock-display'
import type { DeliveryQuantityRow } from '@/features/logistics/delivery-quantities'

export function DeliveryItemsTable({
  rows,
  onChange,
  disabled = false,
  quantityLabel = 'Shipment quantity',
}: {
  rows: DeliveryQuantityRow[]
  onChange: (id: number, quantity: string) => void
  disabled?: boolean
  quantityLabel?: string
}) {
  const wide = useMediaQuery('(min-width: 40rem)')
  return (
    <DataTable
      data={rows}
      pagination={false}
      getRowKey={(row) => row.id}
      tableClassName="table-fixed w-full"
      columns={[
        {
          id: 'product',
          header: 'Product',
          width: wide ? '50%' : '58%',
          cell: ({ row }) => (
            <div className="flex min-w-0 flex-col gap-1">
              <OverflowValue value={row.product} className="text-sm font-medium" />
              <span className="text-xs text-muted-foreground">
                {row.unit}
                {!wide && ` · Available: ${formatStockCents(row.available)}`}
              </span>
            </div>
          ),
        },
        ...(wide
          ? [
              {
                id: 'available',
                header: 'Available',
                width: '20%',
                align: 'right' as const,
                cell: ({ row }: { row: DeliveryQuantityRow }) => (
                  <OverflowValue
                    value={formatStockCents(row.available)}
                    className="text-right tabular-nums"
                  />
                ),
              },
            ]
          : []),
        {
          id: 'quantity',
          header: quantityLabel,
          width: wide ? '30%' : '42%',
          cell: ({ row }) => (
            <Input
              type="text"
              inputMode="decimal"
              aria-label={`${quantityLabel} for ${row.product}`}
              value={row.quantity}
              onChange={(event) => onChange(row.id, event.target.value)}
              disabled={disabled || row.available === null}
              className="w-full min-w-0 text-right text-base tabular-nums sm:text-sm"
            />
          ),
        },
      ]}
    />
  )
}
