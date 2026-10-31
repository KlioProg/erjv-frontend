import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCursorPage, type CursorPage, type CursorParams } from './cursor-pagination'

export function useCursorPage<T extends { id: number }, F extends CursorParams>(
  resource: string | readonly string[],
  filter: F,
  fetchPage: (filter: F, signal?: AbortSignal) => Promise<CursorPage<T>>,
  enabled = true,
  resetScope?: unknown,
) {
  const [pageSize, setPageSize] = useState(50)
  const scope = JSON.stringify([filter, pageSize, resetScope])
  const initial = { scope, cursors: [undefined] as (string | undefined)[], index: 0 }
  const [navigation, setNavigation] = useState(initial)
  const current = navigation.scope === scope ? navigation : initial
  if (navigation.scope !== scope) setNavigation(initial)
  const cursor = current.cursors[current.index]
  const query = useQuery({
    queryKey: [
      ...(typeof resource === 'string' ? [resource] : resource),
      'pages',
      filter,
      pageSize,
      cursor ?? null,
      resetScope ?? null,
    ],
    enabled,
    retry: false,
    queryFn: ({ signal }) => fetchPage({ ...filter, limit: pageSize, cursor }, signal),
  })
  const cursorCycle =
    query.data?.nextCursor != null &&
    current.cursors.slice(0, current.index + 1).includes(query.data.nextCursor)
  return {
    ...query,
    isError: query.isError || cursorCycle,
    error:
      query.error ??
      (cursorCycle
        ? Error('The server repeated a cursor. Reload results before continuing.')
        : null),
    items: query.data?.items ?? [],
    page: current.index + 1,
    pageSize,
    setPageSize,
    hasPrevious: current.index > 0,
    hasNext: query.data?.nextCursor != null && !query.isError && !cursorCycle,
    previous: () => {
      if (current.index > 0 && !query.isFetching)
        setNavigation({ ...current, index: current.index - 1 })
    },
    next: () => {
      if (query.data?.nextCursor && !query.isFetching && !query.isError && !cursorCycle)
        setNavigation({
          scope,
          cursors: [...current.cursors.slice(0, current.index + 1), query.data.nextCursor],
          index: current.index + 1,
        })
    },
    reload: () => {
      if (current.index === 0) return query.refetch()
      setNavigation(initial)
    },
  }
}

// Keep page queries under the mutation invalidation prefix used by each domain.
export function useResourcePage<T extends { id: number }>(
  path: string,
  filter: CursorParams & Record<string, unknown> = {},
  enabled = true,
  resetScope?: unknown,
) {
  const resource = path.split('/')[1]
  const key = ['employees', 'users', 'jobs'].includes(resource)
    ? ['staffing', resource]
    : [resource === 'inventory-items' ? 'products' : resource, path]
  return useCursorPage<T, CursorParams & Record<string, unknown>>(
    key,
    filter,
    (params, signal) => fetchCursorPage<T>(path, params, signal),
    enabled,
    resetScope,
  )
}
