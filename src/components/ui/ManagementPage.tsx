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
    <header className="flex min-w-0 flex-col gap-2 pb-2">
      <h1 id={id} className="text-[22px] font-semibold leading-8 tracking-tight text-foreground">
        {children}
      </h1>
      {description && (
        <p className="max-w-3xl text-ui leading-5 text-muted-foreground">{description}</p>
      )}
      {summary.length > 0 && (
        <dl className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {summary.map(({ label, value, hint }) => (
            <div
              key={label}
              className="flex flex-col gap-1 rounded-lg border bg-card px-4 py-3"
              title={hint}
            >
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-2xl font-semibold leading-8 tabular-nums text-foreground">
                {value}
              </dd>
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
        'management-toolbar flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
      {...props}
    />
  )
}
