import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from './api-client'

export type LookupPage<T> = { items: T[]; nextCursor: string | null }

export function useCursorLookup<T extends { id: number }>(path: string, filter: Record<string, unknown> = {}, enabled = true) {
  const client = useQueryClient()
  const resource = path.split('/')[1]
  const key = [['employees', 'users', 'jobs'].includes(resource) ? 'staffing' : resource === 'inventory-items' ? 'products' : resource, 'lookup', path, filter]
  const query = useInfiniteQuery({
    queryKey: key,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data } = await apiClient.get<LookupPage<T>>(path, {
        params: { ...filter, limit: 50, ...(pageParam ? { cursor: pageParam } : {}) }, signal,
      })
      if (!Array.isArray(data?.items) || !(data.nextCursor === null || typeof data.nextCursor === 'string'))
        throw Error('The server returned an invalid page. Reload results before continuing.')
      if (data.nextCursor === pageParam || data.nextCursor === '')
        throw Error('The server repeated a cursor. Reload results before continuing.')
      return data
    },
    getNextPageParam: (page, pages) => pages.slice(0, -1).some((previous) => previous.nextCursor === page.nextCursor)
      ? undefined : page.nextCursor ?? undefined,
  })
  const items = [...new Map(query.data?.pages.flatMap((page) => page.items).map((item) => [item.id, item]) ?? []).values()]
  return { ...query, items, reload: () => client.resetQueries({ queryKey: key, exact: true }) }
}
