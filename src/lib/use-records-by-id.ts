import { useQueries } from '@tanstack/react-query'
import { apiClient } from './api-client'

/** Hydrate only references on the displayed page, independently of collection cursors. */
export function useRecordsById<T extends { id: number }>(
  path: string,
  ids: (number | null | undefined)[],
) {
  const resource = path.split('/')[1]
  const prefix = ['employees', 'users', 'jobs'].includes(resource)
    ? 'staffing'
    : resource === 'inventory-items'
      ? 'products'
      : resource
  const queries = useQueries({
    queries: [
      ...new Set(ids.filter((id): id is number => Number.isSafeInteger(id) && Number(id) > 0)),
    ].map((id) => ({
      queryKey: [prefix, 'id', path, id],
      retry: false,
      queryFn: async ({ signal }: { signal: AbortSignal }) => {
        const { data } = await apiClient.get<T>(`${path}/${id}`, { signal })
        if (data?.id !== id) throw Error('The referenced record is unavailable.')
        return data
      },
    })),
  })
  return {
    data: queries.flatMap((query) => (query.data ? [query.data] : [])),
    isPending: queries.some((query) => query.isPending),
    isLoading: queries.some((query) => query.isPending),
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.error)?.error,
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  }
}
