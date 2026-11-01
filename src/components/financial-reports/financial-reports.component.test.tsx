import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { FinancialReportsPage } from './FinancialReportsPage'
import { apiClient } from '@/lib/api-client'
import cases from '@/features/financial-reports/report-test-fixtures.json'
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 }, isAdmin: true, isManager: false }),
}))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
it('shows report totals, applies Manila filters, and recovers from invalid Apply', async () => {
  const reads: string[] = []
  apiClient.defaults.adapter = async (config) => {
    reads.push(config.url!)
    return {
      data: config.url?.startsWith('/financial-reports')
        ? cases[0].body
        : { items: [], nextCursor: null },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }
  }
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <FinancialReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await screen.findByText('Full report totals and quantities')
  expect(screen.getByRole('button', { name: 'Sales', pressed: true })).toBeTruthy()
  const input = screen.getByLabelText('From (inclusive, Manila)')
  await userEvent.clear(input)
  await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }))
  await waitFor(() =>
    expect(document.activeElement?.getAttribute('aria-labelledby')).toBe('report-error-heading'),
  )
  expect(reads.filter((p) => p.startsWith('/financial-reports'))).toHaveLength(1)
  expect(screen.getByRole('alert').textContent).toContain('Enter a valid date')
})
