import { formatProductUnit } from '@/lib/product-unit'
import { AlertTriangle, Bell, CircleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useStockWarnings } from '@/features/logistics/stock-warnings.hooks'
import { formatStockCents } from '@/features/logistics/stock-display'
import type { InventoryFocusTarget } from '@/features/logistics/stock-warnings'

export function StockNotifications({
  onOpenInventory,
}: {
  onOpenInventory: (target: InventoryFocusTarget) => void
}) {
  const { warnings, loading, unavailable, refreshing, refresh } = useStockWarnings()
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
          ) : warnings.length === 0 ? (
            <p role="status" className="px-2 py-3 text-xs text-muted-foreground">
              No out-of-stock locations found.
            </p>
          ) : (
            warnings.map((warning) => (
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
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <p className="px-2 py-2 text-xs text-muted-foreground">
          Warnings remain until stock changes. Low-stock alerts need configured reorder thresholds.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
