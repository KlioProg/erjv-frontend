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
