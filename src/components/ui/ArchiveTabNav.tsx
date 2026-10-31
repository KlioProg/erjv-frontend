import React from 'react'
import { Archive, ArrowLeft } from 'lucide-react'
import { Button } from './button'
import { StatusTabNav } from './StatusTabNav'

export type ArchiveTabType = 'ACTIVE' | 'ARCHIVED'

export interface ArchiveTabNavProps {
  activeTab: ArchiveTabType
  onTabChange: (tab: ArchiveTabType) => void
  activeLabel: string
  activeCount?: number
  archivedLabel?: string
  archivedCount?: number
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
    <div className={`ui-typography flex flex-col gap-3 ${className}`}>
      <StatusTabNav
        activeTab={activeTab}
        onTabChange={(value) => onTabChange(value as ArchiveTabType)}
        tabs={[
          { value: 'ACTIVE', label: activeLabel, count: activeCount, icon: activeIcon },
          { value: 'ARCHIVED', label: archivedLabel, count: archivedCount, icon: archivedIcon },
        ]}
      />

      {/* Informative Context Banner when on Archived tab */}
      {showBanner && isArchiveSelected && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs leading-5 text-muted-foreground">
          <p className="min-w-0 flex-1">
            {bannerDescription ||
              `Showing ${archivedCount === undefined ? '' : `${archivedCount} `}archived record${archivedCount === 1 ? '' : 's'}. Use Reactivate to return a record to the active view.`}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onTabChange('ACTIVE')}
            className="shrink-0 text-xs pointer-coarse:min-h-11"
          >
            <ArrowLeft className="size-3.5" />
            Back to Active
          </Button>
        </div>
      )}
    </div>
  )
}
