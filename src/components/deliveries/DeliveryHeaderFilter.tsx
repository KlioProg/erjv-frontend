import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ListFilter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

export function DeliveryHeaderFilter({
  label,
  header = label,
  active,
  onClear,
  children,
}: {
  label: string
  header?: string
  active: boolean
  onClear: () => void
  children: ReactNode
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 16, left: 16, width: 288, maxHeight: 600 })
  useEffect(() => {
    if (!open) return
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(288, window.innerWidth - 32)
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
    <span className="inline-flex items-center gap-1">
      <span>{header}</span>
      <Dialog modal={false} open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            ref={trigger}
            variant="ghost"
            size="icon"
            aria-label={`Filter by ${label.toLowerCase()}`}
            aria-description={active ? 'Filter active' : undefined}
            title={`Filter by ${label.toLowerCase()}${active ? ' (active)' : ''}`}
            data-active={active || undefined}
            className={`size-7 shrink-0 pointer-coarse:size-11 ${active ? 'bg-accent text-foreground ring-1 ring-input' : 'text-muted-foreground'}`}
          >
            <ListFilter aria-hidden="true" />
            {active && <span className="sr-only">Active filter</span>}
          </Button>
        </DialogTrigger>
        <DialogContent style={{ ...position, transform: 'none' }} className="gap-3 p-4 shadow-md">
          <DialogHeader>
            <DialogTitle>Filter by {label.toLowerCase()}</DialogTitle>
            <DialogDescription className="sr-only">
              Choose a filter for this column.
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-3">{children}</div>
          <div className="flex items-center justify-between gap-2">
            <Button variant="ghost" size="sm" disabled={!active} onClick={onClear}>
              Clear {label.toLowerCase()}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </span>
  )
}
