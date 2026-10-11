import { createContext, useContext, type ComponentProps, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PageSummary = { label: string; value: ReactNode; hint: string }[]
const SummaryContext = createContext<PageSummary>([])

/** Keeps dashboard summaries below the page heading without passing props through each domain. */
export function ManagementPage({
  children,
  summary,
}: {
  children: ReactNode
  summary: PageSummary
}) {
  return (
    <SummaryContext.Provider value={summary}>
      <section className="ui-typography min-w-0">{children}</section>
    </SummaryContext.Provider>
  )
}

/** Shared management heading; business-specific controls stay with their page. */
export function PageHeader({
  children,
  description,
  id,
}: {
  children: ReactNode
  description?: ReactNode
  id?: string
}) {
  const summary = useContext(SummaryContext)
  return (
    <header className="ui-typography flex min-w-0 flex-col gap-1">
      <h1 id={id} className="text-lg font-bold leading-7 text-foreground">
        {children}
      </h1>
      {description && <p className="text-xs leading-5 text-muted-foreground">{description}</p>}
      {summary.length > 0 && (
        <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs leading-5">
          {summary.map(({ label, value, hint }) => (
            <div key={label} className="flex items-baseline gap-2" title={hint}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  )
}

/** Wrapping, consistently sized controls without a decorative toolbar surface. */
export function PageToolbar({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'ui-typography management-toolbar flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end',
        className,
      )}
      {...props}
    />
  )
}
