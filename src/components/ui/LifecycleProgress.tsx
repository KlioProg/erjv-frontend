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
      className="grid w-full min-w-0 gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      style={{ gridTemplateColumns: `repeat(${milestones.length}, minmax(0, 1fr))` }}
    >
      {milestones.map((milestone) => (
        <li
          key={milestone.id}
          aria-current={milestone.state === 'current' ? 'step' : undefined}
          className="flex min-w-0 flex-col gap-1"
        >
          <span
            aria-hidden="true"
            data-slot="lifecycle-segment"
            data-state={milestone.state}
            className={cn(
              'h-1.5 w-full shrink-0 rounded-sm border',
              milestone.state === 'complete' && 'border-primary-contrast bg-primary-contrast',
              milestone.state === 'current' && 'border-primary-contrast bg-primary-contrast/20',
              milestone.state === 'upcoming' && 'border-input bg-background',
              milestone.state === 'cancelled' && 'border-destructive bg-destructive/15',
            )}
          />
          <span
            className={cn(
              'min-w-0 text-xs leading-4 [overflow-wrap:anywhere]',
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
