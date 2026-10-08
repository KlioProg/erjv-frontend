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
    <div className={`flex items-center gap-2 overflow-x-auto pb-3 ${className}`}>
      <div className="inline-flex min-w-max items-center gap-1.5 rounded-lg border-border/70 bg-muted/60 p-1 shadow-2xs">
        {tabs.map((tab) => {
          const isSelected = tab.value === activeTab

          return (
            <button
              key={tab.value}
              type="button"
              aria-pressed={isSelected}
              data-state={isSelected ? 'active' : 'inactive'}
              onClick={() => onTabChange(tab.value)}
              className="navigation-tab flex cursor-pointer select-none items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 data-[state=active]:shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className="ml-0.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-extrabold text-foreground">
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
