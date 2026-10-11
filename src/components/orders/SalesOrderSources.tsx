import { ChevronDown, Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OrderDecimalInput } from '@/components/order-entry/OrderEntryFields'
import type { OrderLine } from '@/features/crm/sales-order-entry.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { useSalesOrderEntry } from '@/features/crm/sales-order-entry.hooks'
import { allocatedQuantity } from '@/features/crm/sales-order-entry.schema'
import { availableStock, decimalString } from '@/lib/order-amounts'

type SourceProps = {
  line: OrderLine
  warehouses: Warehouse[]
  form: ReturnType<typeof useSalesOrderEntry>
}

export function SalesOrderSourceSummary({ line, warehouses, form }: SourceProps) {
  const sources = line.allocations ?? []
  const stock = form.eligibleSources(line).find((item) => item.id === sources[0]?.stockItemId)
  const warehouse = warehouses.find((item) => item.id === stock?.warehouseId)
  const summary =
    sources.length > 1
      ? `${sources.length} warehouses · ${decimalString(allocatedQuantity(line))} ${line.unit ?? ''}`
      : warehouse
        ? `${warehouse.name} · ${line.quantity} ${line.unit ?? ''}`
        : 'Set stock source'
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      id={`order-source-summary-${line.productId}`}
      aria-label={`Stock source for ${line.name}`}
      aria-expanded={form.expandedSource === line.productId}
      aria-controls={`order-sources-${line.productId}`}
      disabled={form.submission.locked}
      onClick={() =>
        form.expandedSource === line.productId ? form.closeSources(line) : form.openSources(line)
      }
      className="mt-1 h-7 max-w-full justify-start gap-1 px-0 text-xs pointer-coarse:min-h-11"
      title={summary}
    >
      <span className="truncate">{summary}</span>
      <ChevronDown aria-hidden="true" data-icon="inline-end" />
    </Button>
  )
}

export function SalesOrderSourceEditor({ line, warehouses, form }: SourceProps) {
  const sources = line.allocations?.length
    ? line.allocations
    : [{ key: 0, quantity: line.quantity }]
  const split = sources.length > 1
  const eligible = form.eligibleSources(line)
  const invalid = form.sourceError(line)
  const errorId = `order-source-error-${line.productId}`
  return (
    <div
      id={`order-sources-${line.productId}`}
      role="group"
      aria-label={`Stock sources for ${line.name}`}
      className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:px-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium">Stock source · {line.name}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {split
            ? `Allocated ${decimalString(allocatedQuantity(line))} / ${line.quantity}`
            : `Ordered ${line.quantity}`}{' '}
          {line.unit}
        </span>
      </div>
      {sources.map((source, index) => {
        const sourceId = `order-source-${line.productId}-${source.key}`
        const quantityId = `order-quantity-${line.productId}-${source.key}`
        return (
          <div key={source.key} className="flex min-w-0 flex-wrap items-end gap-2">
            <div className="flex min-w-0 flex-1 basis-40 flex-col gap-1.5">
              <Label htmlFor={sourceId} className="text-xs">
                {split ? `Warehouse ${index + 1}` : 'Warehouse'}
              </Label>
              <Select
                value={source.stockItemId ? String(source.stockItemId) : ''}
                disabled={form.submission.locked || !eligible.length}
                onValueChange={(value) =>
                  form.updateSource(line, source.key, 'stockItemId', Number(value))
                }
              >
                <SelectTrigger
                  id={sourceId}
                  className="h-9"
                  aria-label={`Warehouse source ${index + 1} for ${line.name}`}
                  aria-invalid={invalid?.focusId === sourceId}
                  aria-describedby={invalid?.focusId === sourceId ? errorId : undefined}
                >
                  <SelectValue
                    placeholder={eligible.length ? 'Select warehouse' : 'No available sources'}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {eligible.map((stock) => (
                      <SelectItem
                        key={stock.id}
                        value={String(stock.id)}
                        disabled={sources.some(
                          (other) => other.key !== source.key && other.stockItemId === stock.id,
                        )}
                      >
                        {warehouses.find((warehouse) => warehouse.id === stock.warehouseId)?.name} ·{' '}
                        {decimalString(availableStock(stock))} {line.unit} available
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            {split && (
              <div className="flex w-24 shrink-0 flex-col gap-1.5">
                <Label htmlFor={quantityId} className="text-xs">
                  Quantity
                </Label>
                <OrderDecimalInput
                  mobileLabel=""
                  id={quantityId}
                  aria-label={`Source quantity ${index + 1} for ${line.name}`}
                  value={source.quantity}
                  aria-invalid={invalid?.focusId === quantityId}
                  aria-describedby={invalid?.focusId === quantityId ? errorId : undefined}
                  onChange={(event) =>
                    form.updateSource(line, source.key, 'quantity', event.target.value)
                  }
                />
              </div>
            )}
            {(split || source.stockItemId) && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 pointer-coarse:size-11"
                aria-label={`Remove source ${index + 1} for ${line.name}`}
                title="Remove source"
                onClick={() => form.removeSource(line, source.key)}
              >
                <X aria-hidden="true" />
              </Button>
            )}
          </div>
        )
      })}
      {invalid && (
        <p id={errorId} className="text-xs text-destructive">
          {invalid.message}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {eligible.length > sources.length ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-0 pointer-coarse:min-h-11"
            onClick={() => form.addSource(line)}
          >
            <Plus aria-hidden="true" data-icon="inline-start" />
            {split ? 'Add source' : 'Split across warehouses'}
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {split ? 'All available sources shown.' : 'Uses the ordered quantity.'}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 pointer-coarse:min-h-11"
          onClick={() => form.closeSources(line)}
        >
          Done
        </Button>
      </div>
    </div>
  )
}
