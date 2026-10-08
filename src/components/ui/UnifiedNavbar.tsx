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
          'inline-flex min-w-0 items-center gap-1.5 p-1 rounded-lg bg-muted/60 border border-border/70 shadow-2xs overflow-x-auto max-w-full',
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
                    onClick={() => group.onChange(tab.value)}
                    className={cn(
                      'flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isSelected
                        ? 'bg-primary-selected text-primary shadow-2xs border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
                    )}
                  >
                    {tab.icon && (
                      <span
                        className={cn(
                          'shrink-0 transition-colors',
                          isSelected ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {tab.icon}
                      </span>
                    )}

                    <span>{tab.label}</span>

                    {tab.count !== undefined && (
                      <span
                        className={cn(
                          'ml-0.5 px-2 py-0.5 rounded-full text-[11px] font-extrabold transition-colors',
                          tab.badgeVariant === 'destructive'
                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                            : tab.badgeVariant === 'amber'
                              ? 'bg-amber-500/15 text-amber-600 dark:text-[#ffb627] border border-amber-500/30'
                              : isSelected
                                ? 'bg-primary-subtle text-primary'
                                : 'bg-muted text-muted-foreground',
                          tab.badgeClassName,
                        )}
                      >
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
        'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-lg bg-amber-500/[0.06] dark:bg-amber-500/[0.1] border border-amber-500/25 text-foreground text-xs shadow-2xs animate-in fade-in-0 duration-200',
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-[#ffb627] shadow-2xs">
          <Archive className="size-4" />
        </div>
        <div>
          <span className="font-bold text-foreground">Archived Records Directory</span>
          <span className="text-foreground/75 dark:text-foreground/80 ml-1.5 leading-normal">
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
        className="group h-7.5 px-3 text-xs font-bold text-foreground hover:text-amber-600 dark:hover:text-[#ffb627] hover:bg-amber-500/15 bg-background/90 border-border/70 hover:border-amber-500/30 rounded-md cursor-pointer self-end sm:self-auto gap-1.5 shrink-0 transition-all duration-150 active:scale-95 shadow-2xs"
      >
        <ArrowLeft className="size-3.5 transition-transform duration-200 group-hover:-translate-x-1" />
        Back to Active
      </Button>
    </div>
  )
}
