import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

export type DataTableFooterProps = {
  label?: string
  page: number
  pageSize: number
  pageSizeOptions?: number[]
  setPageSize: (size: number) => void
  hasPrevious: boolean
  hasNext: boolean
  previous: () => void
  next: () => void
  isFetching: boolean
  isError: boolean
  /** Accepted for existing callers; counts never control footer visibility. */
  rowCount?: number
  summary?: ReactNode
}

export function DataTableFooter({
  label = 'Order',
  page,
  pageSize,
  pageSizeOptions = [10, 25, 50, 100],
  setPageSize,
  hasPrevious,
  hasNext,
  previous,
  next,
  isFetching,
  isError,
  summary,
}: DataTableFooterProps) {
  return (
    <nav
      data-table-footer
      aria-label={`${label} pages`}
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t bg-card px-3 py-2 text-sm tabular-nums"
    >
      {summary && <div className="min-w-0 text-muted-foreground">{summary}</div>}
      <div className="ml-auto flex flex-wrap items-center justify-end gap-2 sm:gap-3">
        <span className="text-muted-foreground">Rows</span>
        <Select
          value={String(pageSize)}
          onValueChange={(value) => setPageSize(Number(value))}
          disabled={isFetching}
        >
          <SelectTrigger
            aria-label="Rows per page"
            className="h-8 w-[4.5rem] pointer-coarse:min-h-11"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span
          aria-live="polite"
          aria-atomic="true"
          className="whitespace-nowrap text-muted-foreground"
        >
          Page {page}
          <span className="sr-only">{isFetching ? ' - Loading...' : ''}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 pointer-coarse:size-11"
            aria-label="Previous page"
            title="Previous page"
            disabled={!hasPrevious || isFetching}
            onClick={previous}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 pointer-coarse:size-11"
            aria-label="Next page"
            title="Next page"
            disabled={!hasNext || isFetching || isError}
            onClick={next}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </nav>
  )
}

/** Keeps external cursor controls attached through loading, empty and error states. */
export function DataTableFrame({ children }: { children: ReactNode }) {
  return (
    <div
      data-table-frame
      className="min-w-0 overflow-hidden rounded-lg border bg-card [&>div:not([role=alert])]:rounded-none [&>div:not([role=alert])]:border-0"
    >
      {children}
    </div>
  )
}
