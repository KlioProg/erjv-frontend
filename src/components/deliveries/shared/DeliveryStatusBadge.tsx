import { StatusBadge } from '@/components/ui/StatusBadge'
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
    <StatusBadge
      label={outgoingStatusLabel(status, runId)}
      appearance="emphasis"
      showDot={showDot}
      className={className}
      tone={status === 'DRAFT' ? 'neutral' : status === 'READY' ? 'info' : status === 'DISPATCHED' ? 'warning' : status === 'RECONCILED' ? 'success' : 'destructive'}
      title={status === 'READY' && runId != null ? 'Assigned to a delivery run' : config.description}
    />
  )
}
