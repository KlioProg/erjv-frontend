import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatOrderCurrency, parseOrderDecimal } from '@/lib/order-amounts'
import {
  discountFields,
  lineDiscountError,
  orderLineAmounts,
  savedOrderTotals,
  type LineDiscount,
  type PricedOrderLine,
  type SavedLineAmounts,
} from '@/lib/order-line-pricing'

export function OrderLineDiscount({
  id,
  name,
  value,
  line,
  onChange,
  fixedDisabled = false,
  compact = false,
  vatExempt = false,
  onVatExemptChange,
}: {
  id: string
  name: string
  value: LineDiscount
  line: Pick<PricedOrderLine, 'quantity' | 'unitPrice'>
  onChange: (value: LineDiscount) => void
  fixedDisabled?: boolean
  compact?: boolean
  vatExempt?: boolean
  onVatExemptChange?: (exempt: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const error = lineDiscountError({ ...line, ...discountFields(value) })
  const editor = (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <Select
          value={value.type}
          onValueChange={(type) => onChange({ ...value, type: type as LineDiscount['type'] })}
        >
          <SelectTrigger aria-label={`Discount type for ${name}`} className="h-9 w-13 shrink-0 px-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="percentage">%</SelectItem>
              <SelectItem value="peso" disabled={fixedDisabled}>
                ₱
              </SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Input
          id={compact ? `${id}-value` : id}
          aria-label={`Line discount for ${name}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={value[value.type]}
          disabled={fixedDisabled && value.type === 'peso'}
          onChange={(event) => onChange({ ...value, [value.type]: event.target.value })}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-${compact ? 'editor-error' : 'error'}` : undefined}
          className="h-9 min-w-0 px-2 text-right text-sm tabular-nums"
        />
      </div>
      {onVatExemptChange && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            role="switch"
            aria-label={`VAT exempt for ${name}`}
            checked={vatExempt}
            onChange={(event) => onVatExemptChange(event.target.checked)}
            className="h-4 w-7 accent-primary"
          />
          VAT Exempt
        </label>
      )}
    </div>
  )
  if (compact) {
    const summary = error
      ? 'Review discount'
      : (parseOrderDecimal(value[value.type]) ?? 0n) === 0n
        ? 'No discount'
        : value.type === 'peso'
          ? formatOrderCurrency(value.peso)
          : `${value.percentage}%`
    return (
      <div className="flex min-w-0 flex-col gap-1">
        <span aria-hidden="true" className="order-entry-mobile-label">
          Discount
        </span>
        <OverflowValue asChild value={summary}>
          <Button
            ref={triggerRef}
            id={id}
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Edit discount for ${name}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            className="h-9 w-full min-w-0 px-2 text-xs font-normal tabular-nums"
            onClick={() => setOpen(true)}
          >
            <span data-overflow-text className="min-w-0 truncate">
              {summary}
            </span>
          </Button>
        </OverflowValue>
        {error && (
          <p id={`${id}-error`} className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            className="sm:max-w-sm"
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              triggerRef.current?.focus()
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
                event.preventDefault()
                event.stopPropagation()
                if (!error) setOpen(false)
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>Line discount</DialogTitle>
              <DialogDescription className="[overflow-wrap:anywhere]">
                {name}. Choose a percentage or a fixed peso amount for this line.
              </DialogDescription>
            </DialogHeader>
            {editor}
            {error && (
              <p id={`${id}-editor-error`} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-1">
              <Button type="button" variant="outline" onClick={() => {
                onChange({ type: 'percentage', percentage: '', peso: '' })
                setOpen(false)
              }}>Remove discount</Button>
              <Button type="button" disabled={!!error} onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span aria-hidden="true" className="order-entry-mobile-label">
        Line discount
      </span>
      {editor}
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function OrderLineAmounts({
  line,
  saved,
  name,
}: {
  line: PricedOrderLine
  saved?: SavedLineAmounts
  name?: string
}) {
  const [open, setOpen] = useState(false)
  const amounts = saved ? savedOrderTotals([saved]) : orderLineAmounts(line)
  const details = (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs tabular-nums [&_dd]:text-right">
      {(['subtotal', 'discount', 'vat', 'total'] as const).map((key) => (
        <div key={key} className="contents">
          <dt className={key === 'total' ? 'font-medium' : 'text-muted-foreground'}>
            {{ subtotal: 'Subtotal', discount: 'Discount', vat: 'VAT', total: 'Total' }[key]}
          </dt>
          <dd className={key === 'total' ? 'font-medium' : ''}>
            {formatOrderCurrency(amounts?.[key] ?? null)}
          </dd>
        </div>
      ))}
    </dl>
  )
  if (!name) return details
  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group min-w-0"
    >
      <OverflowValue asChild value={formatOrderCurrency(amounts?.total ?? null)}>
        <summary
          aria-label={`Line amounts for ${name}`}
          className="flex min-h-9 min-w-0 cursor-pointer items-center justify-end gap-1 rounded-sm text-right font-medium underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span data-overflow-text className="min-w-0 truncate tabular-nums">
            {formatOrderCurrency(amounts?.total ?? null)}
          </span>
          <ChevronDown aria-hidden="true" className="size-3 shrink-0 group-open:rotate-180" />
        </summary>
      </OverflowValue>
      {open && details}
    </details>
  )
}

export function OrderPricingSummary({ amounts }: { amounts: ReturnType<typeof orderLineAmounts> }) {
  return (
    <dl className="ml-auto grid min-w-44 grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm tabular-nums [&_dd]:text-right">
      <dt className="text-muted-foreground">Subtotal</dt>
      <dd>{formatOrderCurrency(amounts?.subtotal ?? null)}</dd>
      <dt className="text-muted-foreground">Line discounts</dt>
      <dd>{formatOrderCurrency(amounts?.discount ?? null)}</dd>
      <dt className="text-muted-foreground">VAT</dt>
      <dd>{formatOrderCurrency(amounts?.vat ?? null)}</dd>
      <dt className="pt-1 font-semibold">Total</dt>
      <dd className="pt-1 font-semibold">{formatOrderCurrency(amounts?.total ?? null)}</dd>
    </dl>
  )
}
