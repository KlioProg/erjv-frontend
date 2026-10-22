import type { ReactNode } from 'react'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const tones = {
  neutral: 'border-status-neutral-foreground/20 bg-status-neutral text-status-neutral-foreground',
  warning: 'border-status-warning-foreground/20 bg-status-warning text-status-warning-foreground',
  info: 'border-status-info-foreground/20 bg-status-info text-status-info-foreground',
  progress: 'border-status-info-foreground/20 bg-status-info text-status-info-foreground',
  success: 'border-status-success-foreground/20 bg-status-success text-status-success-foreground',
  destructive: 'border-status-danger-foreground/20 bg-status-danger text-status-danger-foreground',
}

const dots = {
  neutral: 'bg-status-neutral-foreground',
  warning: 'bg-status-warning-foreground',
  info: 'bg-status-info-foreground',
  progress: 'bg-status-info-foreground',
  success: 'bg-status-success-foreground',
  destructive: 'bg-status-danger-foreground',
}

export type StatusBadgeTone = keyof typeof tones

type StatusBadgeProps = Omit<BadgeProps, 'variant' | 'children'> & {
  label: ReactNode
  tone?: StatusBadgeTone
  appearance?: 'subtle' | 'emphasis'
  showDot?: boolean
}

/** Shared presentation; each feature owns its backend status labels and mapping. */
export function StatusBadge({
  label,
  tone = 'neutral',
  appearance = 'subtle',
  showDot = true,
  className,
  ...props
}: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'max-w-full whitespace-normal',
        appearance === 'emphasis'
          ? tones[tone]
          : 'border-border bg-status-neutral text-status-neutral-foreground',
        className,
      )}
      {...props}
    >
      {showDot && (
        <span
          aria-hidden="true"
          data-slot="status-dot"
          className={cn('size-1.5 shrink-0 rounded-full', dots[tone])}
        />
      )}
      <span>{label}</span>
    </Badge>
  )
}
