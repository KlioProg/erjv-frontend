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
      className="flex flex-wrap items-center justify-end gap-3 text-sm"
    >
      <span aria-live="polite">
        Page {page}
        {isFetching ? ' - Loading...' : ''}
      </span>
      <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
        <SelectTrigger aria-label={`${label}s per page`} className="h-9 w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {[10, 25, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" disabled={!hasPrevious || isFetching} onClick={previous}>
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!hasNext || isFetching || isError}
        onClick={next}
      >
        Next
      </Button>
    </nav>
  )
}
