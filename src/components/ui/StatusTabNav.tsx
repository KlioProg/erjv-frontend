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

const selectedClasses: Record<StatusTabAccent, string> = {
  green: 'bg-background text-emerald-600 border-emerald-500/30 ring-1 ring-emerald-500/20',
  blue: 'bg-background text-blue-600 border-blue-500/30 ring-1 ring-blue-500/20',
  red: 'bg-background text-rose-600 border-rose-500/30 ring-1 ring-rose-500/20',
  amber: 'bg-background text-amber-600 border-amber-500/30 ring-1 ring-amber-500/20',
  primary: 'bg-background text-foreground border-border/60',
}

const countClasses: Record<StatusTabAccent, string> = {
  green: 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/25',
  blue: 'bg-blue-500/15 text-blue-600 border border-blue-500/25',
  red: 'bg-rose-500/15 text-rose-600 border border-rose-500/25',
  amber: 'bg-amber-500/15 text-amber-600 border border-amber-500/25',
  primary: 'bg-primary/10 text-primary',
}

export function StatusTabNav({ tabs, activeTab, onTabChange, className = '' }: StatusTabNavProps) {
  return (
    <div className={`flex items-center gap-2 overflow-x-auto pb-3 ${className}`}>
      <div className="inline-flex min-w-max items-center gap-1.5 rounded-2xl border-border/70 bg-muted/60 p-1 shadow-2xs">
        {tabs.map((tab) => {
          const isSelected = tab.value === activeTab
          const accent = tab.accent || 'primary'

          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => onTabChange(tab.value)}
              className={`flex cursor-pointer select-none items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-150 active:scale-95 ${
                isSelected
                  ? `${selectedClasses[accent]} border shadow-2xs`
                  : 'text-muted-foreground hover:bg-background/40 hover:text-foreground'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span
                className={`ml-0.5 rounded-full px-2 py-0.5 text-[11px] font-extrabold ${
                  isSelected ? countClasses[accent] : 'bg-muted text-muted-foreground'
                }`}
              >
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
