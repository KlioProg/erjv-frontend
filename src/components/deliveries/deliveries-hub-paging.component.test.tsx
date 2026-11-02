import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { getAdapter } from 'axios'
import { apiClient } from '@/lib/api-client'
import { DeliveriesHub } from './DeliveriesHub'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: false, isManager: false }),
}))
const originalAdapter = apiClient.defaults.adapter
let requests: { url: string; params: Record<string, unknown> }[]
beforeEach(() => {
  requests = []
  apiClient.defaults.adapter = async (config) => {
    const params = config.params ?? {}
    requests.push({ url: config.url!, params })
    let data: unknown = { items: [], nextCursor: null }
    if (config.url === '/incoming-deliveries' || config.url === '/outgoing-deliveries') {
      const incoming = config.url === '/incoming-deliveries'
      const id = params.cursor ? 2 : 1
      const status = params.statuses[0]
      const reference = `${incoming ? 'IN' : 'OUT'}-${params.q || id}`
      data = {
        items: [
          {
            id,
            revision: 1,
            deliveryNumber: reference,
            status,
            purchaseOrderId: 1,
            salesOrderId: 1,
            warehouseId: 1,
            items: [],
            plannedItems: [],
            runId: null,
            scheduledAt: null,
            reconciledAt: null,
            notes: null,
          },
        ],
        nextCursor:
          params.cursor || params.q ? null : incoming ? 'incoming-page-2' : 'outgoing-page-2',
      }
    }
    return { config, status: 200, statusText: '', headers: {}, data }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
function mount(initialTab: 'incoming' | 'outgoing' | 'history') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DeliveriesHub initialTab={initialTab} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
const deliveryRequests = () =>
  requests.filter(({ url }) => ['/incoming-deliveries', '/outgoing-deliveries'].includes(url))

it.each(['incoming', 'outgoing'] as const)(
  'loads only one %s page until requested, with verified active statuses',
  async (direction) => {
    mount(direction)
    await screen.findByText(`${direction === 'incoming' ? 'IN' : 'OUT'}-1`)
    expect(deliveryRequests()).toHaveLength(1)
    expect(deliveryRequests()[0]).toEqual({
      url: `/${direction}-deliveries`,
      params: {
        limit: 50,
        statuses:
          direction === 'incoming' ? ['DRAFT', 'SCHEDULED'] : ['DRAFT', 'READY', 'DISPATCHED'],
      },
    })
    expect(screen.getByText('1 delivery on this page')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
    await screen.findByText(`${direction === 'incoming' ? 'IN' : 'OUT'}-2`)
    expect(deliveryRequests()).toHaveLength(2)
    expect(deliveryRequests()[1].params.cursor).toBe(`${direction}-page-2`)
    expect(screen.getByText('1 delivery on this page')).toBeTruthy()
    expect(screen.queryByText(`${direction === 'incoming' ? 'IN' : 'OUT'}-1`)).toBeNull()
    expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
  },
)

it('keeps incoming and outgoing history pagination independent', async () => {
  mount('history')
  await screen.findByText('IN-1')
  await screen.findByText('OUT-1')
  expect(deliveryRequests()).toHaveLength(2)
  expect(
    deliveryRequests().find(({ url }) => url === '/incoming-deliveries')?.params.statuses,
  ).toEqual(['COMPLETED', 'CANCELLED'])
  expect(
    deliveryRequests().find(({ url }) => url === '/outgoing-deliveries')?.params.statuses,
  ).toEqual(['RECONCILED', 'CANCELLED'])
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Incoming delivery pages' })).getByRole('button', { name: 'Next page' }))
  await screen.findByText('IN-2')
  expect(deliveryRequests().filter(({ url }) => url === '/outgoing-deliveries')).toHaveLength(1)
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Outgoing delivery pages' })).getByRole('button', { name: 'Next page' }))
  await screen.findByText('OUT-2')
  expect(within(screen.getByRole('region', { name: 'Incoming history' })).getByText('IN-2')).toBeTruthy()
  expect(within(screen.getByRole('region', { name: 'Outgoing history' })).getByText('OUT-2')).toBeTruthy()
  expect(screen.queryByText('IN-1')).toBeNull()
  expect(screen.queryByText('OUT-1')).toBeNull()
})

it('starts a fresh first page for server text and status filters', async () => {
  mount('incoming')
  await screen.findByText('IN-1')
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Incoming delivery pages' })).getByRole('button', { name: 'Next page' }))
  await screen.findByText('IN-2')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deliveries' }), {
    target: { value: 'supplier reference' },
  })
  await screen.findByText('IN-supplier reference')
  expect(deliveryRequests().at(-1)?.params).toEqual({
    statuses: ['DRAFT', 'SCHEDULED'],
    q: 'supplier reference',
    limit: 50,
  })
  expect(screen.queryByText('IN-2')).toBeNull()
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Status' }))
  await user.click(screen.getByRole('option', { name: 'Awaiting Receipt' }))
  await waitFor(() =>
    expect(deliveryRequests().at(-1)?.params).toEqual({
      statuses: ['SCHEDULED'],
      q: 'supplier reference',
      limit: 50,
    }),
  )
})

it('integrates filters with the table, resets cursors and keeps panel selection stable', async () => {
  mount('outgoing')
  const user = userEvent.setup()
  await screen.findByText('OUT-1')
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('OUT-2')
  const search = screen.getByRole('textbox', { name: 'Search deliveries' })
  const frame = search.closest('[data-delivery-table]')!
  expect(within(frame as HTMLElement).getByRole('table')).toBeTruthy()
  expect(screen.queryByText(/More filters/)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  await user.click(screen.getByRole('checkbox', { name: 'Unassigned deliveries only' }))
  await waitFor(() => expect(deliveryRequests().at(-1)?.params).toMatchObject({ unassigned: 'true' }))
  expect(deliveryRequests().at(-1)?.params.cursor).toBeUndefined()
  expect(screen.getByRole('checkbox', { name: 'Unassigned deliveries only' }).getAttribute('data-state')).toBe('checked')
  await user.keyboard('{Escape}')
  expect(document.activeElement?.textContent).toContain('Filters')
  expect(screen.getByRole('button', { name: /^Filters/ }).textContent).toContain('1')
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
})

it('hides single-page pagination without implying a global total', async () => {
  mount('incoming')
  await screen.findByText('IN-1')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deliveries' }), { target: { value: 'one' } })
  await screen.findByText('IN-one')
  expect(screen.getByText('1 delivery on this page')).toBeTruthy()
  expect(screen.queryByRole('navigation', { name: 'Incoming delivery pages' })).toBeNull()
})

it('hides stale actions when a later page fails and restarts pagination on retry', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  let fail = true
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/incoming-deliveries' && config.params?.cursor && fail)
      throw Error('Next page unavailable')
    return adapter(config)
  }
  mount('incoming')
  await screen.findByText('IN-1')
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Incoming delivery pages' })).getByRole('button', { name: 'Next page' }))
  await screen.findByRole('alert')
  expect(screen.queryByText('IN-1')).toBeNull()
  expect(screen.getByText('Delivery records are unavailable until the request succeeds.')).toBeTruthy()
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  expect(deliveryRequests().at(-1)?.params.cursor).toBeUndefined()
  fireEvent.click(within(screen.getByRole('navigation', { name: 'Incoming delivery pages' })).getByRole('button', { name: 'Next page' }))
  await screen.findByText('IN-2')
})
