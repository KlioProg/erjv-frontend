import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { fetchFinancialReportApi } from './financial-reports.api'
import { fetchCompleteItemReport } from './financial-report-visuals.api'
import { validateTrendReport } from './financial-report-visuals'
import type { ReportKind, ReportQuery, ReportResult } from './financial-reports.types'

export function useReportVisuals(scope: ReportQuery, kinds: ReportKind[], overview: boolean) {
  const { user, isAdmin, isManager } = useAuth()
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
  const query = useQuery({
    queryKey: [
      'financial-reports',
      'visuals',
      user?.id,
      scope,
      [...kinds].sort(),
      session,
      overview,
    ],
    enabled: isAdmin || isManager,
    retry: false,
    staleTime: 'static',
    gcTime: 0,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ signal }) => {
      const entries = await Promise.all(
        kinds.map(
          async (kind) =>
            [
              kind,
              overview
                ? await fetchCompleteItemReport(kind, scope, signal)
                : validateTrendReport(
                    await fetchFinancialReportApi(kind, { ...scope, groupBy: 'day' }, signal),
                    { ...scope, groupBy: 'day' },
                  ),
            ] as const,
        ),
      )
      return Object.fromEntries(entries) as Partial<Record<ReportKind, ReportResult>>
    },
  })
  return {
    ...query,
    restart: () => setSession(crypto.randomUUID()),
    authorized: isAdmin || isManager,
  }
}
