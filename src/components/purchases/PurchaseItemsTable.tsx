import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import {
  formatPurchaseMoney,
  purchaseDecimal,
  purchaseLineTotal,
  type PurchaseLine,
} from '@/features/logistics/purchase-pricing'

type Props = {
  lines: PurchaseLine[]
  disabled: boolean
  canEditCosts: boolean
  onEdit: (id: string, field: 'quantity' | 'unitCost', value: string) => void
  onRemove: (id: string) => void
}

function LineInput({
  line,
  field,
  disabled,
  canEditCosts,
  onEdit,
}: Omit<Props, 'lines' | 'onRemove'> & {
  line: PurchaseLine
  field: 'quantity' | 'unitCost'
}) {
  const parsed = purchaseDecimal(line[field], field === 'quantity' ? 12 : 14)
  const invalid = parsed === null || (field === 'quantity' && parsed <= 0n)
  return (
    <Input
      type="number"
      inputMode="decimal"
      min={field === 'quantity' ? '0.01' : '0'}
      step="0.01"
      value={line[field]}
      disabled={disabled || (field === 'unitCost' && !canEditCosts)}
      aria-label={(field === 'quantity' ? 'Quantity' : 'Unit cost') + ' for ' + line.name}
      aria-invalid={invalid}
      onChange={(event) => onEdit(line.id, field, event.target.value)}
      className="h-10 min-w-0 text-base tabular-nums sm:text-sm"
    />
  )
}

export function PurchaseItemsTable(props: Props) {
  const { lines, disabled, onRemove } = props
  const columns: ColumnDef<PurchaseLine>[] = [
    {
      accessorKey: 'name',
      header: 'Product',
      className: 'min-w-0 whitespace-normal',
      cell: ({ row }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="break-words font-medium">{row.name}</span>
          <span className="break-words text-xs text-muted-foreground">
            {[row.variety, row.unit].filter(Boolean).join(' · ')}
          </span>
          <div className="mt-2 grid min-w-0 grid-cols-2 gap-2 sm:hidden">
            {(['quantity', 'unitCost'] as const).map((field) => (
              <label
                key={field}
                className="flex min-w-0 flex-col gap-1 text-xs text-muted-foreground"
              >
                {field === 'quantity' ? 'Quantity' : 'Unit Cost (₱)'}
                <LineInput {...props} line={row} field={field} />
              </label>
            ))}
          </div>
          <div className="mt-1 text-sm tabular-nums sm:hidden">
            Subtotal: {formatPurchaseMoney(purchaseLineTotal(row))}
          </div>
        </div>
      ),
    },
    ...(['quantity', 'unitCost'] as const).map((field) => ({
      accessorKey: field,
      header: field === 'quantity' ? 'Quantity' : 'Unit Cost (₱)',
      width: '20%',
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      cell: ({ row }: { row: PurchaseLine }) => <LineInput {...props} line={row} field={field} />,
    })),
    {
      id: 'subtotal',
      header: 'Subtotal',
      align: 'right',
      width: '18%',
      className: 'hidden whitespace-nowrap tabular-nums sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      cell: ({ row }) => formatPurchaseMoney(purchaseLineTotal(row)),
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      width: 48,
      className: 'px-1',
      headerClassName: 'px-1',
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={disabled}
          aria-label={'Remove ' + row.name}
          onClick={() => onRemove(row.id)}
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
      pagination={false}
      appearance="subtle"
      tableClassName="table-fixed w-full"
      emptyContent={
        <p className="py-6 text-sm text-muted-foreground">
          No items added. Select an inventory product above.
        </p>
      }
    />
  )
}
