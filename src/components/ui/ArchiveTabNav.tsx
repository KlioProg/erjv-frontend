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
  const hasArchivedItems = archivedCount > 0

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Segmented Tab Bar */}
      <div className="flex items-center gap-2 border-b border-border/70 pb-3">
        <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-muted/60 border border-border/70 shadow-2xs">
          {/* Active Tab Button */}
          <button
            type="button"
            onClick={() => onTabChange('ACTIVE')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer select-none ${
              !isArchiveSelected
                ? 'bg-background text-foreground shadow-2xs border border-border/60'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            {activeIcon}
            <span>{activeLabel}</span>
            <span
              className={`ml-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold transition-colors ${
                !isArchiveSelected
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {activeCount}
            </span>
          </button>

          {/* Archived Tab Button */}
          <button
            type="button"
            onClick={() => onTabChange('ARCHIVED')}
            className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer select-none ${
              isArchiveSelected
                ? 'bg-background text-foreground shadow-2xs border border-border/60 ring-1 ring-amber-500/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
            }`}
          >
            <span
              className={
                hasArchivedItems
                  ? 'text-[#f2bb05] dark:text-[#f2bb05] group-hover:scale-110 transition-transform'
                  : ''
              }
            >
              {archivedIcon}
            </span>
            <span>{archivedLabel}</span>
            <span
              className={`ml-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold transition-all ${
                hasArchivedItems
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shadow-2xs'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {archivedCount}
            </span>
          </button>
        </div>
      </div>

      {/* Informative Context Banner when on Archived tab */}
      {showBanner && isArchiveSelected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-[#f2bb05] dark:text-[#f2bb05] text-xs shadow-2xs animate-in fade-in-0 duration-200">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-[#f2bb05] dark:text-[#f2bb05]">
              <Archive className="size-3.5" />
            </div>
            <div>
              <span className="font-bold text-foreground">Archived Records Directory</span>
              <span className="text-muted-foreground ml-1.5">
                {bannerDescription ||
                  `Showing ${archivedCount} archived record${archivedCount === 1 ? '' : 's'}. You can restore records to the active view anytime using the Reactivate action.`}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onTabChange('ACTIVE')}
            className="h-7 px-2.5 text-xs font-bold text-[#f2bb05] dark:text-[#f2bb05] hover:bg-amber-500/20 rounded-xl cursor-pointer self-end sm:self-auto gap-1 shrink-0"
          >
            <ArrowLeft className="size-3.5" />
            Back to Active
          </Button>
        </div>
      )}
    </div>
  )
}
