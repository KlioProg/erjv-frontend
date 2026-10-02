import { Archive, Pencil, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

type DirectoryRowActionsProps = {
  recordType: 'Customer' | 'Supplier'
  name: string
  isActive: boolean
  onEdit?: () => void
  onArchive?: () => void
  onRestore?: () => void
  restoreLabel?: string
  isPending?: boolean
}

export function DirectoryRowActions({
  recordType,
  name,
  isActive,
  onEdit,
  onArchive,
  onRestore,
  restoreLabel = 'Reactivate',
  isPending = false,
}: DirectoryRowActionsProps) {
  const recordLabel = `${recordType.toLowerCase()} ${name}`

  return (
    <div className="flex items-center justify-end gap-1">
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-foreground"
          onClick={onEdit}
          title={`Edit ${recordType}`}
          aria-label={`Edit ${recordLabel}`}
        >
          <Pencil aria-hidden="true" />
        </Button>
      )}
      {isActive && onArchive && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onArchive}
          disabled={isPending}
          title={`Archive ${recordType}`}
          aria-label={`Archive ${recordLabel}`}
        >
          <Archive aria-hidden="true" />
        </Button>
      )}
      {!isActive && onRestore && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-600"
          onClick={onRestore}
          disabled={isPending}
          title={`${restoreLabel} ${recordType}`}
          aria-label={`${restoreLabel} ${recordLabel}`}
        >
          <RotateCcw aria-hidden="true" />
        </Button>
      )}
    </div>
  )
}

export function DirectoryStatusBadge({
  isActive,
  inactiveLabel = 'Inactive',
}: {
  isActive: boolean
  inactiveLabel?: string
}) {
  return (
    <Badge
      variant="outline"
      className={`px-2 py-0.5 text-[10px] font-semibold ${
        isActive
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
          : 'border-border bg-muted text-muted-foreground'
      }`}
    >
      {isActive ? 'Active' : inactiveLabel}
    </Badge>
  )
}
