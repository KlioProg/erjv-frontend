import { useRef, useState } from 'react'
import type { DeliveryRow } from './delivery-workflow'

// shortcut: event-date order is local to loaded batches, use an event-time API for global ordering.
export function useDeliveryHistoryPagination({
  rows,
  scope: queryScope,
  isFetching,
  isError,
  hasMore,
  fetchMore,
}: {
  rows: DeliveryRow[]
  scope: string
  isFetching: boolean
  isError: boolean
  hasMore: boolean
  fetchMore: () => Promise<unknown>
}) {
  const [pageSize, setPageSize] = useState(50)
  const scope = JSON.stringify([queryScope, pageSize])
  const initial = {
    scope,
    keys: [] as string[],
    starts: [0],
    index: 0,
    advance: null as number | null,
  }
  const [navigation, setNavigation] = useState(initial)
  let current = navigation.scope === scope ? navigation : initial
  const known = new Set(current.keys)
  const added = isFetching ? [] : rows.filter((row) => !known.has(row.key)).map((row) => row.key)
  if (added.length || (current.advance !== null && !isFetching)) {
    const keys = [...current.keys, ...added]
    current = {
      ...current,
      keys,
      index:
        current.advance !== null && !isFetching && !isError && keys.length > current.advance
          ? current.index + 1
          : current.index,
      advance: null,
    }
  }
  if (current !== navigation) setNavigation(current)
  const [loadingScope, setLoadingScope] = useState<string | null>(null)
  const request = useRef<{ scope: string } | null>(null)
  const busy = isFetching || loadingScope === scope
  const start = current.starts[current.index]
  const end = current.starts[current.index + 1] ?? Math.min(start + pageSize, current.keys.length)
  const byKey = new Map(rows.map((row) => [row.key, row]))
  const load = async (advance: number | null) => {
    if (request.current?.scope === scope || busy) return
    const token = { scope }
    request.current = token
    setLoadingScope(scope)
    try {
      await fetchMore()
      setNavigation((previous) => (previous.scope === scope ? { ...previous, advance } : previous))
    } finally {
      if (request.current === token) {
        request.current = null
        setLoadingScope(null)
      }
    }
  }
  return {
    items: current.keys
      .slice(start, end)
      .flatMap((key) => (byKey.has(key) ? [byKey.get(key)!] : [])),
    page: current.index + 1,
    pageSize,
    setPageSize,
    isFetching: busy,
    isError,
    hasPrevious: current.index > 0,
    hasNext: end < current.keys.length || hasMore,
    previous: () => {
      if (!busy && current.index > 0) setNavigation({ ...current, index: current.index - 1 })
    },
    next: () => {
      if (busy || isError) return
      const starts =
        current.starts[current.index + 1] === undefined ? [...current.starts, end] : current.starts
      if (end < current.keys.length) setNavigation({ ...current, starts, index: current.index + 1 })
      else if (hasMore) {
        setNavigation({ ...current, starts })
        void load(end)
      }
    },
    retry: () => {
      void load(null)
    },
  }
}
