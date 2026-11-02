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

export function CursorPageControls({
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
}: {
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
}) {
  return (
    <nav
      aria-label={`${label} pages`}
      className="flex flex-wrap items-center justify-end gap-3 py-3 text-sm tabular-nums"
    >
      <span className="hidden text-muted-foreground sm:inline">Rows per page</span>
      <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
        <SelectTrigger aria-label={`${label}s per page`} className="h-9 w-20">
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
      <span aria-live="polite" aria-atomic="true" className="whitespace-nowrap text-muted-foreground">
        Page {page}
        <span className="sr-only">{isFetching ? ' - Loading...' : ''}</span>
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
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
          aria-label="Next page"
          title="Next page"
          disabled={!hasNext || isFetching || isError}
          onClick={next}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
