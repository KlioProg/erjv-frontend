import { useState } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useStockAlerts } from '@/features/logistics/stock-alerts.hooks'
import type { StockAlert } from '@/features/logistics/stock-alerts'
import { NotificationPanel } from './NotificationPanel'

export function NotificationBell({ onOpenAlert }: { onOpenAlert: (alert: StockAlert) => void }) {
  const [open, setOpen] = useState(false)
  const { alerts, verified, isLoading, isFetching, error, refresh } = useStockAlerts()
  return (
    <DropdownMenu
      modal={false}
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) void refresh()
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10 shrink-0"
          aria-label={
            verified
              ? `Notifications: ${alerts.length} active stock alerts`
              : 'Notifications: stock alerts unavailable'
          }
        >
          <Bell aria-hidden="true" />
          {verified && alerts.length > 0 && (
            <Badge
              variant="destructive"
              className="pointer-events-none absolute -right-1 -top-1 min-w-5 justify-center px-1 py-0 text-[10px]"
              aria-hidden="true"
            >
              {alerts.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <NotificationPanel
        alerts={alerts}
        isLoading={isLoading}
        isFetching={isFetching}
        error={error}
        onRefresh={() => void refresh()}
        onSelect={(alert) => {
          setOpen(false)
          onOpenAlert(alert)
        }}
      />
    </DropdownMenu>
  )
}
