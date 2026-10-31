import { apiClient, getApiError } from './api-client'

export type CursorParams = { limit?: number; cursor?: string }
export type CursorPage<T> = { items: T[]; nextCursor: string | null }

/** Complete scoped aggregates and legacy reference consumers; tables use fetchCursorPage. */
export async function fetchCursorList<T>(
  path: string,
  filter: CursorParams & Record<string, unknown> = {},
  signal?: AbortSignal,
): Promise<T[]> {
  const { cursor: initialCursor, limit = 50, ...filters } = filter
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new Error('Page size must be between 1 and 100.')
  let cursor = initialCursor
  let restarted = false
  let items: T[] = []
  const seen = new Set<string>()
  const ids = new Set<unknown>()
  for (;;) {
    try {
      const { data } = await apiClient.get<CursorPage<T>>(path, {
        params: { ...filters, limit, ...(cursor !== undefined ? { cursor } : {}) },
        signal,
        paramsSerializer: { indexes: null },
      })
      if (
        !Array.isArray(data?.items) ||
        !(data.nextCursor === null || typeof data.nextCursor === 'string')
      )
        throw new Error('The server returned an invalid list page. Reload before continuing.')
      for (const item of data.items) {
        const id = item && typeof item === 'object' && 'id' in item ? item.id : undefined
        if (id !== undefined && ids.has(id)) continue
        if (id !== undefined) ids.add(id)
        items.push(item)
      }
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
        ids.clear()
        continue
      }
      throw error
    }
  }
}

/** One backend page for screens with explicit navigation. */
export async function fetchCursorPage<T extends { id: number }>(path: string, filter: CursorParams & Record<string, unknown> = {}, signal?: AbortSignal): Promise<CursorPage<T>> {
  const { limit = 50, cursor, ...filters } = filter
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('Page size must be between 1 and 100.')
  const { data } = await apiClient.get<CursorPage<T>>(path, { params: { ...filters, limit, ...(cursor ? { cursor } : {}) }, paramsSerializer: { indexes: null }, signal })
  if (!Array.isArray(data?.items) || !(data.nextCursor === null || typeof data.nextCursor === 'string' && data.nextCursor.length > 0 && data.nextCursor !== cursor)) throw Error('The server returned an invalid page. Reload results before continuing.')
  if (data.items.some((item) => !Number.isSafeInteger(item?.id) || item.id < 1)) throw Error('The server returned an invalid record. Reload results before continuing.')
  return { ...data, items: [...new Map(data.items.map((item) => [item.id, item])).values()] }
}
