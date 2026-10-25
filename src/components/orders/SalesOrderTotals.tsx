import { OrderPricingSummary } from '@/components/order-entry/OrderLineDiscount'
import type { useSalesOrderEntry } from '@/features/crm/sales-order-entry.hooks'

export function SalesOrderTotals({ form }: {
  form: Pick<ReturnType<typeof useSalesOrderEntry>, 'lines' | 'amounts' | 'taxExemption' | 'setTaxExemption' | 'busy' | 'editing'>
}) {
  return <section aria-label="Order totals" className="flex flex-wrap items-start justify-between gap-4">
    <div className="flex flex-col gap-2">
      <span className="text-xs text-muted-foreground">{form.lines.length} {form.lines.length === 1 ? 'item' : 'items'}</span>
      {form.editing ? <p className="text-xs text-muted-foreground">Saved line VAT rates are preserved.</p> : (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" role="switch" aria-label="Vat exempt" checked={form.taxExemption}
            onChange={(event) => form.setTaxExemption(event.target.checked)} disabled={form.busy}
            className="h-4 w-7 accent-primary" />VAT Exempt
        </label>
      )}
    </div>
    <OrderPricingSummary amounts={form.amounts} />
  </section>
}
