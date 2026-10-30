import { formatProductUnit } from '@/lib/product-unit'
import { forwardRef, useId, type ComponentProps, type ReactNode } from 'react'
import { Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { OverflowValue } from '@/components/ui/OverflowValue'

export function OrderField({
  id,
  label,
  required,
  children,
  className = '',
}: {
  id: string
  label: string
  required?: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <Label htmlFor={id} className="text-[13px] font-medium">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </Label>
      {children}
    </div>
  )
}

export const OrderDecimalInput = forwardRef<
  HTMLInputElement,
  ComponentProps<typeof Input> & { currency?: boolean; mobileLabel: string; error?: string }
>(({ currency, mobileLabel, error, className = '', ...props }, ref) => {
  const errorId = useId()
  return (
  <div className="flex min-w-0 flex-col gap-1">
    {mobileLabel && (
      <span aria-hidden="true" className="order-entry-mobile-label text-xs text-muted-foreground">
        {mobileLabel}
      </span>
    )}
    <div className="relative">
      {currency && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
        >
          ₱
        </span>
      )}
      <Input
        {...props}
        ref={ref}
        aria-invalid={!!error || props['aria-invalid']}
        aria-describedby={[props['aria-describedby'], error ? errorId : undefined].filter(Boolean).join(' ') || undefined}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        className={`order-entry-input h-9 px-2 text-right text-sm tabular-nums ${currency ? 'pl-6' : ''} ${className}`}
      />
    </div>
    {error && <p id={errorId} role="alert" className="text-xs text-destructive">{error}</p>}
  </div>
  )
})
OrderDecimalInput.displayName = 'OrderDecimalInput'

export function RemoveOrderItem({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-9 shrink-0 text-destructive/80 hover:bg-destructive/10 hover:text-destructive pointer-coarse:size-11"
      onClick={onRemove}
      aria-label={`Remove ${name}`}
      title={`Remove ${name}`}
    >
      <Trash2 aria-hidden="true" className="size-4" />
    </Button>
  )
}

export function ProductIdentity({
  name,
  variety,
  unit,
}: {
  name: string
  variety?: string | null
  unit?: string | null
}) {
  const showVariety = variety && !String(name ?? '').toLocaleLowerCase().includes(String(variety).toLocaleLowerCase())
  const secondary = [showVariety ? variety : null, formatProductUnit(unit)]
    .filter(Boolean)
    .join(' · ')
  return (
    <div className="min-w-0 max-w-full">
      <OverflowValue value={name} className="text-sm font-medium leading-5" />
      {secondary && <OverflowValue value={secondary} className="text-xs leading-4 text-muted-foreground" />}
    </div>
  )
}

export function ProductPickerOption({
  name,
  variety,
  unit,
  availability,
  description,
}: {
  name: string
  variety?: string | null
  unit?: string
  availability?: string
  description?: string | null
}) {
  const secondary = [
    variety && !String(name ?? '').toLocaleLowerCase().includes(String(variety).toLocaleLowerCase()) ? variety : null,
    formatProductUnit(unit),
    description,
    availability,
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      <OverflowValue value={name} className="text-sm font-medium" />
      {secondary && (
        <OverflowValue value={secondary} className="text-xs text-muted-foreground" />
      )}
    </span>
  )
}
