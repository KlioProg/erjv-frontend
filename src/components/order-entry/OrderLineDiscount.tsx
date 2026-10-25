import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatOrderCurrency } from '@/lib/order-amounts'
import { discountFields, lineDiscountError, orderLineAmounts, savedOrderTotals, type LineDiscount, type PricedOrderLine, type SavedLineAmounts } from '@/lib/order-line-pricing'

export function OrderLineDiscount({ id, name, value, line, onChange, fixedDisabled = false }: {
  id: string
  name: string
  value: LineDiscount
  line: Pick<PricedOrderLine, 'quantity' | 'unitPrice'>
  onChange: (value: LineDiscount) => void
  fixedDisabled?: boolean
}) {
  const error = lineDiscountError({ ...line, ...discountFields(value) })
  return <div className="flex min-w-0 flex-col gap-1">
    <span aria-hidden="true" className="order-entry-mobile-label">Line discount</span>
    <div className="flex min-w-0 items-center gap-1">
      <Select value={value.type} onValueChange={(type) => onChange({ ...value, type: type as LineDiscount['type'] })}>
        <SelectTrigger aria-label={`Discount type for ${name}`} className="h-9 w-13 shrink-0 px-2"><SelectValue /></SelectTrigger>
        <SelectContent><SelectGroup>
          <SelectItem value="percentage">%</SelectItem>
          <SelectItem value="peso" disabled={fixedDisabled}>₱</SelectItem>
        </SelectGroup></SelectContent>
      </Select>
      <Input id={id} aria-label={`Line discount for ${name}`} type="text" inputMode="decimal"
        autoComplete="off" placeholder="0" value={value[value.type]}
        disabled={fixedDisabled && value.type === 'peso'}
        onChange={(event) => onChange({ ...value, [value.type]: event.target.value })}
        aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
        className="h-9 min-w-0 px-2 text-right text-sm tabular-nums" />
    </div>
    {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
  </div>
}

export function OrderLineAmounts({ line, saved }: { line: PricedOrderLine; saved?: SavedLineAmounts }) {
  const amounts = saved ? savedOrderTotals([saved]) : orderLineAmounts(line)
  return <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs tabular-nums [&_dd]:text-right">
    {(['subtotal', 'discount', 'vat', 'total'] as const).map((key) => <div key={key} className="contents">
      <dt className={key === 'total' ? 'font-medium' : 'text-muted-foreground'}>{({ subtotal: 'Subtotal', discount: 'Discount', vat: 'VAT', total: 'Total' })[key]}</dt>
      <dd className={key === 'total' ? 'font-medium' : ''}>{formatOrderCurrency(amounts?.[key] ?? null)}</dd>
    </div>)}
  </dl>
}

export function OrderPricingSummary({ amounts }: { amounts: ReturnType<typeof orderLineAmounts> }) {
  return <dl className="ml-auto grid min-w-44 grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm tabular-nums [&_dd]:text-right">
    <dt className="text-muted-foreground">Subtotal</dt><dd>{formatOrderCurrency(amounts?.subtotal ?? null)}</dd>
    <dt className="text-muted-foreground">Line discounts</dt><dd>{formatOrderCurrency(amounts?.discount ?? null)}</dd>
    <dt className="text-muted-foreground">VAT</dt><dd>{formatOrderCurrency(amounts?.vat ?? null)}</dd>
    <dt className="pt-1 font-semibold">Total</dt><dd className="pt-1 font-semibold">{formatOrderCurrency(amounts?.total ?? null)}</dd>
  </dl>
}
