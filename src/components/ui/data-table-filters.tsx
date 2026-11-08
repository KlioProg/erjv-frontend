import { useId, type ReactNode } from 'react'
import { ListFilter, X } from 'lucide-react'
import { Button } from './button'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from './dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from './select'
import { Label } from './label'

export type DataTableFilter = { id: string; label: string } & (
  | {
      kind: 'select'
      value: string
      emptyValue?: string
      options: { value: string; label: string }[]
      onChange: (value: string) => void
    }
  | {
      kind: 'custom'
      active: boolean
      onClear: () => void
      content: ReactNode
      valueLabel?: string
    }
)

function active(filter: DataTableFilter) {
  return filter.kind === 'select' ? filter.value !== (filter.emptyValue ?? 'ALL') : filter.active
}
function clear(filter: DataTableFilter) {
  if (filter.kind === 'select') filter.onChange(filter.emptyValue ?? 'ALL')
  else filter.onClear()
}

/** Presentation only: pages own query scope, filtering, and cursor resets. */
export function DataTableFilters({
  filters,
  description,
}: {
  filters: DataTableFilter[]
  description?: string
}) {
  const id = useId()
  const count = filters.filter(active).length
  if (!filters.length) return null
  return (
    <Dialog modal={false}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Filters"
          data-table-filter-trigger=""
          data-active={count > 0 || undefined}
        >
          <ListFilter aria-hidden="true" />
          Filters{count > 0 && ` (${count})`}
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription>
            {description || 'Choose filters to find the records you need.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          {filters.map((filter) => (
            <section
              key={filter.id}
              aria-label={filter.label}
              className="flex min-w-0 flex-col gap-2"
            >
              {filter.kind === 'select' ? (
                <>
                  <Label htmlFor={`${id}-${filter.id}`}>{filter.label}</Label>
                  <Select value={filter.value} onValueChange={filter.onChange}>
                    <SelectTrigger id={`${id}-${filter.id}`} aria-label={filter.label}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {filter.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </>
              ) : (
                filter.content
              )}
            </section>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!count}
            onClick={() => filters.filter(active).forEach(clear)}
          >
            Clear All
          </Button>
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm">
              Done
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function DataTableFilterChips({ filters }: { filters: DataTableFilter[] }) {
  const selected = filters.filter(active)
  if (!selected.length) return null
  return (
    <div role="region" aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      {selected.map((filter) => {
        const value =
          filter.kind === 'select'
            ? filter.options.find((option) => option.value === filter.value)?.label
            : filter.valueLabel
        return (
          <Button
            key={filter.id}
            type="button"
            size="sm"
            variant="secondary"
            aria-label={`Clear ${filter.label.toLowerCase()}`}
            onClick={() => clear(filter)}
          >
            {filter.label}
            {value && `: ${value}`}
            <X aria-hidden="true" />
          </Button>
        )
      })}
      <Button type="button" size="sm" variant="outline" onClick={() => selected.forEach(clear)}>
        Clear All
      </Button>
    </div>
  )
}
