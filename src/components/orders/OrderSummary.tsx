import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type OrderSummaryProps<Amount extends number | bigint> = {
  itemCount: number
  subtotal: Amount
  vat: Amount
  discount: Amount
  total: Amount
  formatCurrency: (value: Amount) => string
  children?: ReactNode
}

/** Presentation only; the order form owns all pricing and discount calculations. */
export function OrderSummary<Amount extends number | bigint>({
  itemCount,
  subtotal,
  vat,
  discount,
  total,
  formatCurrency,
  children,
}: OrderSummaryProps<Amount>) {
  const amounts = [
    { label: 'Total items', value: String(itemCount) },
    { label: 'Subtotal', value: formatCurrency(subtotal) },
    { label: 'VAT', value: formatCurrency(vat) },
    ...(discount > 0 ? [{ label: 'Discount', value: `−${formatCurrency(discount)}` }] : []),
    { label: 'Grand Total', value: formatCurrency(total), prominent: true },
  ]
  return (
    <section aria-label="Order Summary" className="flex flex-col gap-3 border-t border-border pt-4">
      <h2 className="text-sm font-semibold">Order Summary</h2>
      {children}
      <dl className="flex flex-col gap-2 text-sm">
        {amounts.map(({ label, value, prominent }) => (
          <div
            key={label}
            className={cn(
              'flex items-baseline justify-between gap-4',
              prominent && 'mt-1 border-t border-border pt-3',
            )}
          >
            <dt className={prominent ? 'font-semibold' : 'text-muted-foreground'}>{label}</dt>
            <dd className={cn('text-right tabular-nums', prominent && 'text-xl font-bold')}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
