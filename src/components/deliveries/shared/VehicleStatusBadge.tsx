import { StatusBadge } from '@/components/ui/StatusBadge'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import type { VehicleStatus } from '@/features/logistics/delivery-vehicles.types'

interface VehicleStatusBadgeProps {
  status: VehicleStatus
  className?: string
  showDot?: boolean
}

export function VehicleStatusBadge({
  status,
  className = '',
  showDot = true,
}: VehicleStatusBadgeProps) {
  const config = DeliveryUtils.getVehicleStatusConfig(status)

  return (
    <StatusBadge
      label={config.label}
      tone={
        status === 'AVAILABLE'
          ? 'success'
          : status === 'OUT_OF_SERVICE'
            ? 'destructive'
            : status === 'IN_DELIVERY' || status === 'MAINTENANCE'
              ? 'warning'
              : 'neutral'
      }
      className={className}
      showDot={showDot}
      title={config.description}
    />
  )
}
