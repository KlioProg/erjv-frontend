import { useRef, useState } from 'react'
import { formatProductUnit } from '@/lib/product-unit'
import { AlertTriangle, Bell, CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu'
import { useStockWarnings } from '@/features/logistics/stock-warnings.hooks'
import { formatStockCents } from '@/features/logistics/stock-display'
import {
  filterStockWarnings,
  type InventoryNavigationTarget,
  type StockWarningFilter,
} from '@/features/logistics/stock-warnings'

export function StockNotifications({
  onOpenInventory,
}: {
  onOpenInventory: (target: InventoryNavigationTarget) => void
}) {
  const { warnings, warehouses, loading, unavailable, refreshing, refresh } = useStockWarnings()
  const [warehouseId, setWarehouseId] = useState('ALL')
  const warehouseTrigger = useRef<HTMLButtonElement>(null)
  const [warningFilter, setWarningFilter] = useState<StockWarningFilter>('ALL')
  const warehouse = warehouses.find((item) => String(item.id) === warehouseId)
  const scope = { warningFilter, warehouseId: warehouse?.id }
  const filtered = filterStockWarnings(warnings, scope)
  const preview = filtered.slice(0, 6)
  const emptyMessage =
    warningFilter === 'LOW'
      ? 'No low-stock items can be identified without configured reorder thresholds.'
      : warningFilter === 'OUT'
        ? 'No out-of-stock items' + (warehouse ? ' for the selected warehouse.' : '.')
        : warehouse
          ? 'No warnings for the selected warehouse.'
          : 'No stock warnings.'
  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) void refresh()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative shrink-0 pointer-coarse:size-11"
          title="Stock warnings"
          aria-label={
            unavailable
              ? 'Stock notifications unavailable'
              : loading
                ? 'Loading stock notifications'
                : `Stock notifications, ${warnings.length} unresolved warnings`
          }
        >
          <Bell aria-hidden="true" />
          {!loading && !unavailable && warnings.length > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground"
            >
              {warnings.length > 99 ? '99+' : warnings.length}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onFocus={(event) => {
          if (event.target === event.currentTarget && warehouseTrigger.current) {
            event.preventDefault()
            warehouseTrigger.current.focus()
          }
        }}
        onKeyDown={(event) => {
          if (
            warehouseTrigger.current &&
            (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) &&
            event.target === event.currentTarget.querySelector('[role="menuitemradio"]')
          ) {
            event.preventDefault()
            warehouseTrigger.current.focus()
          }
        }}
        className="max-h-[min(70dvh,32rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto"
      >
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between gap-3">
            Stock warnings{' '}
            {refreshing && (
              <span role="status" className="text-xs font-normal text-muted-foreground">
                Refreshing...
              </span>
            )}
          </DropdownMenuLabel>
          {!loading && !unavailable && (
            <>
              {warehouses.length > 1 && (
                <Select
                  value={warehouse ? String(warehouse.id) : 'ALL'}
                  onValueChange={setWarehouseId}
                >
                  <SelectTrigger
                    ref={warehouseTrigger}
                    aria-label="Warning warehouse"
                    onKeyDown={(event) => {
                      if (event.key === 'Tab') {
                        event.preventDefault()
                        event.stopPropagation()
                        event.currentTarget
                          .closest('[role="menu"]')
                          ?.querySelector<HTMLElement>('[role="menuitemradio"]')
                          ?.focus()
                      }
                    }}
                    className="mx-2 mb-2 w-[calc(100%-1rem)] h-9"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="ALL">All Warehouses</SelectItem>
                      {warehouses.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              )}
              <DropdownMenuRadioGroup
                aria-label="Warning status"
                value={warningFilter}
                onValueChange={(value) => setWarningFilter(value as StockWarningFilter)}
                className="flex flex-wrap"
              >
                {(
                  [
                    ['ALL', 'All warnings'],
                    ['OUT', 'Out of stock'],
                    ['LOW', 'Low stock'],
                  ] as const
                ).map(([value, label]) => (
                  <DropdownMenuRadioItem
                    key={value}
                    value={value}
                    onSelect={(event) => event.preventDefault()}
                    className="text-xs"
                  >
                    {label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
            </>
          )}
          {unavailable ? (
            <>
              <p role="alert" className="px-2 py-3 text-xs text-destructive">
                Stock warnings could not be loaded.
              </p>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault()
                  void refresh()
                }}
              >
                Retry loading warnings
              </DropdownMenuItem>
            </>
          ) : loading ? (
            <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
              Loading stock warnings...
            </p>
          ) : filtered.length === 0 ? (
            <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            preview.map((warning) => (
              <DropdownMenuItem
                key={warning.id}
                disabled={refreshing}
                onSelect={() =>
                  onOpenInventory({
                    productId: warning.productId,
                    warehouseId: warning.warehouseId,
                  })
                }
                className="items-start gap-3 py-3 pointer-coarse:min-h-11"
                aria-label={`${warning.severity === 'OUT' ? 'Out of stock' : 'Low stock'}: ${warning.productName}, ${warning.locationName}, ${formatStockCents(warning.quantityCents)} ${formatProductUnit(warning.unit)}. Open inventory location`}
              >
                {warning.severity === 'OUT' ? (
                  <CircleAlert
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                  />
                ) : (
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-status-warning-foreground"
                  />
                )}
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium break-words">{warning.productName}</span>
                  <span className="text-xs text-muted-foreground break-words">
                    {warning.locationName} · {formatStockCents(warning.quantityCents)}{' '}
                    {formatProductUnit(warning.unit)} remaining
                  </span>
                  <span
                    className={
                      warning.severity === 'OUT'
                        ? 'text-xs text-destructive'
                        : 'text-xs text-status-warning-foreground'
                    }
                  >
                    {warning.severity === 'OUT' ? 'Out of stock' : 'Low stock'}
                    {warning.severity === 'LOW' && warning.reorderThresholdCents !== undefined && (
                      <>
                        {' '}
                        · Reorder at {formatStockCents(warning.reorderThresholdCents)}{' '}
                        {formatProductUnit(warning.unit)}
                      </>
                    )}
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        {!loading && !unavailable && (
          <>
            {filtered.length > preview.length && (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Showing {preview.length} of {filtered.length} warnings
              </p>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem disabled={refreshing} onSelect={() => onOpenInventory(scope)}>
                View All
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </>
        )}
        <DropdownMenuSeparator />
        <p className="px-2 py-2 text-xs text-muted-foreground">
          Low-stock detection is unavailable because warehouse reorder thresholds are not
          configured. Quantities shown are physical stock.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
