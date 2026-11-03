import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { fetchFinancialReportApi } from './financial-reports.api'
import type { ReportKind, ReportQuery } from './financial-reports.types'
import { breakdown } from './financial-reports.filters'
export function useFinancialReport(kind: ReportKind, scope: ReportQuery) {
  const { user, isAdmin } = useAuth()
  const [navigation, setNavigation] = useState({
    cursors: [undefined] as (string | undefined)[],
    index: 0,
    snapshot: undefined as string | undefined,
  })
  const [pageSize, setSize] = useState(25)
  const [session, setSession] = useState(() => crypto.randomUUID())
  const client = useQueryClient()
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type === 'updated' &&
          event.action.type === 'invalidate' &&
          event.query.queryKey[0] === 'financial-reports' &&
          event.query.queryKey[5] === session
        ) {
          setNavigation({ cursors: [undefined], index: 0, snapshot: undefined })
          setSession(crypto.randomUUID())
        }
      }),
    [client, session],
  )
  useEffect(
    () => () => {
      client.removeQueries({
        predicate: (q) => q.queryKey[0] === 'financial-reports' && q.queryKey[5] === session,
      })
    },
    [client, session],
  )
  const cursor = navigation.cursors[navigation.index]
  const query = useQuery({
    queryKey: ['financial-reports', user?.id, kind, scope, pageSize, session, cursor ?? null],
    enabled: isAdmin,
    retry: false,
    staleTime: 'static',
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const result = await fetchFinancialReportApi(
        kind,
        {
          ...scope,
          ...(breakdown(scope.groupBy) ? { limit: pageSize, ...(cursor ? { cursor } : {}) } : {}),
        },
        signal,
      )
      if (
        Date.parse(result.period.from) !== Date.parse(scope.from) ||
        Date.parse(result.period.before) !== Date.parse(scope.before)
      )
        throw Error('Report period changed. Restart the report.')
      if (
        navigation.snapshot &&
        JSON.stringify([result.period, result.totals]) !== navigation.snapshot
      )
        throw Error('Report snapshot changed. Restart the report.')
      if (result.nextCursor && navigation.cursors.includes(result.nextCursor))
        throw Error('Repeated report cursor. Restart the report.')
      return result
    },
  })
  const restart = () => {
    if (!isAdmin) return
    setNavigation({ cursors: [undefined], index: 0, snapshot: undefined })
    setSession(crypto.randomUUID())
  }
  return {
    ...query,
    page: navigation.index + 1,
    pageSize,
    setPageSize: (n: number) => {
      if ([10, 25, 50, 100].includes(n)) {
        setSize(n)
        restart()
      }
    },
    hasPrevious: navigation.index > 0,
    hasNext: !!query.data?.nextCursor && !query.isError,
    previous: () => {
      if (!query.isFetching) setNavigation((n) => ({ ...n, index: Math.max(0, n.index - 1) }))
    },
    next: () => {
      if (query.data?.nextCursor && !query.isFetching && !query.isError)
        setNavigation((n) => ({
          cursors: [...n.cursors.slice(0, n.index + 1), query.data.nextCursor!],
          index: n.index + 1,
          snapshot: JSON.stringify([query.data.period, query.data.totals]),
        }))
    },
    restart,
    refresh: restart,
  }
}
