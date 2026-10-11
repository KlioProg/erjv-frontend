import { useState } from 'react'
import { ChevronDown, MapPinned } from 'lucide-react'
import type { DeliveryView } from '@/features/logistics/delivery-workflow'
import { cn } from '@/lib/utils'

const links: { view: DeliveryView; label: string }[] = [
  { view: 'incoming', label: 'Incoming' },
  { view: 'outgoing', label: 'Outgoing' },
  { view: 'history', label: 'History' },
]

export function DeliveryNavigation({
  view,
  onSelect,
}: {
  view: DeliveryView | null
  onSelect: (view: DeliveryView) => void
}) {
  const [expanded, setExpanded] = useState(!!view)
  const [previousView, setPreviousView] = useState(view)
  // A navigation change opens its selected child; manual collapse still works.
  if (previousView !== view) {
    setPreviousView(view)
    if (view) setExpanded(true)
  }
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls="delivery-navigation"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md px-3 py-2 text-xs font-semibold transition-colors duration-150 pointer-coarse:min-h-11 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          view ? 'text-foreground' : 'text-muted-foreground',
        )}
      >
        <span className="flex items-center gap-3">
          <MapPinned className={cn('size-4 shrink-0', view && 'text-primary')} aria-hidden="true" />
          Deliveries
        </span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 transition-transform', !expanded && '-rotate-90')}
          aria-hidden="true"
        />
      </button>
      <div
        id="delivery-navigation"
        hidden={!expanded}
        className="relative ml-7 flex flex-col gap-0.5 before:absolute before:inset-y-1 before:-left-2 before:w-px before:bg-border"
      >
        {links.map((link) => (
          <button
            key={link.view}
            type="button"
            aria-current={view === link.view ? 'page' : undefined}
            onClick={() => onSelect(link.view)}
            className={cn(
              'flex h-9 w-full items-center rounded-md px-3 py-2 text-left text-xs font-medium transition-colors duration-150 pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              view === link.view
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {link.label}
          </button>
        ))}
      </div>
    </div>
  )
}
