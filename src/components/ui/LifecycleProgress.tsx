import { Check, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type LifecycleMilestoneState = 'complete' | 'current' | 'upcoming' | 'cancelled'

export type LifecycleMilestone = {
  id: string
  label: string
  state: LifecycleMilestoneState
}

const stateLabels: Record<LifecycleMilestoneState, string> = {
  complete: 'Completed',
  current: 'Current',
  upcoming: 'Upcoming',
  cancelled: 'Cancelled',
}

/** Presentational sequence only: the domain supplies every milestone's actual state. */
export function LifecycleProgress({
  label,
  milestones,
}: {
  label: string
  milestones: readonly LifecycleMilestone[]
}) {
  if (milestones.length === 0) return null

  return (
    <ol
      aria-label={label}
      role="list"
      tabIndex={0}
      className="flex min-w-0 gap-2 overflow-x-auto p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      {milestones.map((milestone, index) => (
        <li
          key={milestone.id}
          aria-current={milestone.state === 'current' ? 'step' : undefined}
          className="flex min-w-24 flex-1 flex-col gap-2"
        >
          <div aria-hidden="true" className="flex h-4 items-center gap-2">
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full border bg-background',
                milestone.state === 'complete' &&
                  'border-primary-contrast bg-primary-contrast text-primary-contrast-foreground',
                milestone.state === 'current' &&
                  'border-primary-contrast ring-2 ring-primary-contrast/30',
                milestone.state === 'upcoming' && 'border-input',
                milestone.state === 'cancelled' && 'border-destructive text-destructive',
              )}
            >
              {milestone.state === 'complete' && <Check className="size-3" />}
              {milestone.state === 'current' && (
                <span className="size-2 rounded-full bg-primary-contrast" />
              )}
              {milestone.state === 'cancelled' && <X className="size-3" />}
            </span>
            {index < milestones.length - 1 && <span className="h-px flex-1 bg-border" />}
          </div>
          <span
            className={cn(
              'max-w-32 text-xs leading-4 [overflow-wrap:anywhere]',
              milestone.state === 'current'
                ? 'font-semibold text-foreground'
                : 'text-muted-foreground',
              milestone.state === 'cancelled' && 'text-destructive',
            )}
          >
            {milestone.label}
            {milestone.label.trim().toLowerCase() !==
              stateLabels[milestone.state].toLowerCase() && (
              <span className="sr-only"> — {stateLabels[milestone.state]}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}
