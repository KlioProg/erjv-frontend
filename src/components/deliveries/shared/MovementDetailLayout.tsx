import type { ReactNode } from 'react'
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function MovementDetailHeader({
  title,
  description,
  status,
  className,
}: {
  title: string
  description: ReactNode
  status?: ReactNode
  className?: string
}) {
  return (
    <DialogHeader className={cn('shrink-0 text-left', className)}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <DialogTitle className="text-xl font-semibold leading-6 [overflow-wrap:anywhere]">
            {title}
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs">{description}</DialogDescription>
        </div>
        {status && <div className="shrink-0">{status}</div>}
      </div>
    </DialogHeader>
  )
}

export type MovementDetailFieldItem = {
  label: string
  value: ReactNode
  secondary?: ReactNode
}

export function MovementDetailFields({
  fields,
  className,
}: {
  fields: MovementDetailFieldItem[]
  className?: string
}) {
  return (
    <dl className={cn('grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2', className)}>
      {fields.map(({ label, value, secondary }) => (
        <div key={label} className="min-w-0 [overflow-wrap:anywhere]">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-sm font-medium text-foreground">
            {value}
            {secondary && (
              <p className="mt-0.5 text-xs font-normal text-muted-foreground">{secondary}</p>
            )}
          </dd>
        </div>
      ))}
    </dl>
  )
}
