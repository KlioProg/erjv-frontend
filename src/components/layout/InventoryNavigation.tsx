import { useId, useState } from 'react'
import { Boxes, ChevronDown } from 'lucide-react'
import { NavLink } from 'react-router'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/routes'

export function InventoryNavigation({
  view,
  onSelect,
}: {
  view: 'products' | 'quarantine' | null
  onSelect: () => void
}) {
  const id = useId()
  const [expanded, setExpanded] = useState(!!view)
  const [previous, setPrevious] = useState(view)
  if (previous !== view) {
    setPrevious(view)
    if (view) setExpanded(true)
  }
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'ui-text flex h-9 w-full items-center justify-between rounded-md px-3 py-2 font-medium transition-[color,font-weight,background-color] duration-150 motion-reduce:transition-none hover:bg-muted/60 hover:font-semibold focus-visible:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          view ? 'text-foreground font-semibold' : 'text-muted-foreground',
        )}
      >
        <span className="flex items-center gap-3">
          <Boxes aria-hidden="true" className="size-4" />
          Inventory
        </span>
        <ChevronDown aria-hidden="true" className={cn('size-4', !expanded && '-rotate-90')} />
      </button>
      <div id={id} hidden={!expanded} className="ml-7 flex flex-col gap-1">
        {[
          { path: ROUTES.inventory, label: 'Products & Stock' },
          { path: ROUTES.quarantinedStock, label: 'Quarantined Stock' },
        ].map((link) => (
          <NavLink
            key={link.path}
            to={link.path}
            end
            onClick={onSelect}
            className={({ isActive }) =>
              cn(
                'ui-text relative z-10 flex h-9 items-center rounded-md px-3 py-2 font-medium transition-[color,font-weight,background-color] duration-150 motion-reduce:transition-none hover:font-semibold focus-visible:font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'text-foreground font-semibold'
                  : 'text-muted-foreground hover:bg-muted/60',
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </div>
    </div>
  )
}
