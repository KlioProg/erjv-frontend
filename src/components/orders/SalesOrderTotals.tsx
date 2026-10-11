import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatOrderCurrency } from '@/lib/order-amounts'
import { discountError, priceError, quantityError } from '@/lib/order-entry.schema'
import type { useSalesOrderEntry } from '@/features/crm/sales-order-entry.hooks'

export function SalesOrderTotals({
  form,
}: {
  form: Pick<
    ReturnType<typeof useSalesOrderEntry>,
    | 'lines'
    | 'amounts'
    | 'discountType'
    | 'setDiscountType'
    | 'discountValue'
    | 'setDiscountValue'
    | 'busy'
  >
}) {
  const complete = form.lines.every(
    (line) => !quantityError(line.quantity) && !priceError(line.unitPrice),
  )
  const invalidDiscount = discountError(
    form.discountValue,
    form.discountType,
    form.amounts.subtotal,
    form.amounts.discount,
  )
  const displayAmount = (value: string) =>
    formatOrderCurrency(complete && !invalidDiscount ? value : null)
  return (
    <section aria-label="Order totals" className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">
          {form.lines.length} {form.lines.length === 1 ? 'item' : 'items'}
        </span>
        {form.lines.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <label htmlFor="order-discount" className="text-muted-foreground">
              Discount
            </label>
            <Select
              value={form.discountType}
              disabled={form.busy}
              onValueChange={(value) => {
                form.setDiscountType(value as 'peso' | 'percentage')
                form.setDiscountValue('')
              }}
            >
              <SelectTrigger aria-label="Discount type" className="h-9 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="peso">₱</SelectItem>
                  <SelectItem value="percentage">%</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <Input
              id="order-discount"
              aria-label="Discount amount"
              type="text"
              inputMode="decimal"
              value={form.discountValue}
              onChange={(event) => form.setDiscountValue(event.target.value)}
              aria-invalid={!!invalidDiscount}
              placeholder="0.00"
              className="h-9 w-24 text-right text-sm tabular-nums"
            />
            {invalidDiscount && (
              <p className="max-w-80 basis-full text-xs text-destructive">{invalidDiscount}</p>
            )}
            {!invalidDiscount && complete && form.amounts.hasDiscountRounding && (
              <p className="max-w-80 basis-full text-xs text-muted-foreground">
                Requested {formatOrderCurrency(form.discountValue)}; applied{' '}
                {formatOrderCurrency(form.amounts.discount)} after rounding to the supported line
                discount rate ({form.amounts.discountRate}%).
              </p>
            )}
          </div>
        )}
      </div>
      <dl className="ml-auto grid min-w-44 grid-cols-[auto_auto] gap-x-6 gap-y-1 text-[13px] tabular-nums [&_dd]:text-right">
        <dt className="text-muted-foreground">Subtotal</dt>
        <dd>{displayAmount(form.amounts.subtotal)}</dd>
        <dt className="text-muted-foreground">Discount</dt>
        <dd>{displayAmount(form.amounts.discount)}</dd>
        <dt className="text-muted-foreground">VAT (12%)</dt>
        <dd>{displayAmount(form.amounts.vat)}</dd>
        <dt className="pt-1 text-sm font-semibold">Total</dt>
        <dd className="pt-1 text-sm font-semibold">{displayAmount(form.amounts.total)}</dd>
      </dl>
    </section>
  )
}
