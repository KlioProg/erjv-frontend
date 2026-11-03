import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { useReportVisuals } from './financial-report-visuals.hooks'
import { useFinancialReport } from './financial-reports.hooks'
import cases from './report-test-fixtures.json'
import type { ReportResult } from './financial-reports.types'
import { AxiosError } from 'axios'
import { getErrorMessage } from '@/lib/api-client'

const auth = vi.hoisted(() => ({ user: { id: 1 }, isAdmin: true, isManager: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
  auth.user.id = 1
  auth.isAdmin = true
  auth.isManager = false
})
const scope = {
  from: '2026-10-01T00:00:00+08:00',
  before: '2026-10-03T00:00:00+08:00',
  groupBy: 'day' as const,
}
it('immediately masks cached financial results when admin permission is removed', async () => {
  const request = vi.fn(async (config) => ({ config, status: 200, statusText: 'OK', headers: {}, data: result('100.00') }))
  apiClient.defaults.adapter = request
  const client = new QueryClient()
  const hook = renderHook(() => ({ trends: useReportVisuals(scope, ['sales'], false), details: useFinancialReport('sales', scope) }), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  await waitFor(() => expect(hook.result.current.details.data).toBeTruthy())
  await waitFor(() => expect(hook.result.current.trends.data).toBeTruthy())
  const reads = request.mock.calls.length
  auth.isAdmin = false
  auth.isManager = true
  hook.rerender()
  expect(hook.result.current.details.data).toBeUndefined()
  expect(hook.result.current.trends.data).toBeUndefined()
  await act(async () => { hook.result.current.details.refresh(); hook.result.current.trends.restart() })
  expect(request).toHaveBeenCalledTimes(reads)
})
it('keeps invalid gross-profit source data unavailable and allows an explicit retry', async () => {
  const request = vi.fn(async (config) => {
    throw new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, undefined, { config, status: 409, statusText: 'Conflict', headers: {}, data: { code: 'REPORT_SOURCE_DATA_INVALID', detail: 'Invalid source' } })
  })
  apiClient.defaults.adapter = request
  const client = new QueryClient()
  const hook = renderHook(() => useReportVisuals(scope, ['gross-profit-estimate'], false), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  await waitFor(() => expect(hook.result.current.isError).toBe(true))
  expect(hook.result.current.data).toBeUndefined()
  expect(getErrorMessage(hook.result.current.error)).toMatch(/source data/i)
  expect(request).toHaveBeenCalledOnce()
  act(() => hook.result.current.restart('gross-profit-estimate'))
  await waitFor(() => expect(request).toHaveBeenCalledTimes(2))
  expect(hook.result.current.data).toBeUndefined()
})
it.each([false, true])('does not query or refresh financial hooks without admin access (manager %s)', async (manager) => {
  auth.isAdmin = false
  auth.isManager = manager
  const adapter = vi.fn()
  apiClient.defaults.adapter = adapter
  const client = new QueryClient()
  const { result } = renderHook(() => ({
    trends: useReportVisuals(scope, ['sales', 'purchases', 'gross-profit-estimate'], false),
    details: useFinancialReport('sales', scope),
  }), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  expect(result.current.trends.authorized).toBe(false)
  await act(async () => {
    result.current.trends.restart()
    result.current.details.refresh()
  })
  expect(adapter).not.toHaveBeenCalled()
})
function result(value: string, from = scope.from, before = scope.before): ReportResult {
  const body = structuredClone(
    cases.find((c) => c.id === 'sales-trend-zero-bucket')!.body,
  ) as ReportResult
  body.totals.totalAmount = value
  body.period.from = from
  body.period.before = before
  const throughExclusive = before.slice(0, 10)
  const rows: ReportResult['rows'] = []
  for (let date = from.slice(0, 10); date < throughExclusive;) {
    const day = new Date(`${date}T00:00:00.000Z`)
    rows.push({ ...body.rows[0], key: date, totalAmount: value })
    day.setUTCDate(day.getUTCDate() + 1)
    date = day.toISOString().slice(0, 10)
  }
  body.rows = rows
  return body
}
function Harness({ from = scope.from }: { from?: string }) {
  const q = useReportVisuals({ ...scope, from }, ['sales'], false)
  return (
    <p>
      {q.isError
        ? q.error instanceof Error
          ? q.error.message
          : 'Query failed'
        : q.data
          ? q.data.sales!.totals.totalAmount
          : 'Loading current scope'}
    </p>
  )
}
it('restarts a static visualization session after financial-report invalidation', async () => {
  let amount = '100.00'
  const client = new QueryClient()
  apiClient.defaults.adapter = async (config) => ({
    data: result(amount),
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  })
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
  await screen.findByText('100.00')
  amount = '200.00'
  await client.invalidateQueries({ queryKey: ['financial-reports'] })
  await screen.findByText('200.00')
  expect(screen.queryByText('100.00')).toBeNull()
  client.clear()
})
it('does not show the previous user’s cached financial data during a user transition', async () => {
  const client = new QueryClient()
  let release: (() => void) | undefined
  apiClient.defaults.adapter = async (config) => {
    const id = auth.user.id
    if (id === 2)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return {
      data: result(id === 1 ? '100.00' : '250.00'),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  const view = render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
  await screen.findByText('100.00')
  auth.user.id = 2
  view.rerender(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
  expect(screen.queryByText('100.00')).toBeNull()
  await waitFor(() => expect(release).toBeTypeOf('function'))
  release!()
  await screen.findByText('250.00')
  client.clear()
})
it('ignores a late response from an abandoned filter scope', async () => {
  const client = new QueryClient()
  let release: (() => void) | undefined
  apiClient.defaults.adapter = async (config) => {
    const old = config.params.from === scope.from
    if (old)
      await new Promise<void>((resolve) => {
        release = resolve
      })
    return {
      data: result(
        old ? '100.00' : '300.00',
        old ? scope.from : '2026-10-02T00:00:00+08:00',
        scope.before,
      ),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  const view = render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
  await waitFor(() => expect(release).toBeTypeOf('function'))
  view.rerender(
    <QueryClientProvider client={client}>
      <Harness from="2026-10-02T00:00:00+08:00" />
    </QueryClientProvider>,
  )
  await screen.findByText('300.00')
  release!()
  await waitFor(() => expect(client.isFetching()).toBe(0))
  expect(screen.queryByText('100.00')).toBeNull()
  client.clear()
})

it('rejects a trend response with a missing Manila day before it reaches the chart', async () => {
  const client = new QueryClient()
  apiClient.defaults.adapter = async (config) => {
    const incomplete = result('100.00')
    incomplete.rows = incomplete.rows.slice(1)
    return {
      data: incomplete,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  render(
    <QueryClientProvider client={client}>
      <Harness />
    </QueryClientProvider>,
  )
  await screen.findByText(/Incomplete financial trend report/i)
  expect(screen.queryByText('100.00')).toBeNull()
  client.clear()
})
