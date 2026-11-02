import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ListFilter, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { CursorPageControls } from '@/components/ui/CursorPageControls'

export function DeliveryTableToolbar({
  search,
  onSearch,
  searchLabel,
  placeholder,
  primaryFilter,
  filters,
  activeCount,
  onClear,
}: {
  search: string
  onSearch: (value: string) => void
  searchLabel: string
  placeholder: string
  primaryFilter: ReactNode
  filters: ReactNode
  activeCount: number
  onClear: () => void
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 16, left: 16, width: 320, maxHeight: 600 })
  useEffect(() => {
    if (!open) return
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(384, window.innerWidth - 32)
      const top = Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - 240))
      setPosition({
        width,
        top,
        left: Math.max(16, Math.min(rect.right - width, window.innerWidth - width - 16)),
        maxHeight: window.innerHeight - top - 16,
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])
  return (
    <div className="flex flex-wrap items-end gap-3 border-b p-3">
      <div className="relative min-w-0 flex-1 basis-52">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          aria-label={searchLabel}
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="h-10 pl-9"
        />
      </div>
      <div className="min-w-40">{primaryFilter}</div>
      <Dialog modal={false} open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button ref={trigger} variant="outline" className="h-10">
            <ListFilter aria-hidden="true" />
            Filters
            {activeCount > 0 && (
              <span className="rounded bg-muted px-1.5 tabular-nums">{activeCount}</span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent style={{ ...position, transform: 'none' }} className="gap-4 p-4">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
            <DialogDescription className="sr-only">
              Refine the records shown in this table.
            </DialogDescription>
          </DialogHeader>
          <div data-delivery-filters className="grid gap-4">
            {filters}
          </div>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogContent>
      </Dialog>
      {activeCount > 0 && (
        <Button variant="ghost" className="h-10" onClick={onClear}>
          Clear filters
        </Button>
      )}
    </div>
  )
}

export function DeliveryPageFooter({
  query,
  count,
  unit = 'delivery',
  label = 'Delivery',
}: {
  query: Omit<Parameters<typeof CursorPageControls>[0], 'label'>
  count: number
  unit?: string
  label?: string
}) {
  const controls = query.hasNext || query.hasPrevious || count > 10 || query.pageSize !== 50
  const noun = count === 1 ? unit : unit === 'delivery' ? 'deliveries' : `${unit}s`
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 border-t px-3 py-1 text-sm tabular-nums">
      <p className="py-2 text-muted-foreground" role="status">
        {query.isError
          ? 'Records unavailable'
          : query.isFetching
            ? 'Loading records…'
            : `${count} ${noun} on this page`}
      </p>
      {controls && <CursorPageControls {...query} label={label} />}
    </div>
  )
}
