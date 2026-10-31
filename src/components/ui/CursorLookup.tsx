import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
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
  const [open, setOpen] = useState(false)
  const [remembered, setRemembered] = useState<T>()
  const query = useCursorLookup<T>(
    path,
    { ...filter, ...(q.trim() ? { q: q.trim() } : {}) },
    open && !disabled,
  )
  const local =
    query.items.find((record) => String(record.id) === value) ??
    (String(remembered?.id) === value ? remembered : undefined)
  const resource = path.split('/')[1]
  const selected = useQuery({
    queryKey: [
      ['employees', 'users', 'jobs'].includes(resource)
        ? 'staffing'
        : resource === 'inventory-items'
          ? 'products'
          : resource,
      'lookup-selected',
      resource,
      value,
    ],
    enabled: Boolean(value && !local && !selectedLabel),
    retry: false,
    queryFn: async ({ signal }) => {
      const { data } = await apiClient.get<T>(`/${resource}/${value}`, { signal })
      if (String(data?.id) !== value) throw Error('The selected record is no longer available.')
      return data
    },
  })
  const selectedRecord = local ?? selected.data
  return (
    <SearchableDropdown
      id={id}
      options={accept ? query.items.filter(accept) : query.items}
      value={value}
      onValueChange={(id, record) => {
        setRemembered(record)
        onChange(id, record)
      }}
      getOptionValue={(record) => String(record.id)}
      getOptionLabel={getLabel}
      selectedLabel={
        value
          ? (selectedLabel ?? (selectedRecord ? getLabel(selectedRecord) : `Selected #${value}`))
          : undefined
      }
      className={className}
      placeholder={`Choose ${label.toLowerCase()}`}
      searchPlaceholder={searchPlaceholder ?? `Search ${label.toLowerCase()}`}
      emptyMessage={query.isPending ? 'Loading results…' : 'No matching results.'}
      ariaLabel={ariaLabel ?? `Choose ${label.toLowerCase()}`}
      error={error}
      disabled={disabled}
      onSearchChange={setQ}
      onOpenChange={setOpen}
      footer={
        <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
          {selected.isError && (
            <p role="alert">
              Selected record unavailable.{' '}
              <Button
                type="button"
                variant="link"
                size="sm"
                onClick={() => void selected.refetch()}
              >
                Retry selected record
              </Button>
            </p>
          )}
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
