import { Ban, Check } from 'lucide-react'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import { cn } from '@/lib/utils'

export function DeliveryTimeline({ delivery, run }: { delivery: OutgoingDeliveryRecord; run?: DeliveryRunRecord | null }) {
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
    { label: 'Ready for Run', date: null },
    { label: 'In Transit', date: run?.dispatchedAt },
    { label: 'Reconciled', date: delivery.reconciledAt },
  ]

  return (
    <ol aria-label="Delivery progress" className="grid grid-cols-1 gap-3 sm:grid-cols-4 sm:gap-0">
      {steps.map((step, index) => {
        const complete = index < current
        const active = index === current
        const reached = index <= current
        return (
          <li
            key={step.label}
            aria-current={active ? 'step' : undefined}
            className="relative flex min-w-0 items-start gap-2 sm:flex-col sm:gap-2 sm:pr-3"
          >
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-3 top-6 h-[calc(100%+0.75rem)] w-px bg-border sm:left-6 sm:top-3 sm:h-px sm:w-[calc(100%-1.5rem)]',
                  complete && 'bg-primary-contrast/50',
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold',
                reached
                  ? 'border-primary-contrast bg-primary-contrast text-white'
                  : 'border-border text-muted-foreground',
                active && 'ring-2 ring-primary-contrast/20 ring-offset-2 ring-offset-background',
              )}
            >
              {complete ? <Check className="size-3.5" /> : index + 1}
            </span>
            <div className="min-w-0">
              <p
                className={cn(
                  'text-xs leading-5',
                  active
                    ? 'font-semibold text-primary-text'
                    : reached
                      ? 'font-medium text-foreground'
                      : 'text-muted-foreground',
                )}
              >
                {step.label}
                <span className="sr-only">
                  {active ? ': current step' : complete ? ': completed' : ': upcoming'}
                </span>
              </p>
              {reached && step.date && (
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                  {DeliveryUtils.formatDateTime(step.date)}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
