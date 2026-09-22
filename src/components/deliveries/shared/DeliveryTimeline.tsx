import { CheckCircle2, Clock, Truck, Ban, FileText } from 'lucide-react'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

interface DeliveryTimelineProps {
  delivery: OutgoingDeliveryRecord
}

export function DeliveryTimeline({ delivery }: DeliveryTimelineProps) {
  const isCancelled = delivery.status === 'CANCELLED'

  if (isCancelled) {
    return (
      <div className="flex items-center gap-3 p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 text-xs text-rose-700 dark:text-rose-400">
        <Ban className="size-4 shrink-0 text-rose-600" />
        <div className="flex flex-col">
          <span className="font-bold">Shipment Cancelled</span>
          <span className="text-[11px] text-muted-foreground">
            Cancelled on {DeliveryUtils.formatDateTime(delivery.cancelledAt)}
          </span>
        </div>
      </div>
    )
  }

  const steps = [
    {
      key: 'DRAFT',
      title: 'Draft Created',
      date: delivery.createdAt,
      icon: FileText,
      completed: true,
      active: delivery.status === 'DRAFT',
    },
    {
      key: 'SCHEDULED',
      title: 'Scheduled',
      date: delivery.scheduledAt,
      icon: Clock,
      completed: ['SCHEDULED', 'DISPATCHED', 'DELIVERED'].includes(delivery.status),
      active: delivery.status === 'SCHEDULED',
    },
    {
      key: 'DISPATCHED',
      title: 'Dispatched in Transit',
      date: delivery.dispatchedAt,
      icon: Truck,
      completed: ['DISPATCHED', 'DELIVERED'].includes(delivery.status),
      active: delivery.status === 'DISPATCHED',
    },
    {
      key: 'DELIVERED',
      title: 'Delivered to Destination',
      date: delivery.deliveredAt,
      icon: CheckCircle2,
      completed: delivery.status === 'DELIVERED',
      active: delivery.status === 'DELIVERED',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
      {steps.map((step) => {
        const Icon = step.icon
        return (
          <div
            key={step.key}
            className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-colors ${
              step.active
                ? 'border-primary/40 bg-primary/5 shadow-2xs'
                : step.completed
                  ? 'border-border/80 bg-card/60'
                  : 'border-dashed border-border/50 bg-muted/20 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider ${
                  step.active
                    ? 'text-primary'
                    : step.completed
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground/70'
                }`}
              >
                {step.completed ? 'Completed' : step.active ? 'Active Phase' : 'Upcoming'}
              </span>
              <Icon
                className={`size-3.5 ${
                  step.active
                    ? 'text-primary'
                    : step.completed
                      ? 'text-emerald-600'
                      : 'text-muted-foreground'
                }`}
              />
            </div>
            <span
              className={`text-xs font-bold leading-tight ${
                step.active
                  ? 'text-primary'
                  : step.completed
                    ? 'text-foreground'
                    : 'text-muted-foreground'
              }`}
            >
              {step.title}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {step.date ? DeliveryUtils.formatDateTime(step.date) : 'Pending'}
            </span>
          </div>
        )
      })}
    </div>
  )
}
