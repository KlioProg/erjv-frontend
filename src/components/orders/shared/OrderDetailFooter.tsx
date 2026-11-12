import { MoreHorizontal } from 'lucide-react'
import { DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type OrderDetailAction = {
  label: string
  ariaLabel?: string
  onSelect: () => void
  disabled?: boolean
  destructive?: boolean
}

/** Domains supply eligible operations; this footer only arranges and presents them. */
export function OrderDetailFooter({
  label,
  secondaryActions,
  primaryAction,
  onClose,
  busy = false,
}: {
  label: string
  secondaryActions: readonly OrderDetailAction[]
  primaryAction?: OrderDetailAction
  onClose: () => void
  busy?: boolean
}) {
  const ordinary = secondaryActions.filter((action) => !action.destructive)
  const destructive = secondaryActions.filter((action) => action.destructive)
  const items = (actions: readonly OrderDetailAction[]) => (
    <DropdownMenuGroup>
      {actions.map((action) => (
        <DropdownMenuItem
          key={action.label}
          disabled={busy || action.disabled}
          onSelect={action.onSelect}
          className={cn(action.destructive && 'text-destructive focus:text-destructive')}
        >
          {action.label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  )

  return (
    <DialogFooter
      role="group"
      aria-label={label}
      aria-busy={busy || undefined}
      className="shrink-0 flex-row flex-wrap items-center justify-between border-t pt-3 sm:justify-between"
    >
      {secondaryActions.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={busy}>
            <Button type="button" variant="outline" disabled={busy}>
              <MoreHorizontal className="size-4" aria-hidden="true" /> More Actions
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" aria-label="More Actions">
            {ordinary.length > 0 && items(ordinary)}
            {ordinary.length > 0 && destructive.length > 0 && <DropdownMenuSeparator />}
            {destructive.length > 0 && items(destructive)}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
          Close
        </Button>
        {primaryAction && (
          <Button
            type="button"
            disabled={busy || primaryAction.disabled}
            aria-label={primaryAction.ariaLabel}
            onClick={primaryAction.onSelect}
          >
            {primaryAction.label}
          </Button>
        )}
      </div>
    </DialogFooter>
  )
}
