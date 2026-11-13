import { StatusBadge } from '@/components/ui/StatusBadge'

export function DirectoryStatusBadge({
  isActive,
  inactiveLabel = 'Inactive',
}: {
  isActive: boolean
  inactiveLabel?: string
}) {
  return (
    <StatusBadge
      label={isActive ? 'Active' : inactiveLabel}
      tone={isActive ? 'success' : 'neutral'}
    />
  )
}
