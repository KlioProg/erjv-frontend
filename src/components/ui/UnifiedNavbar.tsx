import { type ReactNode } from 'react'
import { Archive, ArrowLeft } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

export type NavBadgeVariant = 'default' | 'primary' | 'amber' | 'destructive' | 'secondary'

export interface NavTabItem<T extends string = string> {
  value: T
  label: string
  icon?: ReactNode
  count?: number | string
  badgeVariant?: NavBadgeVariant
  badgeClassName?: string
  title?: string
}

export interface NavTabGroup<T extends string = string> {
  id?: string
  value: T
  onChange: (value: T) => void
  tabs: NavTabItem<T>[]
}

export interface UnifiedNavbarProps<T extends string> {
  groups: NavTabGroup<T>[]
  className?: string
  containerClassName?: string
  extraRight?: ReactNode
}

export function UnifiedNavbar<T extends string>({
  groups,
  className,
  containerClassName,
  extraRight,
}: UnifiedNavbarProps<T>) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/70',
        className,
      )}
    >
      {/* Unified Single Navbar Container */}
      <div
        className={cn(
          'inline-flex min-w-0 items-center gap-1 p-1 rounded-lg bg-secondary overflow-x-auto max-w-full',
          containerClassName,
        )}
      >
        {groups.map((group, groupIdx) => {
          const isLastGroup = groupIdx === groups.length - 1

          return (
            <div key={group.id ?? `group-${groupIdx}`} className="flex items-center gap-1.5">
              {group.tabs.map((tab) => {
                const isSelected = group.value === tab.value

                return (
                  <button
                    key={tab.value}
                    type="button"
                    title={tab.title}
                    aria-pressed={isSelected}
                    data-state={isSelected ? 'active' : 'inactive'}
                    onClick={() => group.onChange(tab.value)}
                    className={cn(
                      'navigation-tab flex min-h-9 items-center gap-2 px-3 py-2 rounded-md text-ui font-medium transition-colors duration-150 pointer-coarse:min-h-11 cursor-pointer select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    )}
                  >
                    {tab.icon && (
                      <span
                        className={cn(
                          'shrink-0 transition-colors',
                          isSelected ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {tab.icon}
                      </span>
                    )}

                    <span>{tab.label}</span>

                    {tab.count !== undefined && (
                      <span className="ml-1 px-2 py-0.5 rounded-sm bg-muted text-foreground text-xs font-medium transition-colors">
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}

              {/* Subtle Divide Line between groups */}
              {!isLastGroup && (
                <div
                  className="h-4 w-px bg-border/80 mx-1 shrink-0 self-center"
                  aria-hidden="true"
                />
              )}
            </div>
          )
        })}
      </div>

      {extraRight && <div className="flex items-center gap-2 shrink-0">{extraRight}</div>}
    </div>
  )
}

export interface ArchiveNoticeBannerProps {
  count?: number
  entityName?: string
  description?: string
  onBackToActive: () => void
  className?: string
}

export function ArchiveNoticeBanner({
  count,
  entityName = 'records',
  description,
  onBackToActive,
  className,
}: ArchiveNoticeBannerProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-lg bg-secondary text-muted-foreground text-ui',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center text-muted-foreground">
          <Archive className="size-4" />
        </div>
        <div>
          <span className="font-medium text-foreground">Archived Records Directory</span>
          <span className="text-muted-foreground ml-2 leading-5">
            {description ||
              `Showing ${count !== undefined ? count : ''} archived ${entityName}. Historical stock records and transaction history are safely preserved and can be reactivated anytime.`}
          </span>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onBackToActive}
        className="self-end sm:self-auto shrink-0 text-ui"
      >
        <ArrowLeft className="size-3.5" />
        Back to Active
      </Button>
    </div>
  )
}
