import { Badge } from '@/components/ui/badge'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import type { OutgoingDeliveryStatus } from '@/features/logistics/outgoing-deliveries.types'
import { outgoingStatusLabel } from '@/features/logistics/delivery-workflow'

interface DeliveryStatusBadgeProps {
  status: OutgoingDeliveryStatus
  className?: string
  showDot?: boolean
  runId?: number | null
}

export function DeliveryStatusBadge({
  status,
  className = '',
  showDot = true,
  runId,
}: DeliveryStatusBadgeProps) {
  const config = DeliveryUtils.getStatusConfig(status)

  return (
    <Badge
      variant="outline"
      className={`text-xs font-medium px-2 py-0.5 rounded-md inline-flex items-center gap-2 ${config.badgeClass} ${className}`}
      title={status === 'READY' && runId != null ? 'Assigned to a delivery run' : config.description}
    >
      {showDot && <span className={`size-1.5 rounded-full shrink-0 ${config.dotClass}`} />}
      <span>{outgoingStatusLabel(status, runId)}</span>
    </Badge>
  )
}
