import { apiClient, getApiError } from './api-client'

export type CursorParams = { limit?: number; cursor?: string }
type CursorPage<T> = { items: T[]; nextCursor: string | null }

/** Existing tables and selectors require the complete list before deriving counts or capacity. */
export async function fetchCursorList<T>(
  path: string,
  filter: CursorParams = {},
  signal?: AbortSignal,
): Promise<T[]> {
  const { cursor: initialCursor, limit = 50, ...filters } = filter
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Page size must be between 1 and 100.')
  let cursor = initialCursor
  let restarted = false
  let items: T[] = []
  const seen = new Set<string>()
  for (;;) {
    try {
      const { data } = await apiClient.get<CursorPage<T>>(path, {
        params: { ...filters, limit, ...(cursor !== undefined ? { cursor } : {}) },
        signal,
      })
      if (
        !Array.isArray(data?.items) ||
        !(data.nextCursor === null || typeof data.nextCursor === 'string')
      )
        throw new Error('The server returned an invalid list page. Reload before continuing.')
      items.push(...data.items)
      if (data.nextCursor === null) return items
      if (!data.nextCursor || data.nextCursor === cursor || seen.has(data.nextCursor))
        throw new Error('The server repeated a list cursor. Reload before continuing.')
      seen.add(data.nextCursor)
      cursor = data.nextCursor
    } catch (error) {
      if (!restarted && getApiError(error)?.code === 'INVALID_CURSOR') {
        restarted = true
        cursor = undefined
        items = []
        seen.clear()
        continue
      }
      throw error
    }
  }
}
