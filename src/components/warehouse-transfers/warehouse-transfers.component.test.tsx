import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { apiClient } from '@/lib/api-client'
import { WarehouseTransfersPage } from './WarehouseTransfersPage'
import { transferFixture } from '@/features/warehouse-transfers/warehouse-transfers.fixtures'
import { transferReconciliationErrors } from '@/features/warehouse-transfers/warehouse-transfers.validation'
import type {
  TransferOutcome,
  WarehouseTransfer,
} from '@/features/warehouse-transfers/warehouse-transfers.types'
import { useTransferWrite } from '@/features/warehouse-transfers/warehouse-transfers.hooks'
import { validateTransfer } from '@/features/warehouse-transfers/warehouse-transfers.api'
import { renderHook } from '@testing-library/react'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
let record: WarehouseTransfer
let requests: {
  url: string
  method: string
  body?: Record<string, unknown>
  params?: Record<string, unknown>
}[]
let conflict: string
let dispatchWait: Promise<void> | undefined
beforeEach(() => {
  record = transferFixture()
  requests = []
  conflict = ''
  dispatchWait = undefined
  auth.isAdmin = true
  auth.isManager = false
  auth.isStaff = false
  apiClient.defaults.adapter = async (config) => {
    const body = config.data ? JSON.parse(config.data) : undefined
    requests.push({ url: config.url!, method: config.method!, body, params: config.params })
    let data: unknown = { items: [], nextCursor: null }
    if (config.url === '/warehouses')
      data = {
        items: [
          { id: 1, name: 'Source', isActive: true },
          { id: 2, name: 'Destination', isActive: true },
        ],
        nextCursor: null,
      }
    if (config.url?.startsWith('/warehouses/'))
      data = { id: Number(config.url.split('/').at(-1)), name: 'Warehouse', isActive: true }
    if (config.url === '/inventory-items')
      data = { items: [{ id: 10, name: 'Test Item', isActive: true }], nextCursor: null }
    if (config.url?.startsWith('/inventory-items/'))
      data = { id: 10, name: 'Test Item', isActive: true }
    if (config.url === '/warehouse-transfers' && config.method === 'get')
      data = {
        items: [record],
        nextCursor: config.params?.cursor || config.params?.q ? null : 'page-2',
      }
    if (config.url === '/warehouse-transfers' && config.method === 'post') {
      record = {
        ...record,
        ...body,
        items: body.items.map(
          (item: { inventoryItemId: number; quantity: string }, index: number) => ({
            ...transferFixture().items[0],
            ...item,
            id: 71 + index,
          }),
        ),
      }
      data = record
    }
    if (config.url === '/warehouse-transfers/7') data = record
    if (config.method === 'patch') {
      if (config.url!.endsWith('/dispatch') && dispatchWait) await dispatchWait
      if (conflict)
        throw new AxiosError('Conflict', 'ERR_BAD_REQUEST', config, undefined, {
          config,
          status: 409,
          statusText: 'Conflict',
          headers: {},
          data: { code: conflict, detail: 'Review transfer' },
        })
      if (body.expectedRevision !== record.revision) throw Error('Wrong revision')
      if (config.url!.endsWith('/draft'))
        record = { ...record, ...body, revision: record.revision + 1 }
      if (config.url!.endsWith('/dispatch'))
        record = { ...record, status: 'DISPATCHED', revision: record.revision + 1 }
      if (config.url!.endsWith('/cancel'))
        record = { ...record, status: 'CANCELLED', revision: record.revision + 1 }
      if (config.url!.endsWith('/reconcile')) {
        expect(transferReconciliationErrors(record.items, body.items)).toEqual({})
        record = {
          ...record,
          status: 'COMPLETED',
          revision: record.revision + 1,
          items: record.items.map((item, index) => ({ ...item, ...body.items[index] })),
        }
      }
      data = record
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 3 } },
  })
  render(
    <QueryClientProvider client={client}>
      <WarehouseTransfersPage />
    </QueryClientProvider>,
  )
  return client
}
async function open() {
  await screen.findByText('WT-000007')
  await userEvent.click(
    screen.getByRole('button', {
      name: 'Review Transfer',
    }),
  )
  await screen.findByRole('dialog')
  await waitFor(() => expect(screen.queryByText('Loading transfer…')).toBeNull())
}
const writes = () => requests.filter((item) => item.method === 'post' || item.method === 'patch')

it('rejects malformed actual transfer event timestamps instead of displaying an invalid date', () => {
  expect(() => validateTransfer(Object.assign(transferFixture(), { dispatchedAt: 'invalid' }))).toThrow(/incomplete transfer/)
})

it.each(['DRAFT', 'DISPATCHED', 'COMPLETED'] as const)('keeps the optional schedule distinct from actual events for %s', async (status) => {
  const dispatchedAt = status === 'DRAFT' ? null : '2026-11-04T01:00:00Z'
  const reconciledAt = status === 'COMPLETED' ? '2026-11-04T03:00:00Z' : null
  Object.assign(record, { status, dispatchedAt, reconciledAt })
  if (status === 'COMPLETED') record.items = record.items.map((item) => ({ ...item, receivedQuantity: '10.00', damagedQuantity: '0.00', returnedSellableQuantity: '0.00', returnedDamagedQuantity: '0.00', missingQuantity: '0.00' }))
  const client = mount()
  await screen.findByText('WT-000007')
  const transferRow = screen.getByText('WT-000007').closest('tr')!
  expect(transferRow.textContent).toContain('Scheduled: Not scheduled')
  if (dispatchedAt) {
    expect(transferRow.textContent).toContain('Actual:')
    expect(transferRow.querySelector('time')?.getAttribute('datetime')).toBe(dispatchedAt)
  } else {
    expect(transferRow.textContent).not.toContain('Actual:')
  }
  await userEvent.click(screen.getByRole('button', { name: status === 'DRAFT' || status === 'DISPATCHED' ? 'Review Transfer' : 'View Details' }))
  const dialog = await screen.findByRole('dialog')
  await waitFor(() => expect(within(dialog).queryByText('Loading transfer…')).toBeNull())
  const scheduled = within(dialog).getByText('Scheduled Departure').parentElement!
  expect(scheduled.textContent).toContain('Not scheduled')
  const actual = within(dialog).getByText('Actual Departure').parentElement!
  const completion = within(dialog).getByText('Completion Time').parentElement!
  expect(actual.querySelector('time')?.getAttribute('dateTime') ?? null).toBe(dispatchedAt)
  expect(completion.querySelector('time')?.getAttribute('dateTime') ?? null).toBe(reconciledAt)
  if (!dispatchedAt) expect(actual.textContent).toContain('Not recorded')
  expect(writes()).toHaveLength(0)
  client.clear()
})

it('supports manager draft creation with distinct warehouses and no stock requests', async () => {
  auth.isAdmin = false
  auth.isManager = true
  mount()
  await userEvent.click(screen.getByRole('button', { name: 'Create Transfer' }))
  const dialog = within(screen.getByRole('dialog'))
  await userEvent.click(dialog.getByRole('button', { name: 'Save Transfer' }))
  expect(writes()).toHaveLength(0)
  await userEvent.click(dialog.getByRole('button', { name: 'Choose source warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Source' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Choose destination warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Destination' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Choose item 1' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Test Item' }))
  await userEvent.type(dialog.getByRole('textbox', { name: 'Quantity for item 1' }), '10.00')
  await userEvent.click(dialog.getByRole('button', { name: 'Save Transfer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(writes()).toEqual([
    {
      url: '/warehouse-transfers',
      method: 'post',
      body: {
        sourceWarehouseId: 1,
        destinationWarehouseId: 2,
        items: [{ inventoryItemId: 10, quantity: '10.00' }],
        notes: null,
        scheduledDepartureAt: null,
      },
      params: undefined,
    },
  ])
  expect(record.status).toBe('DRAFT')
})
it('edits notes without replacing saved lines and submits the saved revision', async () => {
  mount()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Edit Draft' }))
  await userEvent.type(screen.getByLabelText('Notes'), 'Handle with care')
  await userEvent.click(screen.getByRole('button', { name: 'Save Transfer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(writes()[0].body).toEqual({ expectedRevision: 1, notes: 'Handle with care' })
  expect(record.items).toHaveLength(1)
  expect(record.revision).toBe(2)
})
it('lets Staff dispatch with confirmation and blocks duplicate submissions', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  let release!: () => void
  dispatchWait = new Promise<void>((resolve) => {
    release = resolve
  })
  const client = mount()
  await open()
  expect(screen.queryByRole('button', { name: 'Create Transfer' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Edit Draft' })).toBeNull()
  await userEvent.click(screen.getByRole('button', { name: 'Send Goods' }))
  expect(writes()).toHaveLength(0)
  const confirm = screen.getByRole('button', { name: 'Send Goods' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(record.status).toBe('DRAFT')
  expect(confirm.hasAttribute('disabled')).toBe(true)
  await act(async () => {
    release()
    await dispatchWait
  })
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(record.status).toBe('DISPATCHED')
  expect(
    client.getQueryData<WarehouseTransfer>(['warehouse-transfers', 'detail', 7])?.revision,
  ).toBe(2)
})
it.each([
  'STALE_REVISION',
  'RETRYABLE_TRANSACTION_CONFLICT',
  'TRANSFER_REPLAY_MISMATCH',
  'STOCK_CHANGED',
])('requires saved-state review after %s without automatic retries', async (code) => {
  conflict = code
  mount()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Send Goods' }))
  await userEvent.click(screen.getByRole('button', { name: 'Send Goods' }))
  await screen.findByRole('alert')
  expect(writes()).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'Send Goods' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(record.status).toBe('DRAFT')
  conflict = ''
  record = { ...record, revision: 2 }
  await userEvent.click(screen.getByRole('button', { name: 'Review saved transfers' }))
  await screen.findByRole('button', { name: 'Send Goods' })
  await userEvent.click(screen.getByRole('button', { name: 'Send Goods' }))
  await userEvent.click(screen.getByRole('button', { name: 'Send Goods' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(writes()[1].body).toEqual({ expectedRevision: 2 })
})
it('reconciles mixed outcomes with saved line IDs, required reason, and final quantity balancing', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  record = { ...record, status: 'DISPATCHED', revision: 2 }
  mount()
  await open()
  await userEvent.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Receive Goods' }),
  )
  const set = (label: string, value: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: `${label} for item 10` }), {
      target: { value },
    })
  set('Received at destination', '6.00')
  set('Damaged at destination', '1.00')
  set('Returned in good condition', '2.00')
  set('Returned damaged', '1.00')
  set('Missing', '1.00')
  await userEvent.click(screen.getByRole('button', { name: 'Save Receipt' }))
  expect(writes()).toHaveLength(0)
  expect(screen.getByText(/Explain the damage/)).toBeTruthy()
  await userEvent.type(screen.getByLabelText('Reason for difference for item 10'), 'Damaged and short')
  await userEvent.click(screen.getByRole('button', { name: 'Save Receipt' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  const payload = writes()[0].body!
  expect(payload.expectedRevision).toBe(2)
  expect((payload.items as TransferOutcome[])[0].warehouseTransferItemId).toBe(71)
  expect(record.status).toBe('COMPLETED')
})
it('requires a cancellation reason for drafts and never exposes cancellation for dispatched transfers', async () => {
  mount()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel Transfer' }))
  await userEvent.click(screen.getByRole('button', { name: 'Cancel Transfer' }))
  expect(writes()).toHaveLength(0)
  await userEvent.type(screen.getByLabelText('Cancellation reason'), 'Not required')
  await userEvent.click(screen.getByRole('button', { name: 'Cancel Transfer' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(record.status).toBe('CANCELLED')
})
it('resets filter-bound cursor pagination on search and preserves one compact footer', async () => {
  mount()
  await screen.findByText('WT-000007')
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await waitFor(() => expect(requests.some((item) => item.params?.cursor === 'page-2')).toBe(true))
  fireEvent.change(screen.getByRole('textbox', { name: 'Search warehouse transfers' }), {
    target: { value: 'WT-7' },
  })
  await waitFor(() => expect(requests.some((item) => item.params?.q === 'WT-7')).toBe(true))
  expect(requests.find((item) => item.params?.q === 'WT-7')!.params?.cursor).toBeUndefined()
  expect(screen.getByText('Page 1')).toBeTruthy()
})
it('rejects Staff draft writes at the mutation boundary', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  const client = new QueryClient()
  const { result } = renderHook(() => useTransferWrite(), {
    wrapper: ({ children }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  })
  await act(async () => {
    await expect(
      result.current.mutateAsync({
        action: 'cancel',
        id: 7,
        payload: { expectedRevision: 1, reason: 'No' },
      }),
    ).rejects.toThrow(/role/)
  })
  expect(writes()).toHaveLength(0)
})
