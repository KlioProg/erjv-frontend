import type { StockItem } from '@/features/logistics/stock-items.types'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'
import { stockConditionForItem } from '@/features/logistics/stock-warnings'
import { StatusBadge, type StatusBadgeTone } from '@/components/ui/StatusBadge'

export function StockStatusBadge({ stock }: { stock: StockItem }) {
  const condition = stockConditionForItem(stock)
  const labels = {
    OUT: 'Out of stock',
    LOW: 'Low stock',
    NORMAL: 'Normal',
    UNCONFIGURED: 'Threshold not set',
    UNKNOWN: 'Stock status unavailable',
  }
  const tones: Record<typeof condition, StatusBadgeTone> = {
    OUT: 'destructive',
    LOW: 'warning',
    NORMAL: 'success',
    UNCONFIGURED: 'neutral',
    UNKNOWN: 'neutral',
  }
  return (
    <StatusBadge
      label={labels[condition]}
      tone={tones[condition]}
      appearance="emphasis"
      showDot={false}
    />
  )
}

export function StockBalanceSummary({ stock }: { stock: StockItem }) {
  return (
    <div className="flex min-w-0 flex-col items-end gap-1">
      <dl className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        {(
          [
            ['Physical', stock.quantity],
            ['Reserved', stock.reservedQuantity],
            ['Damaged', stock.damagedQuantity],
            ['Available', stock.availableQuantity],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="min-w-0 text-right">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="tabular-nums [overflow-wrap:anywhere]">
              {formatStockCents(parseStockCents(value))}
            </dd>
          </div>
        ))}
      </dl>
      <StockStatusBadge stock={stock} />
    </div>
  )
}
