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
      <div className="inline-flex min-w-max items-center gap-1 rounded-lg bg-secondary p-1">
        {tabs.map((tab) => {
          const isSelected = tab.value === activeTab

          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={isSelected}
              data-state={isSelected ? 'active' : 'inactive'}
              onClick={() => onTabChange(tab.value)}
              className="navigation-tab group flex min-h-9 cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-ui font-medium transition-colors duration-150 pointer-coarse:min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-sm bg-muted px-1 text-center text-xs font-medium leading-none tabular-nums text-foreground group-data-[state=active]:bg-primary-contrast group-data-[state=active]:text-primary-contrast-foreground">
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
