import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCursorPage } from './cursor-pagination'

export type LookupPage<T> = { items: T[]; nextCursor: string | null }

export function useCursorLookup<T extends { id: number }>(
  path: string,
  filter: Record<string, unknown> = {},
  enabled = true,
  resetScope?: unknown,
) {
  const client = useQueryClient()
  const resource = path.split('/')[1]
  const key = [
    ['employees', 'users', 'jobs'].includes(resource)
      ? 'staffing'
      : resource === 'inventory-items'
        ? 'products'
        : resource,
    'lookup',
    path,
    filter,
    ...(resetScope === undefined ? [] : [resetScope]),
  ]
  const query = useInfiniteQuery({
    queryKey: key,
    enabled,
    initialPageParam: undefined as string | undefined,
    retry: false,
    queryFn: ({ pageParam, signal }) =>
      fetchCursorPage<T>(
        path,
        { ...filter, limit: 50, cursor: pageParam },
        signal,
      ),
    getNextPageParam: (page, pages) =>
      pages.slice(0, -1).some((previous) => previous.nextCursor === page.nextCursor)
        ? undefined
        : (page.nextCursor ?? undefined),
  })
  const cursors = new Set<string>()
  const cycleIndex = query.data?.pages.findIndex((page) => {
    if (!page.nextCursor) return false
    if (cursors.has(page.nextCursor)) return true
    cursors.add(page.nextCursor)
    return false
  }) ?? -1
  const cursorCycle = cycleIndex >= 0
  const pages = cursorCycle ? query.data?.pages.slice(0, cycleIndex) : query.data?.pages
  const items = [
    ...new Map(
      pages?.flatMap((page) => page.items).map((item) => [item.id, item]) ?? [],
    ).values(),
  ]
  return {
    ...query,
    isError: query.isError || cursorCycle,
    error: query.error ?? (cursorCycle ? Error('The server repeated a cursor. Reload results before continuing.') : null),
    items,
    reload: () => client.resetQueries({ queryKey: key, exact: true }),
  }
}
