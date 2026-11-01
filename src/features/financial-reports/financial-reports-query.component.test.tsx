import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  QueryClient,
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { useFinancialReport } from './financial-reports.hooks'
import { apiClient } from '@/lib/api-client'
import cases from './report-test-fixtures.json'
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 }, isAdmin: true, isManager: false }),
}))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
  focusManager.setFocused(undefined)
  onlineManager.setOnline(true)
})
it.each([false, true])(
  'preserves pages and restarts on invalidation (StrictMode %s)',
  async (strict) => {
    const reads: unknown[] = []
    const client = new QueryClient({
      defaultOptions: {
        queries: { refetchOnMount: 'always', refetchOnWindowFocus: true, refetchOnReconnect: true },
      },
    })
    apiClient.defaults.adapter = async (config) => {
      reads.push(config.params)
      return {
        data: cases.find(
          (c) => c.id === (config.params.cursor ? 'sales-items-page-2' : 'sales-items-page-1'),
        )!.body,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }
    }
    function Harness() {
      const q = useFinancialReport('sales', {
        from: '2026-10-01T00:00:00+08:00',
        before: '2026-10-03T00:00:00+08:00',
        groupBy: 'item',
      })
      return (
        <>
          <p>
            Page {q.page}: {q.data?.rows[0].name}
          </p>
          <button disabled={q.isFetching} onClick={q.next}>
            Next
          </button>
          <button disabled={q.isFetching} onClick={q.previous}>
            Previous
          </button>
        </>
      )
    }
    const content = (
      <QueryClientProvider client={client}>
        <Harness />
      </QueryClientProvider>
    )
    render(strict ? <StrictMode>{content}</StrictMode> : content)
    await screen.findByText('Page 1: Sample Item A')
    const initialReads = reads.length
    await userEvent.click(screen.getByText('Next'))
    await screen.findByText('Page 2: Sample Item B')
    focusManager.setFocused(true)
    await userEvent.click(screen.getByText('Previous'))
    await screen.findByText('Page 1: Sample Item A')
    expect(reads).toHaveLength(initialReads + 1)
    await client.invalidateQueries()
    await waitFor(() => expect(reads).toHaveLength(initialReads + 2))
    expect((reads[initialReads + 1] as { cursor?: string }).cursor).toBeUndefined()
    client.clear()
  },
)
