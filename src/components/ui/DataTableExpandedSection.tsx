import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function DataTableExpandedSection({
  id,
  title,
  ariaLabel,
  description,
  children,
  footer,
  isLoading = false,
  loadingContent = <p role="status">Loading records...</p>,
  isEmpty = false,
  emptyContent = <p className="text-muted-foreground">No records found.</p>,
  errorContent,
}: {
  id: string
  title: ReactNode
  ariaLabel?: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  isLoading?: boolean
  loadingContent?: ReactNode
  isEmpty?: boolean
  emptyContent?: ReactNode
  errorContent?: ReactNode
}) {
  return (
    <div
      id={id}
      role="region"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabel ? undefined : `${id}-heading`}
      className="data-table-expanded-section"
    >
      <h2 id={`${id}-heading`} className="[overflow-wrap:anywhere]">
        {title}
      </h2>
      {description && <p className="mb-2 text-xs text-muted-foreground">{description}</p>}
      {errorContent || (isLoading ? loadingContent : isEmpty ? emptyContent : children)}
      {!errorContent && !isLoading && footer != null && footer !== false && (
        <div className="mt-2 flex min-w-0 flex-wrap items-center justify-end gap-1 border-t border-border pt-2 text-right text-sm font-medium tabular-nums">
          {footer}
        </div>
      )}
    </div>
  )
}

export function DataTableExpandToggle({
  expanded,
  controls,
  ariaLabel,
  onToggle,
  disabled,
  children,
}: {
  expanded: boolean
  controls: string
  ariaLabel: string
  onToggle: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={ariaLabel}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      className="h-8 max-w-full gap-1 px-1.5 text-[13px] sm:px-2 pointer-coarse:min-h-11 aria-expanded:bg-secondary"
    >
      {children}
      <ChevronDown
        aria-hidden="true"
        className={`size-3.5 shrink-0 ${expanded ? 'rotate-180' : ''}`}
      />
    </Button>
  )
}
