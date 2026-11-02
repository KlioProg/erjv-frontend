import { AxiosError } from 'axios'
import type { PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { useFinancialReport } from './financial-reports.hooks'
import type { ReportResult } from './financial-reports.types'
import cases from './report-test-fixtures.json'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 }, isAdmin: true, isManager: false }),
}))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
const scope = {
  from: '2026-10-01T00:00:00+08:00',
  before: '2026-10-03T00:00:00+08:00',
  groupBy: 'item' as const,
}
function setup(failure?: 'snapshot' | 'totals' | 'repeated' | 'invalid') {
  const reads: Record<string, unknown>[] = []
  apiClient.defaults.adapter = async (config) => {
    reads.push(config.params)
    const offset = config.params.cursor ? Number(config.params.cursor.split(':')[1]) : 0
    if (offset && failure === 'invalid')
      throw new AxiosError('Invalid report cursor', 'ERR_BAD_REQUEST', config, undefined, {
        status: 400,
        statusText: 'Bad Request',
        headers: {},
        config,
        data: { code: 'INVALID_CURSOR', detail: 'Restart the report.' },
      })
    const body = structuredClone(
      cases.find((entry) => entry.id === 'sales-items-page-1')!.body,
    ) as ReportResult
    body.totals.totalAmount = offset && failure === 'totals' ? '1251.00' : '1250.00'
    if (offset && failure === 'snapshot') body.period.asOf = '2026-10-04T00:00:00+08:00'
    body.rows = Array.from({ length: Math.min(config.params.limit, 125 - offset) }, (_, index) => ({
      ...body.rows[0],
      key: String(offset + index),
      name: `Item ${offset + index}`,
      totalAmount: '10.00',
    }))
    const next = offset + body.rows.length
    body.nextCursor =
      next < 125 ? `opaque:${failure === 'repeated' && offset ? offset : next}` : null
    return { data: body, status: 200, statusText: 'OK', headers: {}, config }
  }
  const client = new QueryClient()
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const hook = renderHook(() => useFinancialReport('sales', scope), { wrapper })
  return { ...hook, client, reads }
}

it('loads a 125-item breakdown one cursor page at a time and reuses visited pages', async () => {
  const { result, reads, client } = setup()
  await waitFor(() => expect(result.current.data?.rows).toHaveLength(25))
  expect(reads).toHaveLength(1)
  expect(result.current.data?.totals.totalAmount).toBe('1250.00')
  const keys: string[] = []
  for (let page = 1; page <= 5; page++) {
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    keys.push(...result.current.data!.rows.map((row) => row.key))
    if (page < 5) {
      act(() => result.current.next())
      await waitFor(() => expect(result.current.page).toBe(page + 1))
    }
  }
  expect(new Set(keys).size).toBe(125)
  expect(result.current.hasNext).toBe(false)
  expect(reads).toHaveLength(5)
  act(() => result.current.previous())
  await waitFor(() => expect(result.current.data?.rows[0].key).toBe('75'))
  expect(reads).toHaveLength(5)
  act(() => result.current.setPageSize(50))
  await waitFor(() => expect(result.current.data?.rows).toHaveLength(50))
  expect(result.current.page).toBe(1)
  expect(reads.at(-1)).not.toHaveProperty('cursor')
  client.clear()
})

it.each(['snapshot', 'totals', 'repeated', 'invalid'] as const)(
  'rejects %s changes and recovers by restarting at page one',
  async (failure) => {
    const { result, reads, client } = setup(failure)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    act(() => result.current.next())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.hasNext).toBe(false)
    expect(result.current.data).toBeUndefined()
    act(() => result.current.restart())
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.page).toBe(1)
    expect(reads.at(-1)).not.toHaveProperty('cursor')
    client.clear()
  },
)
