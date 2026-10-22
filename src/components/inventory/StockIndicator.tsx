import { AlertTriangle, CircleAlert } from 'lucide-react'
import type { StockCondition } from '@/features/logistics/stock-warnings'

export function StockIndicator({ condition, label }: { condition: StockCondition; label: string }) {
  if (condition !== 'OUT' && condition !== 'LOW') return null
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={
        condition === 'OUT'
          ? 'shrink-0 text-destructive'
          : 'shrink-0 text-status-warning-foreground'
      }
    >
      {condition === 'OUT' ? (
        <CircleAlert aria-hidden="true" className="size-3.5" />
      ) : (
        <AlertTriangle aria-hidden="true" className="size-3.5" />
      )}
    </span>
  )
}
