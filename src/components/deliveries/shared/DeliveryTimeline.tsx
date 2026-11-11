import { Ban } from 'lucide-react'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import { LifecycleProgress } from '@/components/ui/LifecycleProgress'

export function DeliveryTimeline({
  delivery,
  run,
}: {
  delivery: OutgoingDeliveryRecord
  run?: DeliveryRunRecord | null
}) {
  if (delivery.status === 'CANCELLED') {
    return (
      <div role="note" className="flex items-start gap-2 text-sm text-destructive">
        <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">Shipment cancelled</p>
          {delivery.cancelledAt && (
            <p className="mt-0.5 text-xs">{DeliveryUtils.formatDateTime(delivery.cancelledAt)}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            Created {DeliveryUtils.formatDateTime(delivery.createdAt)}
          </p>
        </div>
      </div>
    )
  }

  const current = DeliveryUtils.getStepIndex(delivery.status)
  const steps = [
    { label: 'Draft Created', date: delivery.createdAt },
    { label: 'Ready', date: null },
    { label: 'Dispatched', date: run?.dispatchedAt },
    { label: 'Results recorded', date: delivery.reconciledAt },
  ]

  return (
    <LifecycleProgress
      label="Delivery progress"
      milestones={steps.map((step, index) => ({
        id: step.label,
        label: step.label,
        state:
          index < current || delivery.status === 'RECONCILED'
            ? 'complete'
            : index === current
              ? 'current'
              : 'upcoming',
        detail: index <= current && step.date ? DeliveryUtils.formatDateTime(step.date) : undefined,
      }))}
    />
  )
}
