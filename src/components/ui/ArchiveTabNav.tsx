import React from 'react'
import { Archive, ArrowLeft } from 'lucide-react'
import { Button } from './button'

export type ArchiveTabType = 'ACTIVE' | 'ARCHIVED'

export interface ArchiveTabNavProps {
  activeTab: ArchiveTabType
  onTabChange: (tab: ArchiveTabType) => void
  activeLabel: string
  activeCount: number
  archivedLabel?: string
  archivedCount: number
  activeIcon?: React.ReactNode
  archivedIcon?: React.ReactNode
  showBanner?: boolean
  bannerDescription?: string
  className?: string
}

export function ArchiveTabNav({
  activeTab,
  onTabChange,
  activeLabel,
  activeCount,
  archivedLabel = 'Archived',
  archivedCount,
  activeIcon,
  archivedIcon = <Archive className="size-3.5" />,
  showBanner = true,
  bannerDescription,
  className = '',
}: ArchiveTabNavProps) {
  const isArchiveSelected = activeTab === 'ARCHIVED'

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Segmented Tab Bar */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-lg bg-muted/60 border border-border/70 shadow-2xs">
          {/* Active Tab Button */}
          <button
            type="button"
            aria-pressed={!isArchiveSelected}
            data-state={!isArchiveSelected ? 'active' : 'inactive'}
            onClick={() => onTabChange('ACTIVE')}
            className="navigation-tab flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer select-none data-[state=active]:shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {activeIcon}
            <span>{activeLabel}</span>
            <span className="ml-0.5 px-2 py-0.5 rounded-full bg-muted text-foreground text-[11px] font-extrabold transition-colors">
              {activeCount}
            </span>
          </button>

          {/* Archived Tab Button */}
          <button
            type="button"
            aria-pressed={isArchiveSelected}
            data-state={isArchiveSelected ? 'active' : 'inactive'}
            onClick={() => onTabChange('ARCHIVED')}
            className="navigation-tab group flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer select-none data-[state=active]:shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span
              className={
                isArchiveSelected
                  ? 'text-foreground'
                  : archivedCount > 0
                    ? 'text-muted-foreground group-hover:scale-110 transition-transform'
                    : 'text-muted-foreground'
              }
            >
              {archivedIcon}
            </span>
            <span>{archivedLabel}</span>
            <span className="ml-0.5 px-2 py-0.5 rounded-full bg-muted text-foreground text-[11px] font-extrabold transition-colors">
              {archivedCount}
            </span>
          </button>
        </div>
      </div>

      {/* Informative Context Banner when on Archived tab */}
      {showBanner && isArchiveSelected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-lg bg-amber-500/[0.06] dark:bg-amber-500/[0.1] border border-amber-500/25 text-foreground text-xs shadow-2xs animate-in fade-in-0 duration-200">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-[#ffb627] shadow-2xs">
              <Archive className="size-4" />
            </div>
            <div>
              <span className="font-bold text-foreground">Archived Records Directory</span>
              <span className="text-foreground/75 dark:text-foreground/80 ml-1.5 leading-normal">
                {bannerDescription ||
                  `Showing ${archivedCount} archived record${archivedCount === 1 ? '' : 's'}. You can restore records to the active view anytime using the Reactivate action.`}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onTabChange('ACTIVE')}
            className="group h-7.5 px-3 text-xs font-bold text-foreground hover:text-amber-600 dark:hover:text-[#ffb627] hover:bg-amber-500/15 bg-background/90 border-border/70 hover:border-amber-500/30 rounded-md cursor-pointer self-end sm:self-auto gap-1.5 shrink-0 transition-all duration-150 active:scale-95 shadow-2xs"
          >
            <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
            Back to Active
          </Button>
        </div>
      )}
    </div>
  )
}
