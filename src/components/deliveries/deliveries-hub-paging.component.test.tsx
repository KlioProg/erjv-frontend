import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { getAdapter } from 'axios'
import { apiClient } from '@/lib/api-client'
import { DeliveriesHub } from './DeliveriesHub'

const auth = vi.hoisted(() => ({ isAdmin: false, isManager: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const originalAdapter = apiClient.defaults.adapter
let requests: { url: string; params: Record<string, unknown> }[]
beforeEach(() => {
  requests = []
  auth.isAdmin = false
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

function historyBatches(waitForNext?: Promise<void>) {
  const adapter = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    const result = await adapter(config)
    if (['/incoming-deliveries', '/outgoing-deliveries'].includes(config.url!)) {
      if (config.params?.cursor && waitForNext) await waitForNext
      const incoming = config.url === '/incoming-deliveries'
      const prefix = incoming ? 'IN' : 'OUT'
      const start = Number(config.params?.cursor?.split('-')[1] ?? 0)
      const count = config.params?.q ? 1 : 75
      const size = Number(config.params?.limit ?? 50)
      const template = result.data.items[0]
      result.data = {
        items: Array.from({ length: Math.min(size, count - start) }, (_, index) => ({
          ...template,
          id: start + index + 1,
          deliveryNumber: config.params?.q ? `${prefix}-new` : `${prefix}-${start + index + 1}`,
          // Newer event dates on later creation pages must not move already visited rows.
          completedAt: incoming ? (start ? '2030-01-01T00:00:00Z' : '2026-01-01T00:00:00Z') : null,
          reconciledAt: incoming ? null : (start ? '2030-01-01T00:00:00Z' : '2026-01-01T00:00:00Z'),
        })),
        nextCursor: start + size < count ? `offset-${start + size}` : null,
      }
    }
    return result
  }
}

const visibleHistory = () => [...document.querySelectorAll('button[aria-label^="View delivery "]')].map((button) => button.textContent)

it('keeps stable cached pages, fills supported page sizes, and never duplicates or skips either source', async () => {
  historyBatches()
  mount('history')
  const user = userEvent.setup()
  await waitFor(() => expect(visibleHistory()).toHaveLength(50))
  const controls = within(screen.getByRole('navigation', { name: 'Delivery history pages' }))
  const first = visibleHistory()
  expect(deliveryRequests()).toHaveLength(2)
  await user.click(controls.getByRole('button', { name: 'Next page' }))
  const second = visibleHistory()
  expect(second).toHaveLength(50)
  expect(deliveryRequests()).toHaveLength(2)
  await user.click(controls.getByRole('button', { name: 'Next page' }))
  await screen.findByText('IN-75')
  const third = visibleHistory()
  expect(third).toHaveLength(50)
  expect(new Set([...first, ...second, ...third]).size).toBe(150)
  expect(deliveryRequests()).toHaveLength(4)
  expect(controls.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
  await user.click(controls.getByRole('button', { name: 'Previous page' }))
  await user.click(controls.getByRole('button', { name: 'Previous page' }))
  expect(visibleHistory()).toEqual(first)
  for (const size of [10, 25, 100]) {
    await user.click(controls.getByRole('combobox', { name: 'Rows per page' }))
    await user.click(screen.getByRole('option', { name: String(size) }))
    expect(screen.getByText('Page 1')).toBeTruthy()
    expect(visibleHistory()).toHaveLength(size)
  }
  expect(deliveryRequests()).toHaveLength(4)
})

it('ignores rapid Next clicks and does not navigate an obsolete scope when search changes', async () => {
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  historyBatches(pending)
  mount('history')
  await waitFor(() => expect(visibleHistory()).toHaveLength(50))
  const controls = within(screen.getByRole('navigation', { name: 'Delivery history pages' }))
  fireEvent.click(controls.getByRole('button', { name: 'Next page' }))
  const next = controls.getByRole('button', { name: 'Next page' })
  fireEvent.click(next)
  fireEvent.click(next)
  await waitFor(() => expect(deliveryRequests()).toHaveLength(4))
  expect(screen.getByText(/Page 2/)).toBeTruthy()
  expect(next.hasAttribute('disabled')).toBe(true)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deliveries' }), { target: { value: 'new' } })
  await screen.findByText('IN-new')
  await screen.findByText('OUT-new')
  await act(async () => { release(); await pending })
  expect(screen.getByText('Page 1')).toBeTruthy()
  expect(visibleHistory()).toHaveLength(2)
  expect(screen.queryByText('IN-51')).toBeNull()
  expect(deliveryRequests().filter(({ params }) => params.q === 'new').every(({ params }) => !params.cursor)).toBe(true)
})

it('keeps one compact footer for empty history and bounds empty cursor batches to one request per source', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  let exhausted = false
  apiClient.defaults.adapter = async (config) => {
    const result = await adapter(config)
    if (['/incoming-deliveries', '/outgoing-deliveries'].includes(config.url!))
      result.data = { items: [], nextCursor: exhausted ? null : (config.params?.cursor ? 'empty-2' : 'empty-1') }
    return result
  }
  mount('history')
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Rows per page' }).hasAttribute('disabled')).toBe(false))
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
  expect(screen.getByText('Page 1')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(deliveryRequests()).toHaveLength(4))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(false))
  expect(deliveryRequests()).toHaveLength(4)
  expect(screen.getByText('Page 1')).toBeTruthy()
  exhausted = true
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(deliveryRequests()).toHaveLength(6))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true))
  expect(deliveryRequests()).toHaveLength(6)
  expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true)
})

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

it('pages bounded independent History sources with one compact footer', async () => {
  mount('history')
  await screen.findByText('IN-1')
  await screen.findByText('OUT-1')
  expect(deliveryRequests()).toHaveLength(2)
  expect(deliveryRequests().find(read => read.url === '/incoming-deliveries')?.params.statuses).toEqual(['COMPLETED', 'CANCELLED'])
  expect(deliveryRequests().find(read => read.url === '/outgoing-deliveries')?.params.statuses).toEqual(['RECONCILED', 'CANCELLED'])
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
  expect(screen.getByRole('navigation', { name: 'Delivery history pages' }).hasAttribute('data-table-footer')).toBe(true)
  expect(screen.getByRole('combobox', { name: 'Rows per page' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('IN-2')
  await screen.findByText('OUT-2')
  expect(deliveryRequests()).toHaveLength(4)
  expect(deliveryRequests().filter(read => read.params.cursor).map(read => read.params.cursor)).toEqual(expect.arrayContaining(['incoming-page-2', 'outgoing-page-2']))
  expect(deliveryRequests().every(read => read.params.limit === 50)).toBe(true)
  expect(screen.queryByText('IN-1')).toBeNull()
  expect(screen.queryByText('OUT-1')).toBeNull()
  expect(screen.getByText('Page 2')).toBeTruthy()
  expect(screen.getAllByRole('table')).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
  const reads = deliveryRequests().length
  fireEvent.click(screen.getByRole('button', { name: 'Previous page' }))
  await screen.findByText('IN-1')
  expect(screen.getByText('OUT-1')).toBeTruthy()
  expect(screen.queryByText('IN-2')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('IN-2')
  expect(deliveryRequests()).toHaveLength(reads)
  expect(screen.queryByText(/Page .* of/)).toBeNull()
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
  await user.click(screen.getByRole('button', { name: 'Filter by status' }))
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

it('keeps search outside the table and column filters stable through cursor resets', async () => {
  mount('outgoing')
  const user = userEvent.setup()
  await screen.findByText('OUT-1')
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('OUT-2')
  const search = screen.getByRole('textbox', { name: 'Search deliveries' })
  expect(search.closest('[data-delivery-table]')).toBeNull()
  const frame = screen.getByRole('table').closest('[data-delivery-table]')!
  expect(frame).toBeTruthy()
  expect(screen.queryByText(/More filters/)).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Filter by delivery trip' }))
  await user.click(screen.getByRole('checkbox', { name: 'Unassigned deliveries only' }))
  await waitFor(() => expect(deliveryRequests().at(-1)?.params).toMatchObject({ unassigned: 'true' }))
  expect(deliveryRequests().at(-1)?.params.cursor).toBeUndefined()
  expect(screen.getByRole('checkbox', { name: 'Unassigned deliveries only' }).getAttribute('data-state')).toBe('checked')
  await user.keyboard('{Escape}')
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Filter by delivery trip' }))
  expect(screen.getByRole('button', { name: 'Filter by delivery trip' }).getAttribute('data-active')).toBe('true')
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
})

it('keeps single-page pagination without implying a global total', async () => {
  mount('incoming')
  await screen.findByText('IN-1')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deliveries' }), { target: { value: 'one' } })
  await screen.findByText('IN-one')
  expect(screen.getByText('1 delivery on this page')).toBeTruthy()
  expect(screen.getByRole('navigation', { name: 'Incoming delivery pages' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
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

it.each(['incoming', 'outgoing', 'history'] as const)('keeps %s search and creation outside the standalone table', async direction => {
  auth.isAdmin = true
  mount(direction)
  await screen.findByText(direction === 'outgoing' ? 'OUT-1' : 'IN-1')
  const table = screen.getByRole('table')
  expect(screen.getByRole('textbox', { name: 'Search deliveries' }).closest('[data-delivery-table]')).toBeNull()
  if (direction !== 'history') expect(screen.getByRole('button', { name: direction === 'incoming' ? 'Schedule Incoming' : 'Plan Outgoing' }).closest('[data-delivery-table]')).toBeNull()
  else expect(screen.queryByRole('button', { name: 'Plan Outgoing' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Filters' })).toBeNull()
  const footer = screen.getAllByRole('navigation')[0]
  expect(table.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(table.closest('[data-delivery-table]')).toBe(footer.parentElement)
})

it('filters History direction using only the corresponding source and resets its cursor', async () => {
  mount('history')
  const user = userEvent.setup()
  await screen.findByText('OUT-1')
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('IN-2')
  const selector = within(screen.getByRole('group', { name: 'Delivery direction' }))
  const selectDirection = (direction: string) => user.click(selector.getByRole('button', { name: direction }))
  expect(selector.getByRole('button', { name: 'All Deliveries' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.queryByRole('button', { name: 'Filter by direction' })).toBeNull()
  expect(within(screen.getByRole('columnheader', { name: 'Direction' })).queryByRole('button')).toBeNull()
  expect(screen.getByRole('button', { name: 'Filter by warehouse' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Filter by outcome' })).toBeTruthy()
  const search = screen.getByRole('textbox', { name: 'Search deliveries' })
  const group = screen.getByRole('group', { name: 'Delivery direction' })
  expect(group.closest('[data-delivery-table]')).toBeNull()
  const heading = screen.getByRole('heading', { name: 'Delivery History' })
  expect(screen.getByText('Review completed and cancelled deliveries.')).toBeTruthy()
  expect(heading.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(group.compareDocumentPosition(search) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(group.parentElement?.parentElement?.classList.contains('flex-col')).toBe(true)
  expect(search.compareDocumentPosition(screen.getByRole('table')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(search.getAttribute('placeholder')).toBe('Search delivery history...')
  expect(group.closest('.management-toolbar')).toBeNull()
  const outgoingReads = () => deliveryRequests().filter(({ url }) => url === '/outgoing-deliveries').length
  const before = outgoingReads()
  await selectDirection('Incoming')
  await screen.findByText('IN-1')
  expect(selector.getByRole('button', { name: 'Incoming' }).getAttribute('aria-pressed')).toBe('true')
  expect(selector.getAllByRole('button', { pressed: true })).toHaveLength(1)
  expect(screen.queryByText('OUT-1')).toBeNull()
  expect(outgoingReads()).toBe(before)
  expect(screen.queryByRole('navigation', { name: 'Outgoing delivery pages' })).toBeNull()
  await selectDirection('Outgoing')
  await screen.findByText('OUT-1')
  expect(screen.queryByText('IN-1')).toBeNull()
  expect(screen.getAllByRole('table')).toHaveLength(1)
  await selectDirection('All Deliveries')
  await screen.findByText('IN-1')
  expect(screen.getByText('OUT-1')).toBeTruthy()
  expect(screen.queryByText(/Page .* of/)).toBeNull()
})

it('applies and clears warehouse filtering on the server, including after an empty response', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async config => {
    if (config.url === '/warehouses') return { config, status: 200, statusText: '', headers: {}, data: { items: [{ id: 1, name: 'Main', isActive: true }], nextCursor: null } }
    const result = await adapter(config)
    if (config.url === '/incoming-deliveries' && config.params.warehouseId) result.data = { items: [], nextCursor: null }
    return result
  }
  mount('incoming')
  const user = userEvent.setup()
  await screen.findByText('IN-1')
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('IN-2')
  const trigger = screen.getByRole('button', { name: 'Filter by warehouse' })
  await user.click(trigger)
  await user.click(screen.getByRole('combobox', { name: 'Warehouse' }))
  await user.click(screen.getByRole('option', { name: 'Main' }))
  await waitFor(() => expect(deliveryRequests().at(-1)?.params).toMatchObject({ warehouseId: 1 }))
  expect(deliveryRequests().at(-1)?.params.cursor).toBeUndefined()
  expect(screen.getByRole('button', { name: 'Filter by warehouse' })).toBe(trigger)
  expect(trigger.getAttribute('data-active')).toBe('true')
  await user.click(screen.getByRole('button', { name: 'Clear warehouse' }))
  await screen.findByText('IN-1')
  expect(deliveryRequests().at(-1)?.params.warehouseId).toBeUndefined()
})

it('keeps healthy History records in the combined table when the other source fails', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  let fail = true
  apiClient.defaults.adapter = async config => {
    if (config.url === '/incoming-deliveries' && fail) throw Error('Incoming history unavailable')
    return adapter(config)
  }
  mount('history')
  await screen.findByText('OUT-1')
  expect(screen.getAllByRole('table')).toHaveLength(1)
  expect(screen.getByText('Some deliveries could not be loaded.')).toBeTruthy()
  expect(within(screen.getByRole('navigation', { name: 'Delivery history pages' })).getByText(/Incoming history unavailable/)).toBeTruthy()
  expect(screen.queryByText('No delivery history found')).toBeNull()
  fail = false
  await userEvent.click(screen.getByRole('button', { name: 'Retry history' }))
  await screen.findByText('IN-1')
  expect(screen.getByText('OUT-1')).toBeTruthy()
})

it('keeps History outcome filters within the terminal scope and describes only enabled sources', async () => {
  mount('history')
  const user = userEvent.setup()
  await screen.findByText('OUT-1')
  await user.click(screen.getByRole('button', { name: 'Filter by outcome' }))
  await user.click(screen.getByRole('combobox', { name: 'Outcome' }))
  await user.click(screen.getByRole('option', { name: 'Received' }))
  await waitFor(() => expect(screen.queryByText('OUT-1')).toBeNull())
  expect(await screen.findByText('IN-1')).toBeTruthy()
  expect(deliveryRequests().at(-1)?.params).toMatchObject({ statuses: ['COMPLETED'] })
  const before = deliveryRequests().length
  await user.click(within(screen.getByRole('group', { name: 'Delivery direction' })).getByRole('button', { name: 'All Deliveries' }))
  expect(screen.getByRole('button', { name: 'Filter by outcome' }).getAttribute('data-active')).toBe('true')
  expect(deliveryRequests()).toHaveLength(before)
  expect(screen.queryByText(/Showing the current incoming and outgoing pages/)).toBeNull()
  expect(screen.queryByRole('navigation', { name: 'Outgoing delivery pages' })).toBeNull()
})

it('keeps server search, single-table pagination and exclusive selection for every History direction', async () => {
  mount('history')
  const user = userEvent.setup()
  await screen.findByText('OUT-1')
  const selector = within(screen.getByRole('group', { name: 'Delivery direction' }))
  const search = screen.getByRole('textbox', { name: 'Search deliveries' })
  let previousSearch = ''
  for (const direction of ['All Deliveries', 'Incoming', 'Outgoing']) {
    await user.click(selector.getByRole('button', { name: direction }))
    expect((search as HTMLInputElement).value).toBe(previousSearch)
    const term = 'reference-' + direction
    fireEvent.change(search, { target: { value: term } })
    const sources = direction === 'All Deliveries' ? ['IN', 'OUT'] : [direction === 'Incoming' ? 'IN' : 'OUT']
    for (const prefix of sources) await screen.findByText(prefix + '-' + term)
    expect(screen.getAllByRole('table')).toHaveLength(1)
    expect(selector.getAllByRole('button', { pressed: true })).toHaveLength(1)
    expect(selector.getByRole('button', { name: direction, pressed: true })).toBeTruthy()
    const reads = deliveryRequests().filter(read => read.params.q === term)
    expect(reads).toHaveLength(sources.length)
    expect(reads.every(read => read.params.cursor === undefined)).toBe(true)
    const table = screen.getByRole('table')
    const footers = screen.getAllByRole('navigation')
    expect(footers).toHaveLength(1)
    for (const footer of footers) {
      expect(table.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      if (direction === 'All Deliveries') expect(within(footer).getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
      else {
        expect(within(footer).getByText('Page 1')).toBeTruthy()
        expect(within(footer).getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true)
      }
    }
    previousSearch = term
  }
})

it('retains the selected direction during loading and ignores a delayed response from the old direction', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  let releaseIncoming!: () => void, releaseOutgoing!: () => void
  const incoming = new Promise<void>(resolve => { releaseIncoming = resolve })
  const outgoing = new Promise<void>(resolve => { releaseOutgoing = resolve })
  let incomingWaiting = false, outgoingWaiting = 0
  apiClient.defaults.adapter = async config => {
    if (config.params?.q === 'pending') {
      if (config.url === '/incoming-deliveries') { incomingWaiting = true; await incoming }
      if (config.url === '/outgoing-deliveries') { outgoingWaiting++; await outgoing }
    }
    return adapter(config)
  }
  mount('history')
  const user = userEvent.setup()
  await screen.findByText('OUT-1')
  const selector = within(screen.getByRole('group', { name: 'Delivery direction' }))
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deliveries' }), { target: { value: 'pending' } })
  try {
    await waitFor(() => expect(incomingWaiting && outgoingWaiting > 0).toBe(true))
    await user.click(selector.getByRole('button', { name: 'Outgoing' }))
    await waitFor(() => expect(outgoingWaiting).toBe(2))
    expect(selector.getByRole('button', { name: 'Outgoing', pressed: true })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Rows per page' }).hasAttribute('disabled')).toBe(true)
    await act(async () => { releaseOutgoing() })
    await screen.findByText('OUT-pending')
    await act(async () => { releaseIncoming() })
    expect(screen.queryByText('IN-pending')).toBeNull()
    expect(selector.getByRole('button', { name: 'Outgoing', pressed: true })).toBeTruthy()
    expect(screen.getAllByRole('table')).toHaveLength(1)
  } finally {
    await act(async () => { releaseIncoming(); releaseOutgoing() })
  }
})

it('keeps direction and search through empty results, failures and retry', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  let fail = true
  apiClient.defaults.adapter = async config => {
    if (config.url === '/outgoing-deliveries') {
      if (config.params?.q === 'error' && fail) throw Error('History unavailable')
      if (config.params?.q === 'empty') return { config, status: 200, statusText: '', headers: {}, data: { items: [], nextCursor: null } }
    }
    return adapter(config)
  }
  mount('history')
  const user = userEvent.setup()
  await screen.findByText('OUT-1')
  const outgoing = within(screen.getByRole('group', { name: 'Delivery direction' })).getByRole('button', { name: 'Outgoing' })
  await user.click(outgoing)
  const search = screen.getByRole('textbox', { name: 'Search deliveries' })
  fireEvent.change(search, { target: { value: 'empty' } })
  await screen.findByText('No delivery history found')
  expect(screen.getByRole('navigation', { name: 'Outgoing delivery pages' })).toBeTruthy()
  expect(outgoing.getAttribute('aria-pressed')).toBe('true')
  fireEvent.change(search, { target: { value: 'error' } })
  await screen.findByText('Delivery records are unavailable until the request succeeds.')
  expect(outgoing.getAttribute('aria-pressed')).toBe('true')
  expect((search as HTMLInputElement).value).toBe('error')
  expect(screen.queryByText('No delivery history found')).toBeNull()
  expect(deliveryRequests().filter(read => read.params.q === 'error').every(read => read.url === '/outgoing-deliveries')).toBe(true)
  fail = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByText('OUT-error')
  expect(outgoing.getAttribute('aria-pressed')).toBe('true')
  expect(deliveryRequests().filter(read => read.params.q === 'error').every(read => read.url === '/outgoing-deliveries')).toBe(true)
})

it('retains loaded History during a source failure, retries that cursor, and advances only unfinished sources', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  let failIncoming = true
  apiClient.defaults.adapter = async config => {
    if (config.url === '/incoming-deliveries' && config.params?.cursor && failIncoming) {
      requests.push({ url: config.url, params: config.params })
      throw Error('Incoming page unavailable')
    }
    const result = await adapter(config)
    if (config.url === '/incoming-deliveries' || config.url === '/outgoing-deliveries') {
      const incoming = config.url === '/incoming-deliveries'
      if (config.params?.cursor === 'outgoing-page-3') result.data = { items: [{ ...result.data.items[0], id: 3, deliveryNumber: 'OUT-3' }], nextCursor: null }
      if (config.params?.cursor === 'outgoing-page-2') result.data.nextCursor = 'outgoing-page-3'
      result.data.items = result.data.items.map((record: Record<string, unknown>) => ({ ...record, scheduledAt: incoming ? '2099-01-01T00:00:00Z' : null, completedAt: incoming ? '2026-11-02T00:00:00Z' : null, reconciledAt: incoming ? null : '2026-11-03T00:00:00Z' }))
      result.data.items.push(result.data.items[0])
    }
    return result
  }
  mount('history')
  const user = userEvent.setup()
  await screen.findByText('IN-1')
  await screen.findByText('OUT-1')
  expect(screen.getAllByRole('button', { name: /^View delivery / })[0].textContent).toBe('OUT-1')
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByRole('button', { name: 'Retry history' })
  expect(screen.getByText('IN-1')).toBeTruthy()
  expect(screen.getByText('OUT-1')).toBeTruthy()
  expect(screen.getByText('Page 1')).toBeTruthy()
  expect(screen.queryByText('OUT-2')).toBeNull()
  const outgoingReads = () => deliveryRequests().filter(read => read.url === '/outgoing-deliveries').length
  expect(outgoingReads()).toBe(2)
  failIncoming = false
  await user.click(screen.getByRole('button', { name: 'Retry history' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry history' })).toBeNull())
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('IN-2')
  expect(screen.getByText('OUT-2')).toBeTruthy()
  expect(outgoingReads()).toBe(2)
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('OUT-3')
  expect(screen.getByText('Page 3')).toBeTruthy()
  expect(screen.getAllByRole('button', { name: /^View delivery / })).toHaveLength(1)
  expect(deliveryRequests().filter(read => read.url === '/incoming-deliveries')).toHaveLength(3)
  expect(outgoingReads()).toBe(3)
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
  const reads = deliveryRequests().length
  await user.click(screen.getByRole('button', { name: 'Previous page' }))
  expect(visibleHistory()).toHaveLength(2)
  expect(screen.getByText('IN-2')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Previous page' }))
  expect(visibleHistory()).toHaveLength(2)
  expect(screen.getByText('IN-1')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(visibleHistory()).toHaveLength(2)
  expect(screen.getByText('IN-2')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Next page' }))
  expect(visibleHistory()).toEqual(['OUT-3'])
  expect(deliveryRequests()).toHaveLength(reads)
  fireEvent.change(screen.getByRole('textbox', { name: 'Search deliveries' }), { target: { value: 'new' } })
  await screen.findByText('IN-new')
  await screen.findByText('OUT-new')
  expect(screen.queryByText('IN-2')).toBeNull()
  expect(screen.queryByText('OUT-3')).toBeNull()
  expect(screen.getByText('Page 1')).toBeTruthy()
  expect(deliveryRequests().filter(read => read.params.q === 'new').every(read => !read.params.cursor)).toBe(true)
})
