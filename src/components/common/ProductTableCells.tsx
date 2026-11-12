import { OverflowValue } from '@/components/ui/OverflowValue'
import {
  formatProductLabel,
  formatReadOnlyQuantity,
  type ProductDescription,
} from '@/lib/product-presentation'

export function ProductTableLabel({
  product,
  fallback,
}: {
  product?: ProductDescription
  fallback?: string
}) {
  return (
    <div className="min-w-0 max-w-64 sm:max-w-80">
      <OverflowValue
        value={formatProductLabel(product, fallback)}
        className="max-w-full text-sm font-medium"
      />
    </div>
  )
}

export function ProductTableQuantity({
  value,
  unit,
  fallback,
}: {
  value: string | number | null | undefined
  unit?: string | null
  fallback?: string
}) {
  return (
    <span className="whitespace-nowrap tabular-nums">
      {formatReadOnlyQuantity(value, unit, fallback)}
    </span>
  )
}
