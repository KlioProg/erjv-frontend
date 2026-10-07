import { Archive, Eye, Pencil, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type DataTableActionsProps = {
  children?: ReactNode
  onEdit?: () => void
  onArchive?: () => void
  onView?: () => void
  onRestore?: () => void
  viewLabel?: string
  restoreLabel?: string
  isPending?: boolean
}

/** Shared action presentation; features own permissions, confirmations, and mutations. */
export function DataTableActions({
  children,
  onEdit,
  onArchive,
  onView,
  onRestore,
  viewLabel = 'View',
  restoreLabel = 'Restore',
  isPending = false,
}: DataTableActionsProps) {
  const actions = [
    {
      onClick: onEdit,
      label: 'Edit',
      Icon: Pencil,
      className: 'text-muted-foreground hover:text-foreground',
    },
    {
      onClick: onArchive,
      label: 'Archive',
      Icon: Archive,
      className: 'text-destructive hover:bg-destructive/10 hover:text-destructive',
    },
    {
      onClick: onRestore,
      label: restoreLabel,
      Icon: RotateCcw,
      className: 'text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600',
    },
  ].filter((action) => action.onClick)

  if (actions.length === 0 && !onView && !children) return null

  return (
    <div
      className="inline-flex shrink-0 items-center justify-end gap-0 align-middle"
      onClick={(event) => event.stopPropagation()}
    >
      {children}
      {onView && (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 min-w-8 shrink-0 px-2 pointer-coarse:h-11 pointer-coarse:min-w-11 lg:px-3"
          onClick={onView}
          disabled={isPending}
          title={viewLabel}
          aria-label={viewLabel}
        >
          <Eye aria-hidden="true" />
          <span className="hidden lg:inline">{viewLabel}</span>
        </Button>
      )}
      {actions.map(({ onClick, label, Icon, className }) => (
        <Button
          key={label}
          type="button"
          variant="ghost"
          size="icon"
          className={cn('size-8 shrink-0 pointer-coarse:size-11', className)}
          onClick={onClick}
          disabled={isPending}
          title={label}
          aria-label={label}
        >
          <Icon aria-hidden="true" />
        </Button>
      ))}
    </div>
  )
}
