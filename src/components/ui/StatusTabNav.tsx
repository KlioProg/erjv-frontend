import { useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export type StatusTabAccent = 'green' | 'blue' | 'red' | 'amber' | 'primary'

export type StatusTab = {
  value: string
  label: string
  count?: number
  icon?: ReactNode
  accent?: StatusTabAccent
}

type StatusTabNavProps = {
  tabs: StatusTab[]
  activeTab: string
  onTabChange: (tab: string) => void
  className?: string
}

export function StatusTabNav({ tabs, activeTab, onTabChange, className = '' }: StatusTabNavProps) {
  const tabListRef = useRef<HTMLDivElement>(null)
  const tabButtonRefs = useRef(new Map<string, HTMLButtonElement>())
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const tabList = tabListRef.current
    const activeButton = tabButtonRefs.current.get(activeTab)
    if (!tabList || !activeButton) {
      setIndicator(null)
      return
    }

    const updateIndicator = () => {
      const listLeft = tabList.getBoundingClientRect().left
      const buttonRect = activeButton.getBoundingClientRect()
      if (buttonRect.width === 0) return

      const next = { left: buttonRect.left - listLeft, width: buttonRect.width }
      setIndicator((current) =>
        current?.left === next.left && current.width === next.width ? current : next,
      )
    }

    updateIndicator()
    if (typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(updateIndicator)
    observer.observe(tabList)
    for (const button of tabButtonRefs.current.values()) observer.observe(button)
    return () => observer.disconnect()
  }, [activeTab, tabs])

  return (
    <div className={`flex min-w-0 items-center overflow-x-auto ${className}`}>
      <div
        ref={tabListRef}
        className="relative inline-flex min-w-max items-center gap-1 rounded-lg bg-secondary p-1"
      >
        {indicator && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-1 left-0 z-20 rounded-md ring-1 ring-inset ring-primary-contrast/30 transition-[transform,width] duration-200 ease-out motion-reduce:transition-none"
            style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
          />
        )}
        {tabs.map((tab) => {
          const isSelected = tab.value === activeTab

          return (
            <button
              key={tab.value}
              ref={(element) => {
                if (element) tabButtonRefs.current.set(tab.value, element)
                else tabButtonRefs.current.delete(tab.value)
              }}
              type="button"
              aria-pressed={isSelected}
              data-state={isSelected ? 'active' : 'inactive'}
              onClick={() => onTabChange(tab.value)}
              className="navigation-tab group relative z-10 flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-ui transition-colors duration-150 pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tab.icon}
              <span
                className={`transition-[font-weight] duration-100 ease-out motion-reduce:transition-none ${isSelected ? 'font-semibold' : 'font-medium group-hover:font-semibold'}`}
              >
                {tab.label}
              </span>
              {tab.count !== undefined && (
                <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm bg-muted px-1 text-center text-xs font-medium leading-none tabular-nums text-foreground group-data-[state=active]:bg-primary-contrast group-data-[state=active]:text-primary-contrast-foreground">
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
