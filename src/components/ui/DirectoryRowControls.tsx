import { Badge } from '@/components/ui/badge'

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
      className={`px-2 py-0.5 text-xs font-medium ${
        isActive
          ? 'border-status-success-foreground/20 bg-status-success text-status-success-foreground'
          : 'border-border bg-muted text-muted-foreground'
      }`}
    >
      {isActive ? 'Active' : inactiveLabel}
    </Badge>
  )
}
