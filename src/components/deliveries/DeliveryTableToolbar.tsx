import type { ReactNode } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { PageToolbar } from '@/components/ui/ManagementPage'
import { DataTableFooter, type DataTableFooterProps } from '@/components/ui/DataTableFooter'

export function DeliveryTableToolbar({
  search,
  onSearch,
  searchLabel,
  placeholder,
  filters,
  children,
}: {
  search: string
  onSearch: (value: string) => void
  searchLabel: string
  placeholder: string
  filters?: ReactNode
  children?: ReactNode
}) {
  return (
    <PageToolbar>
      <div className="relative w-full sm:w-80">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label={searchLabel}
          placeholder={placeholder}
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          className="h-9 pl-9 text-ui"
        />
      </div>
      {filters}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </PageToolbar>
  )
}

export function DeliveryPageFooter({
  query,
  count,
  unit = 'delivery',
  label = 'Delivery',
  source,
}: {
  query: Omit<DataTableFooterProps, 'label'>
  count: number
  unit?: string
  label?: string
  source?: string
}) {
  const noun = count === 1 ? unit : unit === 'delivery' ? 'deliveries' : `${unit}s`
  return (
    <DataTableFooter
      {...query}
      rowCount={count}
      label={label}
      summary={
        <span role="status">
          {source && <span className="font-medium text-foreground">{source}: </span>}
          {query.isError
            ? 'Records unavailable'
            : query.isFetching
              ? 'Loading records…'
              : `${count} ${noun} on this page`}
        </span>
      }
    />
  )
}
