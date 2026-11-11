import { useLayoutEffect, useRef, useState } from 'react'

export function SidebarActiveIndicator({
  active,
  routeKey,
  className,
  children,
}: {
  active: boolean
  routeKey?: string
  className: string
  children: React.ReactNode
}) {
  const itemsRef = useRef<HTMLDivElement>(null)
  const wasActiveRef = useRef(false)
  const [indicator, setIndicator] = useState<{
    left: number
    top: number
    width: number
    height: number
    animate: boolean
  } | null>(null)

  useLayoutEffect(() => {
    const items = itemsRef.current
    const activeLink = items?.querySelector<HTMLElement>(':scope > [aria-current="page"]')
    const animate = active && Boolean(activeLink) && wasActiveRef.current
    wasActiveRef.current = active && Boolean(activeLink)
    if (!active || !items || !activeLink) {
      setIndicator(null)
      return
    }

    const updateIndicator = () => {
      const itemsRect = items.getBoundingClientRect()
      const linkRect = activeLink.getBoundingClientRect()
      if (linkRect.width === 0 || linkRect.height === 0) {
        setIndicator(null)
        return
      }

      const next = {
        left: linkRect.left - itemsRect.left,
        top: linkRect.top - itemsRect.top,
        width: linkRect.width,
        height: linkRect.height,
        animate,
      }
      setIndicator((current) =>
        current &&
        current.left === next.left &&
        current.top === next.top &&
        current.width === next.width &&
        current.height === next.height &&
        current.animate === next.animate
          ? current
          : next,
      )
    }

    updateIndicator()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateIndicator)
    observer.observe(items)
    observer.observe(activeLink)
    return () => observer.disconnect()
  }, [active, routeKey])

  return (
    <div ref={itemsRef} className={`relative flex flex-col ${className}`}>
      {active && indicator && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-0 top-0 z-0 rounded-md bg-primary-subtle ring-1 ring-inset ring-primary-contrast/30 ${indicator.animate ? 'transition-[transform,width,height] duration-200 ease-out motion-reduce:transition-none' : 'transition-none'}`}
          style={{
            width: indicator.width,
            height: indicator.height,
            transform: `translate(${indicator.left}px, ${indicator.top}px)`,
          }}
        />
      )}
      {children}
    </div>
  )
}