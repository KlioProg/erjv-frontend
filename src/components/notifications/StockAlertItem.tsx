import { CircleAlert, ArrowRight } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { formatStockCents } from '@/features/logistics/stock-display'
import type { StockAlert } from '@/features/logistics/stock-alerts'

export function StockAlertItem({
  alert,
  onSelect,
}: {
  alert: StockAlert
  onSelect: (alert: StockAlert) => void
}) {
  return (
    <DropdownMenuItem
      onSelect={() => onSelect(alert)}
      className="items-start gap-3 px-3 py-3 text-sm"
    >
      <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex min-w-0 flex-1 flex-col gap-1 whitespace-normal break-words">
        <span className="text-xs font-semibold text-destructive">
          Out of stock · {alert.scope === 'overall' ? 'Overall inventory' : 'Warehouse'}
        </span>
        <span className="font-semibold">{alert.productName}</span>
        <span className="text-sm text-muted-foreground">
          {alert.scope === 'warehouse' ? alert.warehouseName : 'Across tracked active warehouses'}
          {' · '}
          {formatStockCents(alert.quantityCents)} {alert.unit} remaining
        </span>
        <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4">
          {alert.scope === 'warehouse' ? 'View warehouse' : 'View product'}
          <ArrowRight aria-hidden="true" className="size-3" />
        </span>
      </div>
    </DropdownMenuItem>
  )
}
