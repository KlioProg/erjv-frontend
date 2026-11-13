import { Button } from './button'
import { cn } from '@/lib/utils'

/** Persistent content recovery; filters and page state remain owned by the caller. */
export function TableLoadError({
  message,
  description,
  onRetry,
  retrying = false,
  compact = false,
}: {
  message: string
  description?: string
  onRetry: () => void
  retrying?: boolean
  compact?: boolean
}) {
  return (
    <div
      role="alert"
      aria-busy={retrying}
      className={cn(
        'flex flex-col justify-center gap-2 px-4 text-sm',
        compact ? 'items-start py-3 text-left' : 'min-h-40 items-center py-6 text-center',
      )}
    >
      <p className="font-medium">{message}</p>
      {description && (
        <p className="max-w-xl text-muted-foreground [overflow-wrap:anywhere]">{description}</p>
      )}
      <Button type="button" variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
        {retrying ? 'Retrying…' : 'Retry'}
      </Button>
    </div>
  )
}
