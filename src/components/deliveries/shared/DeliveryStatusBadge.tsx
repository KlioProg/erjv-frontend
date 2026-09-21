import { Badge } from '@/components/ui/badge'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import type { OutgoingDeliveryStatus } from '@/features/logistics/outgoing-deliveries.types'

interface DeliveryStatusBadgeProps {
  status: OutgoingDeliveryStatus
  className?: string
  showDot?: boolean
}

export function DeliveryStatusBadge({
  status,
  className = '',
  showDot = true,
}: DeliveryStatusBadgeProps) {
  const config = DeliveryUtils.getStatusConfig(status)

  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5 ${config.badgeClass} ${className}`}
      title={config.description}
    >
      {showDot && <span className={`size-1.5 rounded-full shrink-0 ${config.dotClass}`} />}
      <span>{config.label}</span>
    </Badge>
  )
}
