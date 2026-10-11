import type { ReactNode } from 'react'

export type StatusTabAccent = 'green' | 'blue' | 'red' | 'amber' | 'primary'

export type StatusTab = {
  value: string
  label: string
  count: number
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
  return (
    <div className={`flex min-w-0 items-center overflow-x-auto ${className}`}>
      <div className="inline-flex min-w-max items-center gap-1 rounded-lg bg-muted/60 p-1">
        {tabs.map((tab) => {
          const isSelected = tab.value === activeTab

          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={isSelected}
              data-state={isSelected ? 'active' : 'inactive'}
              onClick={() => onTabChange(tab.value)}
              className="navigation-tab flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground">
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
