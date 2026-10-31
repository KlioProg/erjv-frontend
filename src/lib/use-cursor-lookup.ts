import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { fetchCursorPage } from './cursor-pagination'

export type LookupPage<T> = { items: T[]; nextCursor: string | null }

export function useCursorLookup<T extends { id: number }>(
  path: string,
  filter: Record<string, unknown> = {},
  enabled = true,
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
  ]
  const query = useInfiniteQuery({
    queryKey: key,
    enabled,
    initialPageParam: undefined as string | undefined,
    retry: false,
    queryFn: async ({ pageParam, signal }) => {
      const page = await fetchCursorPage<T>(
        path,
        { ...filter, limit: 50, cursor: pageParam },
        signal,
      )
      const cached = client.getQueryData<InfiniteData<LookupPage<T>>>(key)
      const index = cached?.pageParams.indexOf(pageParam) ?? -1
      const preceding = index < 0 ? cached?.pages : cached?.pages.slice(0, index)
      if (page.nextCursor && preceding?.some((previous) => previous.nextCursor === page.nextCursor))
        throw Error('The server repeated a cursor. Reload results before continuing.')
      return page
    },
    getNextPageParam: (page, pages) =>
      pages.slice(0, -1).some((previous) => previous.nextCursor === page.nextCursor)
        ? undefined
        : (page.nextCursor ?? undefined),
  })
  const items = [
    ...new Map(
      query.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item]) ?? [],
    ).values(),
  ]
  return { ...query, items, reload: () => client.resetQueries({ queryKey: key, exact: true }) }
}
