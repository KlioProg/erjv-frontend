import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { useReportVisuals } from './financial-report-visuals.hooks'
import cases from './report-test-fixtures.json'
import type { ReportResult } from './financial-reports.types'

const auth = vi.hoisted(() => ({ user: { id: 1 }, isAdmin: true, isManager: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
  auth.user.id = 1
})
const scope = {
  from: '2026-10-01T00:00:00+08:00',
  before: '2026-10-03T00:00:00+08:00',
  groupBy: 'day' as const,
}
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
