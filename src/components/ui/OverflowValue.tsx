import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type OverflowValueProps = {
  value: unknown
  fullValue?: unknown
  className?: string
  tooltipSuffix?: string
  onActivate?: () => void
}

/** Keeps the full value in the DOM and reveals it on hover, focus, or touch when clipped. */
export function OverflowValue({ value, fullValue, className, tooltipSuffix, onActivate }: OverflowValueProps) {
  const text = value == null || value === '' ? '—' : String(value)
  const fullText = fullValue == null || fullValue === '' ? text : String(fullValue)
  const hasHiddenOriginal = text === '—' && fullText !== text
  const tooltipText = tooltipSuffix ? `${fullText} ${tooltipSuffix}` : fullText
  const ref = useRef<HTMLElement | null>(null)
  const id = useId()
  const [clipped, setClipped] = useState(false)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ left: number; top?: number; bottom?: number }>({ left: 8, top: 8 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => setClipped(element.scrollWidth > element.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [text])

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const show = () => {
    const element = ref.current
    if (!element || (!clipped && !hasHiddenOriginal)) return
    const rect = element.getBoundingClientRect()
    const width = Math.min(448, window.innerWidth - 16)
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - width - 8)
    setPosition(rect.bottom + 80 < window.innerHeight
      ? { left, top: rect.bottom + 8 }
      : { left, bottom: window.innerHeight - rect.top + 8 })
    setOpen(true)
  }

  const common = {
    'aria-describedby': open ? id : undefined,
    onPointerEnter: show,
    onPointerLeave: () => {
      if (document.activeElement !== ref.current) setOpen(false)
    },
    onPointerDown: (event: React.PointerEvent) => {
      if (event.pointerType === 'touch') show()
    },
    onFocus: show,
    onBlur: () => setOpen(false),
  }
  const textClass = cn('block min-w-0 max-w-full truncate', className)

  return (
    <>
      {onActivate ? (
        <Button
          ref={(element) => { ref.current = element }}
          type="button"
          variant="link"
          onClick={onActivate}
          aria-label={fullText}
          className={textClass}
          {...common}
        >
          {text}
        </Button>
      ) : (
        <span
          ref={(element) => { ref.current = element }}
          tabIndex={clipped || hasHiddenOriginal ? 0 : undefined}
          aria-label={clipped || hasHiddenOriginal ? tooltipText : undefined}
          className={cn(textClass, (clipped || hasHiddenOriginal) && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2')}
          {...common}
        >
          {text}
        </span>
      )}
      {open && (clipped || hasHiddenOriginal) && typeof document !== 'undefined' && createPortal(
        <div
          id={id}
          role="tooltip"
          className="pointer-events-none fixed z-[100] max-h-[50vh] max-w-[calc(100vw-1rem)] overflow-y-auto break-all rounded-lg border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg"
          style={{ ...position, width: 'max-content', maxWidth: 'min(28rem, calc(100vw - 1rem))' }}
        >
          {tooltipText}
        </div>,
        document.body,
      )}
    </>
  )
}
