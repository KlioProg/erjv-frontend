import { useState } from 'react'
import { SearchableDropdown } from './SearchableDropdown'
import { Button } from './button'
import { getErrorMessage } from '@/lib/api-client'
import { useCursorLookup } from '@/lib/use-cursor-lookup'

export function CursorLookup<T extends { id: number }>({
  id,
  path,
  filter = {},
  value,
  onChange,
  label,
  getLabel,
  disabled,
  accept,
  selectedLabel,
  ariaLabel,
  searchPlaceholder,
  className,
  error,
}: {
  id: string
  path: string
  filter?: Record<string, unknown>
  value: string
  onChange: (value: string, record: T) => void
  label: string
  getLabel: (record: T) => string
  disabled?: boolean
  accept?: (record: T) => boolean
  selectedLabel?: string
  ariaLabel?: string
  searchPlaceholder?: string
  className?: string
  error?: string
}) {
  const [q, setQ] = useState('')
  const query = useCursorLookup<T>(path, { ...filter, ...(q.trim() ? { q: q.trim() } : {}) })
  return (
    <SearchableDropdown
      id={id}
      options={accept ? query.items.filter(accept) : query.items}
      value={value}
      onValueChange={onChange}
      getOptionValue={(record) => String(record.id)}
      getOptionLabel={getLabel}
      selectedLabel={value ? (selectedLabel ?? `Selected #${value}`) : undefined}
      className={className}
      placeholder={`Choose ${label.toLowerCase()}`}
      searchPlaceholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
      emptyMessage={query.isPending ? 'Loading results…' : 'No matching results.'}
      ariaLabel={ariaLabel ?? `Choose ${label.toLowerCase()}`}
      error={error}
      disabled={disabled}
      onSearchChange={setQ}
      footer={
        <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
          {query.isError && <p role="alert">{getErrorMessage(query.error)}</p>}
          {query.isError && (
            <Button type="button" size="sm" variant="outline" onClick={() => void query.reload()}>
              Reload results
            </Button>
          )}
          {query.hasNextPage && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={query.isFetching}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetching ? 'Loading…' : 'Load more results'}
            </Button>
          )}
        </div>
      }
    />
  )
}
