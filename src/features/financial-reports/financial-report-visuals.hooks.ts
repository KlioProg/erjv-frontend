import { useEffect, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { fetchFinancialReportApi } from './financial-reports.api'
import { fetchCompleteItemReport } from './financial-report-visuals.api'
import { validateTrendReport } from './financial-report-visuals'
import type { ReportKind, ReportQuery, ReportResult } from './financial-reports.types'

export function useReportVisuals(scope: ReportQuery, kinds: ReportKind[], overview: boolean) {
  const { user, isAdmin } = useAuth()
  const client = useQueryClient()
  const [session, setSession] = useState(() => crypto.randomUUID())
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type === 'updated' &&
          event.action.type === 'invalidate' &&
          event.query.queryKey[0] === 'financial-reports' &&
          event.query.queryKey[5] === session
        )
          setSession(crypto.randomUUID())
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
  const queries = useQueries({
    queries: kinds.map((kind) => ({
      queryKey: ['financial-reports', 'visuals', user?.id, scope, kind, session, overview],
      enabled: isAdmin,
      retry: false,
      staleTime: 'static' as const,
      gcTime: Infinity,
      refetchOnMount: false as const,
      refetchOnWindowFocus: false as const,
      refetchOnReconnect: false as const,
      queryFn: async ({ signal }: { signal: AbortSignal }) =>
        overview
          ? fetchCompleteItemReport(kind, scope, signal)
          : validateTrendReport(
              await fetchFinancialReportApi(kind, { ...scope, groupBy: 'day' }, signal),
              { ...scope, groupBy: 'day' },
            ),
    })),
  })
  const data: Partial<Record<ReportKind, ReportResult>> = {}
  const errors: Partial<Record<ReportKind, Error>> = {}
  const pending: ReportKind[] = []
  const fetching: ReportKind[] = []
  queries.forEach((query, index) => {
    const kind = kinds[index]
    if (query.isError) errors[kind] = query.error
    else if (isAdmin && query.data) data[kind] = query.data
    if (query.isPending) pending.push(kind)
    if (query.isFetching) fetching.push(kind)
  })
  return {
    data: Object.keys(data).length ? data : undefined,
    errors,
    pending,
    fetching,
    isError: queries.some((query) => query.isError),
    error: queries.find((query) => query.isError)?.error,
    restart: (kind?: ReportKind) => {
      if (!isAdmin) return
      queries.forEach((query, index) => {
        if (!kind || kinds[index] === kind) void query.refetch()
      })
    },
    authorized: isAdmin,
  }
}
