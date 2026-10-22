import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import { getErrorMessage } from '@/lib/api-client'
import type { StockAlert } from '@/features/logistics/stock-alerts'
import { StockAlertItem } from './StockAlertItem'

type NotificationPanelProps = {
  alerts: StockAlert[]
  isLoading: boolean
  isFetching: boolean
  error: unknown
  onRefresh: () => void
  onSelect: (alert: StockAlert) => void
}

export function NotificationPanel({
  alerts,
  isLoading,
  isFetching,
  error,
  onRefresh,
  onSelect,
}: NotificationPanelProps) {
  return (
    <DropdownMenuContent
      align="end"
      collisionPadding={8}
      className="flex max-h-[min(36rem,var(--radix-dropdown-menu-content-available-height))] w-[min(26rem,calc(100vw-1rem))] min-w-0 flex-col p-0"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <DropdownMenuLabel className="p-0 text-sm">Notifications</DropdownMenuLabel>
        <DropdownMenuGroup>
          <DropdownMenuItem
            asChild
            disabled={isFetching}
            onSelect={(event) => {
              event.preventDefault()
              onRefresh()
            }}
          >
            <Button variant="ghost" size="sm" disabled={isFetching}>
              {isFetching ? <Spinner aria-label="Refreshing notifications" /> : 'Refresh'}
            </Button>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </div>
      <DropdownMenuSeparator className="m-0" />
      <div className="min-h-0 overflow-y-auto overscroll-contain p-1">
        {isLoading ? (
          <p
            role="status"
            className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-muted-foreground"
          >
            <Spinner />
            Checking stock…
          </p>
        ) : error ? (
          <Alert variant="destructive" className="m-2 w-auto">
            <AlertDescription>
              Stock alerts could not be verified. {getErrorMessage(error)} Use Refresh to try again.
            </AlertDescription>
          </Alert>
        ) : alerts.length === 0 ? (
          <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
            No confirmed stockouts in active warehouses.
          </p>
        ) : (
          <DropdownMenuGroup aria-label="Active stock alerts">
            {alerts.map((alert) => (
              <StockAlertItem key={alert.id} alert={alert} onSelect={onSelect} />
            ))}
          </DropdownMenuGroup>
        )}
      </div>
      <DropdownMenuSeparator className="m-0" />
      <p className="shrink-0 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        Active alerts resolve when stock is replenished. Low-stock alerts require reorder
        thresholds, which aren’t available yet.
      </p>
    </DropdownMenuContent>
  )
}
