import type { PropsWithChildren } from 'react'
import { useCursorPage } from '@/lib/use-cursor-page'
import { fireEvent, render, screen, waitFor, within, act, renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { AxiosError } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { OrdersView } from '@/components/orders/OrdersView'
import { PurchasesView } from '@/components/purchases/PurchasesView'
import { fetchSalesOrdersPageApi } from './crm/sales-orders.api'
import { fetchPurchaseOrdersPageApi } from './logistics/purchase-orders.api'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false, user: { id: 1, fullName: 'Tester' } }),
}))
const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount(kind: 'PO' | 'SO', initialFailure = '') {
  const path = kind === 'PO' ? '/purchase-orders' : '/sales-orders'
  let failure = initialFailure
  let hold: Promise<void> | undefined
  let nextHold: Promise<void> | undefined
  const reads: { url: string; params: Record<string, unknown> }[] = []
  const writes: { url: string; body: Record<string, unknown> }[] = []
  const dates = {
    orderedAt: '2026-10-01T00:00:00Z',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  }
  const records = [1, 2].map((id) => ({
    id,
    revision: 4,
    orderNumber: `${kind}-${id}`,
    status: 'DRAFT',
    clientId: 1,
    supplierId: 1,
    deliveryAddress: 'Dock',
    expectedAt: null,
    confirmedAt: null,
    completedAt: null,
    cancelledAt: null,
    externalReference: null,
    notes: null,
    ...dates,
    items: [
      {
        id: id * 10,
        salesOrderId: id,
        purchaseOrderId: id,
        lineNumber: 1,
        inventoryItemId: 1,
        quantity: '1.00',
        unitPrice: '10.00',
        discountRate: '0.00',
        discountAmount: '0.00',
        taxRate: '0.00',
        taxAmount: '0.00',
        subtotalAmount: '10.00',
        taxableAmount: '10.00',
        totalAmount: '10.00',
        notes: null,
        ...dates,
      },
    ],
  }))
  apiClient.defaults.adapter = async (config) => {
    const url = config.url!,
      params = config.params ?? {}
    let data: unknown
    if (config.method === 'patch') {
      const body = JSON.parse(config.data)
      writes.push({ url, body })
      const id = Number(url.split('/')[2])
      const record = records.find((record) => record.id === id)!
      record.status = url.endsWith('/confirm') ? 'CONFIRMED' : 'CANCELLED'
      record.revision++
      data = { ...record }
    } else {
      reads.push({ url, params: { ...params } })
      if (url === path) {
        if (params.q === 'old') await hold
        if (params.cursor) await nextHold
        if (failure === 'first' || (failure === 'cursor' && params.cursor))
          throw new AxiosError('Lookup failed', undefined, config, undefined, {
            config,
            status: 400,
            statusText: '',
            headers: {},
            data: { code: 'INVALID_CURSOR', detail: 'Reload this page.' },
          })
        let matches = records.filter(
          (record) => !params.statuses || params.statuses.includes(record.status),
        )
        if (params.q)
          matches =
            params.q === 'remote' || params.q === 'new'
              ? matches.filter((record) => record.id === 2)
              : []
        const items = params.cursor
          ? matches.filter((record) => record.id === 2)
          : matches.slice(0, 1)
        data = {
          items: params.cursor ? [...items, ...items] : items,
          nextCursor: !params.cursor && matches.length > 1 ? 'opaque-next' : null,
        }
      } else if (url.startsWith(`${path}/`))
        data = records.find((record) => record.id === Number(url.split('/').pop()))
      else if (url === '/clients/2' || url === '/suppliers/2')
        data = { id: 2, name: 'Later Party', code: 'P2', address: 'Dock', isActive: true }
      else if (url === '/clients' || url === '/suppliers')
        data = {
          items: [{ id: 1, name: 'Party', code: 'P1', address: 'Dock', isActive: true }],
          nextCursor: null,
        }
      else if (url === '/inventory-items')
        data = {
          items: [{ id: 1, name: 'Rice', unit: 'kg', unitPrice: '10.00', isActive: true }],
          nextCursor: null,
        }
      else data = { items: [], nextCursor: null }
    }
    return { config, data: structuredClone(data), status: 200, statusText: '', headers: {} }
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{kind === 'PO' ? <PurchasesView /> : <OrdersView />}</MemoryRouter>
    </QueryClientProvider>,
  )
  return {
    path,
    records,
    reads,
    writes,
    client,
    fail: (value: string) => {
      failure = value
    },
    hold: (value: Promise<void>) => {
      hold = value
    },
    holdNext: (value: Promise<void>) => {
      nextHold = value
    },
  }
}
const next = () => screen.getByRole('button', { name: 'Next' })
const previous = () => screen.getByRole('button', { name: 'Previous' })
const search = (kind: 'PO' | 'SO') =>
  screen.getByRole('textbox', { name: kind === 'PO' ? 'Search purchase orders' : 'Search orders' })

it.each(['PO', 'SO'] as const)(
  '%s requests one page and navigates Next/Previous without fake totals or duplicates',
  async (kind) => {
    const { reads, path } = mount(kind)
    await screen.findByText(`${kind}-1`)
    expect(reads.filter((read) => read.url === path)).toHaveLength(1)
    expect(previous().hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText(/of [0-9]+/)).toBeNull()
    await userEvent.click(next())
    await screen.findByText(`${kind}-2`)
    expect(screen.queryByText(`${kind}-1`)).toBeNull()
    expect(screen.getAllByText(`${kind}-2`)).toHaveLength(1)
    expect(next().hasAttribute('disabled')).toBe(true)
    expect(screen.getByText('Page 2')).toBeTruthy()
    expect(reads.find((read) => read.url === path && read.params.cursor)?.params).toMatchObject({
      cursor: 'opaque-next',
      limit: 50,
      statuses:
        kind === 'PO'
          ? ['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED']
          : ['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED'],
    })
    await userEvent.click(previous())
    await screen.findByText(`${kind}-1`)
    expect(screen.getByText('Page 1')).toBeTruthy()
  },
)

it.each(['PO', 'SO'] as const)(
  '%s resets cursor on search, status, date and page-size changes',
  async (kind) => {
    const { reads, path } = mount(kind)
    await screen.findByText(`${kind}-1`)
    await userEvent.click(next())
    await screen.findByText(`${kind}-2`)
    fireEvent.change(search(kind), { target: { value: 'remote' } })
    await waitFor(() => expect(previous().hasAttribute('disabled')).toBe(true))
    await screen.findByText(`${kind}-2`)
    expect(
      reads
        .filter((read) => read.url === path && read.params.q === 'remote')
        .every((read) => !read.params.cursor),
    ).toBe(true)
    fireEvent.change(screen.getByLabelText('Ordered from (inclusive)'), {
      target: { value: '2026-10-01T10:00' },
    })
    fireEvent.change(screen.getByLabelText('Ordered before (exclusive)'), {
      target: { value: '2026-11-01T10:00' },
    })
    await waitFor(() =>
      expect(
        reads.some(
          (read) => read.params.orderedBefore === new Date('2026-11-01T10:00').toISOString(),
        ),
      ).toBe(true),
    )
    expect(
      reads
        .filter((read) => read.params.orderedFrom)
        .every(
          (read) =>
            !read.params.cursor &&
            read.params.orderedFrom === new Date('2026-10-01T10:00').toISOString(),
        ),
    ).toBe(true)
    await userEvent.click(screen.getByRole('combobox', { name: 'Orders per page' }))
    await userEvent.click(screen.getByRole('option', { name: '25' }))
    await waitFor(() =>
      expect(reads.some((read) => read.url === path && read.params.limit === 25)).toBe(true),
    )
    await userEvent.click(screen.getByRole('button', { name: 'Cancelled Orders' }))
    await screen.findByText(
      kind === 'PO' ? /No purchase orders match/ : /No cancelled orders match/,
    )
    expect(
      reads
        .filter(
          (read) => read.url === path && JSON.stringify(read.params.statuses) === '["CANCELLED"]',
        )
        .every(
          (read) => !read.params.cursor && read.params.limit === 25 && read.params.q === 'remote',
        ),
    ).toBe(true)
  },
)

it.each(['PO', 'SO'] as const)(
  '%s recovers invalid cursors at page one with no automatic retry loop',
  async (kind) => {
    const { reads, path, fail } = mount(kind)
    await screen.findByText(`${kind}-1`)
    fail('cursor')
    await userEvent.click(next())
    await screen.findByRole('button', { name: 'Retry' })
    expect(reads.filter((read) => read.url === path && read.params.cursor)).toHaveLength(1)
    expect(next().hasAttribute('disabled')).toBe(true)
    fail('')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(`${kind}-1`)
    expect(screen.getByText('Page 1')).toBeTruthy()
  },
)

it.each(['PO', 'SO'] as const)(
  '%s keeps later-page row identities and refreshes after confirmation and cancellation',
  async (kind) => {
    const { writes, reads, path, client } = mount(kind)
    await screen.findByText(`${kind}-1`)
    await userEvent.click(next())
    await screen.findByText(`${kind}-2`)
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({ url: `${path}/2/confirm`, body: { expectedRevision: 4 } })
    await waitFor(() =>
      expect(client.getQueryData([path.slice(1), 'id', 2])).toMatchObject({
        id: 2,
        status: 'CONFIRMED',
        revision: 5,
      }),
    )
    await waitFor(() =>
      expect(reads.filter((read) => read.url === path && read.params.cursor)).toHaveLength(2),
    )
    await screen.findByText(`${kind}-2`)
    await userEvent.click(screen.getByRole('button', { name: `More actions for ${kind}-2` }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Cancel Order' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel Order' }))
    await waitFor(() => expect(writes).toHaveLength(2))
    expect(writes[1]).toEqual({ url: `${path}/2/cancel`, body: { expectedRevision: 5 } })
    await waitFor(() => expect(screen.queryByText(`${kind}-2`)).toBeNull())
    expect(previous().hasAttribute('disabled')).toBe(false)
  },
)

it('ignores an older in-flight search response after newer filters are active', async () => {
  const setup = mount('SO')
  await screen.findByText('SO-1')
  let release!: () => void
  setup.hold(
    new Promise<void>((resolve) => {
      release = resolve
    }),
  )
  fireEvent.change(search('SO'), { target: { value: 'old' } })
  await waitFor(() => expect(setup.reads.some((read) => read.params.q === 'old')).toBe(true))
  fireEvent.change(search('SO'), { target: { value: 'new' } })
  await screen.findByText('SO-2')
  await act(async () => {
    release()
  })
  expect(screen.getByText('SO-2')).toBeTruthy()
  expect(screen.queryByText(/No active orders match/)).toBeNull()
})

it.each([fetchSalesOrdersPageApi, fetchPurchaseOrdersPageApi])(
  'serializes repeated statuses, party IDs, and exclusive timezone date boundaries in a single adapter call',
  async (fetchPage) => {
    let calls = 0
    apiClient.defaults.adapter = async (config) => {
      calls++
      expect(apiClient.getUri(config)).toContain('statuses=DRAFT&statuses=CONFIRMED')
      expect(config.params).toMatchObject({
        limit: 25,
        cursor: 'opaque',
        orderedFrom: '2026-10-01T00:00:00Z',
        orderedBefore: '2026-11-01T00:00:00+08:00',
        expectedFrom: '2026-10-01T00:00:00Z',
        expectedBefore: '2026-12-01T00:00:00Z',
      })
      expect(config.params.clientId ?? config.params.supplierId).toBe(7)
      expect(
        fetchPage === fetchSalesOrdersPageApi ? config.params.supplierId : config.params.clientId,
      ).toBeUndefined()
      return {
        config,
        data: { items: [{ id: 1 }, { id: 1 }], nextCursor: null },
        status: 200,
        statusText: '',
        headers: {},
      }
    }
    const filter = {
      statuses: ['DRAFT', 'CONFIRMED'] as ('DRAFT' | 'CONFIRMED')[],
      limit: 25,
      cursor: 'opaque',
      clientId: 7,
      supplierId: 7,
      orderedFrom: '2026-10-01T00:00:00Z',
      orderedBefore: '2026-11-01T00:00:00+08:00',
      expectedFrom: '2026-10-01T00:00:00Z',
      expectedBefore: '2026-12-01T00:00:00Z',
    }
    expect((await fetchPage(filter)).items).toHaveLength(1)
    expect(calls).toBe(1)
  },
)

it.each(['PO', 'SO'] as const)(
  '%s shows a first-page error and explicitly retries',
  async (kind) => {
    const setup = mount(kind, 'first')
    await screen.findByRole('button', { name: 'Retry' })
    expect(setup.reads.filter((read) => read.url === setup.path)).toHaveLength(1)
    expect(next().hasAttribute('disabled')).toBe(true)
    expect(previous().hasAttribute('disabled')).toBe(true)
    setup.fail('')
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByText(`${kind}-1`)
  },
)

it.each(['PO', 'SO'] as const)(
  '%s disables navigation and hides stale rows during a page request',
  async (kind) => {
    const setup = mount(kind)
    await screen.findByText(`${kind}-1`)
    let release!: () => void
    setup.holdNext(
      new Promise<void>((resolve) => {
        release = resolve
      }),
    )
    await userEvent.click(next())
    expect(next().hasAttribute('disabled')).toBe(true)
    expect(previous().hasAttribute('disabled')).toBe(true)
    expect(screen.queryByText(`${kind}-1`)).toBeNull()
    await act(async () => {
      release()
    })
    await screen.findByText(`${kind}-2`)
  },
)

it.each(['PO', 'SO'] as const)(
  '%s resets a later-page cursor when the page size changes',
  async (kind) => {
    const { reads, path } = mount(kind)
    await screen.findByText(`${kind}-1`)
    await userEvent.click(next())
    await screen.findByText(`${kind}-2`)
    await userEvent.click(screen.getByRole('combobox', { name: 'Orders per page' }))
    await userEvent.click(screen.getByRole('option', { name: '10' }))
    await screen.findByText(`${kind}-1`)
    expect(previous().hasAttribute('disabled')).toBe(true)
    expect(
      reads
        .filter((read) => read.url === path && read.params.limit === 10)
        .every((read) => !read.params.cursor),
    ).toBe(true)
  },
)

it.each([fetchSalesOrdersPageApi, fetchPurchaseOrdersPageApi])(
  'rejects invalid page sizes and repeated response cursors instead of looping',
  async (fetchPage) => {
    const adapter = vi.fn(async (config) => ({
      config,
      data: { items: [], nextCursor: 'same' },
      status: 200,
      statusText: '',
      headers: {},
    }))
    apiClient.defaults.adapter = adapter
    await expect(fetchPage({ limit: 0 })).rejects.toThrow(/Page size/)
    expect(adapter).not.toHaveBeenCalled()
    await expect(fetchPage({ cursor: 'same' })).rejects.toThrow(/invalid page/)
    expect(adapter).toHaveBeenCalledOnce()
  },
)

it.each(['PO', 'SO'] as const)(
  '%s resolves later-page party details and keeps the order dialog after it leaves the current filter',
  async (kind) => {
    const setup = mount(kind)
    setup.records[1].clientId = 2
    setup.records[1].supplierId = 2
    await screen.findByText(`${kind}-1`)
    await userEvent.click(next())
    await screen.findByText('Later Party')
    expect(
      setup.reads.some((read) => read.url === (kind === 'PO' ? '/suppliers/2' : '/clients/2')),
    ).toBe(true)
    await userEvent.click(screen.getByRole('button', { name: `More actions for ${kind}-2` }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'View Order' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog.textContent).toContain(`${kind}-2`)
    await waitFor(() =>
      expect(setup.reads.some((read) => read.url === `${setup.path}/2`)).toBe(true),
    )
    setup.records[1].status = 'CANCELLED'
    setup.records[1].revision = 5
    await act(async () => {
      await setup.client.invalidateQueries({ queryKey: [setup.path.slice(1)] })
    })
    expect(screen.getByRole('dialog').textContent).toContain(`${kind}-2`)
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getAllByText(/Cancelled/i).length).toBeGreaterThan(
        0,
      ),
    )
    expect(setup.client.getQueryData([setup.path.slice(1), 'id', 2])).toMatchObject({
      id: 2,
      status: 'CANCELLED',
      revision: 5,
    })
  },
)

it.each(['PO', 'SO'] as const)(
  '%s starts at the first page when an ordered date changes on a later page',
  async (kind) => {
    const setup = mount(kind)
    await screen.findByText(`${kind}-1`)
    await userEvent.click(next())
    await screen.findByText(`${kind}-2`)
    fireEvent.change(screen.getByLabelText('Ordered from (inclusive)'), {
      target: { value: '2026-10-01T10:00' },
    })
    await screen.findByText(`${kind}-1`)
    expect(screen.getByText('Page 1')).toBeTruthy()
    expect(
      setup.reads
        .filter((read) => read.url === setup.path && read.params.orderedFrom)
        .every((read) => !read.params.cursor),
    ).toBe(true)
  },
)

it('detects a multi-page cursor cycle and recovers without requesting the duplicate page', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const fetchPage = vi.fn(async ({ cursor }: { cursor?: string }) => ({
    items: [{ id: cursor === 'B' ? 3 : cursor === 'A' ? 2 : 1 }],
    nextCursor: cursor === 'B' ? 'A' : cursor === 'A' ? 'B' : 'A',
  }))
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result } = renderHook(() => useCursorPage('orders-test', {}, fetchPage), { wrapper })
  await waitFor(() => expect(result.current.items[0]?.id).toBe(1))
  act(() => result.current.next())
  await waitFor(() => expect(result.current.items[0]?.id).toBe(2))
  act(() => result.current.next())
  await waitFor(() => expect(result.current.isError).toBe(true))
  expect(result.current.error?.message).toMatch(/repeated a cursor/)
  expect(result.current.hasNext).toBe(false)
  act(() => result.current.next())
  expect(fetchPage).toHaveBeenCalledTimes(3)
  act(() => {
    void result.current.reload()
  })
  await waitFor(() => expect(result.current.page).toBe(1))
  await waitFor(() => expect(result.current.isError).toBe(false))
})
