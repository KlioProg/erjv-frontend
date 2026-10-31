import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OrdersView } from '@/components/orders/OrdersView'
import { OrderModal } from '@/components/orders/OrderModal'
import { apiClient } from '@/lib/api-client'
import { useSalesOrderEntry } from './sales-order-entry.hooks'
import * as salesApi from './sales-orders.api'
import type { SalesOrderRecord } from './sales-orders.types'

const timestamps = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
const clients = [
  {
    id: 7,
    name: 'Customer',
    address: 'Customer address',
    isActive: true,
    contactPerson: null,
    phone: null,
    email: null,
    ...timestamps,
  },
]
const products = [1, 2].map((id) => ({
  id,
  name: `Product ${id}`,
  variety: null,
  description: null,
  unit: 'kg',
  unitPrice: '100.00',
  isActive: true,
  ...timestamps,
}))
const draft: SalesOrderRecord = {
  id: 42,
  revision: 3,
  orderNumber: 'SO-42',
  status: 'DRAFT',
  clientId: 7,
  deliveryAddress: 'Original address',
  orderedAt: '2026-10-01',
  expectedAt: '2026-11-01T15:00:00.000Z',
  confirmedAt: null,
  completedAt: null,
  cancelledAt: null,
  externalReference: 'REF',
  notes: 'Original note',
  ...timestamps,
  items: [1, 2].map((id) => ({
    id: id + 10,
    salesOrderId: 42,
    lineNumber: id,
    inventoryItemId: id,
    quantity: '2.00',
    unitPrice: '100.00',
    discountRate: '5.00',
    discountAmount: '10.00',
    taxRate: '12.00',
    taxAmount: '22.80',
    subtotalAmount: '200.00',
    taxableAmount: '190.00',
    totalAmount: '212.80',
    notes: `Line ${id}`,
    ...timestamps,
  })),
}
const submitEvent = (confirm = false) =>
  ({
    preventDefault() {},
    nativeEvent: {
      submitter: { getAttribute: () => (confirm ? 'confirm' : 'draft') },
    },
  }) as unknown as React.FormEvent<HTMLFormElement>
function setup(overrides = {}) {
  const onUpdateDraft = vi.fn().mockResolvedValue({ ...draft, revision: 4 })
  const onSubmit = vi.fn()
  const onClose = vi.fn()
  const props = {
    clients,
    products,
    cashier: 'Manager',
    draftOrder: draft,
    onUpdateDraft,
    onSubmit,
    onClose,
    ...overrides,
  }
  return { ...renderHook(() => useSalesOrderEntry(props)), onUpdateDraft, onSubmit, onClose }
}
const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
let role: 'ADMIN' | 'MANAGER' | 'STAFF' = 'ADMIN'
beforeEach(() => {
  role = 'ADMIN'
})
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 1, fullName: 'Test User' },
    isAdmin: role === 'ADMIN',
    isManager: role === 'MANAGER',
  }),
}))

describe('sales draft integration', () => {
  it('serializes required revision, explicit clears and omitted replacement lines', async () => {
    apiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe('/sales-orders/42/draft')
      expect(config.method).toBe('patch')
      expect(JSON.parse(config.data)).toEqual({
        expectedRevision: 3,
        notes: null,
        externalReference: null,
        expectedAt: null,
      })
      return { config, status: 200, statusText: 'OK', headers: {}, data: { ...draft, revision: 4 } }
    }
    await expect(
      salesApi.updateSalesOrderDraftApi(42, {
        expectedRevision: 3,
        notes: null,
        externalReference: null,
        expectedAt: null,
      }),
    ).resolves.toMatchObject({ revision: 4 })
  })

  it('loads persisted identity and submits a notes-only update without replacing lines', async () => {
    const { result, onUpdateDraft, onSubmit } = setup()
    expect(result.current.clientId).toBe('7')
    expect(result.current.lines).toHaveLength(2)
    act(() => result.current.setNotes('Changed note'))
    await act(() => result.current.submit(submitEvent()))
    expect(onUpdateDraft).toHaveBeenCalledExactlyOnceWith(42, {
      expectedRevision: 3,
      notes: 'Changed note',
    })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('replaces the entire intended line set and preserves saved line terms', async () => {
    const { result, onUpdateDraft } = setup()
    act(() => result.current.updateLine(result.current.lines[0].formId, 'quantity', '3.25'))
    act(() => result.current.updateLine(result.current.lines[0].formId, 'unitPrice', '120'))
    await act(() => result.current.submit(submitEvent()))
    expect(onUpdateDraft.mock.calls[0][1]).toEqual({
      expectedRevision: 3,
      items: [
        {
          inventoryItemId: 1,
          quantity: '3.25',
          unitPrice: '120',
          discountRate: '5.00',
          taxRate: '12.00',
          notes: 'Line 1',
        },
        {
          inventoryItemId: 2,
          quantity: '2.00',
          unitPrice: '100.00',
          discountRate: '5.00',
          taxRate: '12.00',
          notes: 'Line 2',
        },
      ],
    })
  })

  it.each(['CONFIRMED', 'CANCELLED', 'DELIVERED'] as const)(
    'blocks editing a %s order',
    async (status) => {
      const { result, onUpdateDraft } = setup({ draftOrder: { ...draft, status } })
      await act(() => result.current.submit(submitEvent()))
      expect(onUpdateDraft).not.toHaveBeenCalled()
      expect(result.current.error).toMatch(/draft/i)
    },
  )

  it('preserves unsaved input on stale revision and requires deliberate reload before saving', async () => {
    const latest = {
      ...draft,
      revision: 5,
      notes: 'Another user note',
      items: draft.items.map((item) => ({ ...item, id: item.id + 100 })),
    }
    const onLoadLatest = vi.fn().mockResolvedValue(latest)
    const onUpdateDraft = vi
      .fn()
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: {
          status: 409,
          data: { code: 'STALE_REVISION', details: { currentRevision: 5 } },
        },
      })
      .mockResolvedValueOnce({ ...latest, revision: 6 })
    const { result } = setup({ onLoadLatest, onUpdateDraft })
    act(() => result.current.setNotes('My unsaved note'))
    await act(() => result.current.submit(submitEvent()))
    await waitFor(() => expect(onLoadLatest).toHaveBeenCalledOnce())
    expect(result.current.notes).toBe('My unsaved note')
    expect(result.current.conflict?.latest?.revision).toBe(5)
    await act(() => result.current.submit(submitEvent()))
    expect(onUpdateDraft).toHaveBeenCalledTimes(1)
    act(() => result.current.reloadLatestDraft())
    expect(result.current.notes).toBe('Another user note')
    act(() => result.current.setNotes('Reviewed note'))
    await act(() => result.current.submit(submitEvent()))
    expect(onUpdateDraft).toHaveBeenLastCalledWith(42, {
      expectedRevision: 5,
      notes: 'Reviewed note',
    })
  })

  it('increments a selected product once per click, preserves fractional input, and leaves cleared input empty', () => {
    const { result } = setup({ draftOrder: undefined })
    act(() => result.current.addProduct(products[0]))
    act(() => result.current.addProduct(products[0]))
    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0].quantity).toBe('2')
    act(() => result.current.updateLine(result.current.lines[0].formId, 'quantity', '2.25'))
    act(() => result.current.addProduct(products[0]))
    expect(result.current.lines[0].quantity).toBe('3.25')
    act(() => result.current.updateLine(result.current.lines[0].formId, 'quantity', ''))
    expect(result.current.lines[0].quantity).toBe('')
  })

  it('guards two updates dispatched before React renders the pending state', async () => {
    let finish!: (order: SalesOrderRecord) => void
    const onUpdateDraft = vi.fn(
      () =>
        new Promise<SalesOrderRecord>((resolve) => {
          finish = resolve
        }),
    )
    const { result, onClose } = setup({ onUpdateDraft })
    act(() => result.current.setNotes('Changed'))
    let first!: Promise<void>
    act(() => {
      first = result.current.submit(submitEvent())
      void result.current.submit(submitEvent())
    })
    expect(onUpdateDraft).toHaveBeenCalledOnce()
    await act(async () => {
      finish({ ...draft, revision: 4 })
      await first
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps independent form identities and saves verified fixed-discount draft replacement without losing edits', async () => {
    const repeated = {
      ...draft,
      items: [
        draft.items[0],
        { ...draft.items[1], inventoryItemId: 1, discountRate: '0.00', discountAmount: '12.34' },
      ],
    }
    const { result, onUpdateDraft } = setup({ draftOrder: repeated })
    expect(result.current.lines[0].formId).not.toBe(result.current.lines[1].formId)
    act(() => result.current.updateLine(result.current.lines[1].formId, 'quantity', '3'))
    expect(result.current.lines[0].quantity).toBe('2.00')
    expect(result.current.amounts?.total).toBe('534.98')
    await act(() => result.current.submit(submitEvent()))
    expect(onUpdateDraft).toHaveBeenCalledOnce()
    expect(onUpdateDraft.mock.calls[0][1].items[1]).toMatchObject({
      quantity: '3',
      discountAmount: '12.34',
    })
    expect(result.current.error).toBe('')
    expect(result.current.lines[1].quantity).toBe('3')
    expect(result.current.lines[1].discount.peso).toBe('12.34')
  })

  it('fills delayed product names and units without resetting edited quantities', () => {
    const props = {
      clients,
      cashier: 'Manager',
      draftOrder: draft,
      onUpdateDraft: vi.fn(),
      onSubmit: vi.fn(),
      onClose: vi.fn(),
    }
    const { result, rerender } = renderHook(
      ({ catalog }) => useSalesOrderEntry({ ...props, products: catalog }),
      { initialProps: { catalog: [] as typeof products } },
    )
    expect(result.current.lines[0].name).toBe('Product #1')
    act(() => result.current.updateLine(result.current.lines[0].formId, 'quantity', '4.50'))
    rerender({ catalog: products })
    expect(result.current.lines[0]).toMatchObject({
      name: 'Product 1',
      unit: 'kg',
      quantity: '4.50',
    })
  })

  it('updates only the selected customer while retaining address and lines', async () => {
    const { result, onUpdateDraft } = setup({
      clients: [
        ...clients,
        { ...clients[0], id: 8, name: 'Other customer', address: 'Other address' },
      ],
    })
    act(() => result.current.changeClient('8'))
    expect(result.current.deliveryAddress).toBe('Original address')
    await act(() => result.current.submit(submitEvent()))
    expect(onUpdateDraft).toHaveBeenCalledExactlyOnceWith(42, { expectedRevision: 3, clientId: 8 })
  })

  it('clears nullable header fields explicitly and retains all remaining lines on removal', async () => {
    const { result, onUpdateDraft } = setup()
    act(() => {
      result.current.setNotes('')
      result.current.setReference('')
      result.current.setExpectedAt('')
      result.current.removeLine(result.current.lines[0].formId)
    })
    await act(() => result.current.submit(submitEvent()))
    expect(onUpdateDraft.mock.calls[0][1]).toMatchObject({
      expectedRevision: 3,
      notes: null,
      externalReference: null,
      expectedAt: null,
      items: [{ inventoryItemId: 2, quantity: '2.00', notes: 'Line 2' }],
    })
    expect(onUpdateDraft.mock.calls[0][1].items).toHaveLength(1)
  })

  it('confirms the same saved identity after updating rather than creating another order', async () => {
    const onConfirm = vi.fn().mockResolvedValue({ ...draft, revision: 4, status: 'CONFIRMED' })
    const { result, onSubmit, onUpdateDraft } = setup({ onConfirm })
    act(() => result.current.setNotes('Ready'))
    await act(() => result.current.submit(submitEvent(true)))
    expect(onUpdateDraft).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(42, 4)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('keeps edits through latest-version fetch failure and handles a concurrently confirmed order', async () => {
    const onLoadLatest = vi
      .fn()
      .mockRejectedValueOnce(new Error('Offline'))
      .mockResolvedValueOnce({ ...draft, revision: 5, status: 'CONFIRMED' })
    const onUpdateDraft = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { code: 'STALE_REVISION', details: { currentRevision: 5 } },
      },
    })
    const { result } = setup({ onLoadLatest, onUpdateDraft })
    act(() => result.current.setNotes('Unsaved'))
    await act(() => result.current.submit(submitEvent()))
    expect(result.current.notes).toBe('Unsaved')
    expect(result.current.conflict?.error).toBeTruthy()
    await act(() => result.current.fetchLatestDraft())
    act(() => result.current.reloadLatestDraft())
    await act(() => result.current.submit(submitEvent()))
    expect(onUpdateDraft).toHaveBeenCalledOnce()
    expect(result.current.error).toContain('Only a Draft')
  })

  it('blocks editing when an older backend response lacks a revision', async () => {
    const legacy = { ...draft, revision: undefined } as unknown as SalesOrderRecord
    const { result, onUpdateDraft } = setup({ draftOrder: legacy })
    await act(() => result.current.submit(submitEvent()))
    expect(onUpdateDraft).not.toHaveBeenCalled()
    expect(result.current.error).toContain('did not provide a revision')
  })

  it('offers Edit Draft from a saved record and refreshes cached revision after saving', async () => {
    role = 'MANAGER'
    const user = userEvent.setup()
    const requests: { method?: string; url?: string; data: unknown }[] = []
    apiClient.defaults.adapter = async (config) => {
      const url = config.url
      requests.push({ method: config.method, url, data: config.data && JSON.parse(config.data) })
      const data =
        config.method === 'patch'
          ? { ...draft, revision: 4, notes: 'Changed through UI' }
          : url === '/sales-orders'
            ? { items: [draft], nextCursor: null }
            : url === '/sales-orders/42'
              ? draft
              : url === '/inventory-items/1' ? products.find(product => product.id === 1)
              : url?.startsWith('/clients/') ? clients.find(client => client.id === Number(url.split('/')[2]))
              : url === '/clients'
                ? clients
                : url === '/inventory-items'
                  ? products
                  : []
      return { config, status: 200, statusText: 'OK', headers: {}, data }
    }
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <OrdersView />
      </QueryClientProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'More actions for SO-42' }))
    await user.click(screen.getByRole('menuitem', { name: 'Edit Draft' }))
    const editor = await screen.findByRole('dialog', { name: 'Edit Draft SO-42' })
    expect(within(editor).getByRole('textbox', { name: 'Quantity for Product 1' })).toBeTruthy()
    await user.clear(screen.getByLabelText('Notes'))
    await user.type(screen.getByLabelText('Notes'), 'Changed through UI')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Edit Draft SO-42' })).toBeNull(),
    )
    expect(requests.filter((request) => request.method !== 'get')).toEqual([
      {
        method: 'patch',
        url: '/sales-orders/42/draft',
        data: { expectedRevision: 3, notes: 'Changed through UI' },
      },
    ])
    expect(
      queryClient.getQueryData<SalesOrderRecord>(['sales-orders', 'number', 'SO-42'])?.revision,
    ).toBe(4)
    queryClient.clear()
  })

  it('does not expose draft editing to staff', async () => {
    role = 'STAFF'
    const user = userEvent.setup()
    apiClient.defaults.adapter = async (config) => ({
      config,
      status: 200,
      statusText: 'OK',
      headers: {},
      data: config.url === '/sales-orders' ? { items: [draft], nextCursor: null } : config.url === '/sales-orders/42' ? draft : config.url === '/clients/7' ? clients[0] : config.url === '/inventory-items/1' ? products[0] : config.url === '/outgoing-deliveries' ? { items: [], nextCursor: null } : [],
    })
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <OrdersView />
      </QueryClientProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'View sales order SO-42' }))
    await screen.findByRole('dialog', { name: /SO-42/ })
    await screen.findByText('Product 1')
    expect(screen.queryByRole('button', { name: 'Edit Draft' })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Edit Draft' })).toBeNull()
    queryClient.clear()
  })

  it('preserves edits in the conflict UI until explicitly reloading and disables both submit actions', async () => {
    const user = userEvent.setup()
    const onUpdateDraft = vi.fn().mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 409,
        data: { code: 'STALE_REVISION', details: { currentRevision: 4 } },
      },
    })
    render(
      <OrderModal
        open
        clients={clients}
        products={products}
        cashier="Manager"
        draftOrder={draft}
        onUpdateDraft={onUpdateDraft}
        onLoadLatest={vi.fn().mockResolvedValue({ ...draft, revision: 4, notes: 'Server note' })}
        onSubmit={vi.fn()}
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />,
    )
    await user.clear(screen.getByLabelText('Notes'))
    await user.type(screen.getByLabelText('Notes'), 'My note')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText(/Another user or process/)).toBeTruthy()
    expect((screen.getByLabelText('Notes') as HTMLInputElement).value).toBe('My note')
    for (const name of ['Save Draft', 'Confirm Order'])
      expect((screen.getByRole('button', { name }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.submit(screen.getByRole('button', { name: 'Save Draft' }).closest('form')!)
    expect(onUpdateDraft).toHaveBeenCalledOnce()
    await user.click(screen.getByText('Review latest server values (revision 4)'))
    expect(screen.getByText('Server note')).toBeTruthy()
    await user.click(
      screen.getByRole('button', { name: 'Reload latest draft and discard my edits' }),
    )
    expect((screen.getByLabelText('Notes') as HTMLInputElement).value).toBe('Server note')
    expect((screen.getByRole('button', { name: 'Save Draft' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })
})
