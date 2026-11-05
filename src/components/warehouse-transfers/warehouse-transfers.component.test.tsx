import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError, getAdapter } from 'axios'
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
      data = { items: [{ id: 10, name: 'Test Item', unit: 'kg', isActive: true }, { id: 11, name: 'Other Item', unit: 'boxes', isActive: true }], nextCursor: null }
    if (config.url?.startsWith('/inventory-items/'))
      data = { id: Number(config.url.split('/').at(-1)), name: config.url.endsWith('/10') ? 'Test Item' : 'Other Item', unit: config.url.endsWith('/10') ? 'kg' : 'boxes', isActive: true }
    if (config.url === '/warehouse-transfers' && config.method === 'get')
      data = {
        items: [record],
        nextCursor: config.params?.cursor ? null : 'page-2',
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
      name: 'View transfer WT-000007',
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
  await userEvent.click(screen.getByRole('button', { name: 'View transfer WT-000007' }))
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
  await screen.findByText('WT-000007')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search warehouse transfers' }), { target: { value: 'WT-000007' } })
  await waitFor(() => expect(requests.some((request) => request.params?.q === 'WT-000007')).toBe(true))
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('Page 2')
  await userEvent.click(screen.getByRole('button', { name: 'Create Transfer' }))
  const dialog = within(screen.getByRole('dialog'))
  await userEvent.click(dialog.getByRole('button', { name: 'Save Transfer' }))
  expect(writes()).toHaveLength(0)
  await userEvent.click(dialog.getByRole('button', { name: 'Choose from warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Source' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Choose to warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Destination' }))
  await userEvent.click(dialog.getByRole('button', { name: 'Choose item 1' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Test Item' }))
  await userEvent.type(dialog.getByRole('textbox', { name: 'Quantity for item 1' }), '10.00')
  await userEvent.click(dialog.getByRole('button', { name: 'Save Transfer' }))
  await screen.findByRole('dialog', { name: 'WT-000007' })
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
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Review & Send' }))
  const send = within(await screen.findByRole('dialog', { name: 'Send Goods?' }))
  await userEvent.click(send.getByRole('button', { name: 'Back' }))
  await screen.findByRole('dialog', { name: 'WT-000007' })
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))
  expect(screen.getByRole('textbox', { name: 'Search warehouse transfers' }).getAttribute('value')).toBe('WT-000007')
  expect(screen.getByText('Page 2')).toBeTruthy()
  expect(writes()).toHaveLength(1)
  expect(record.status).toBe('DRAFT')
})
it('edits notes without replacing saved lines and submits the saved revision', async () => {
  mount()
  await open()
  await userEvent.click(screen.getByRole('button', { name: 'Edit Draft' }))
  await userEvent.type(screen.getByLabelText('Notes (optional)'), 'Handle with care')
  await userEvent.click(screen.getByRole('button', { name: 'Save Transfer' }))
  await screen.findByRole('dialog', { name: 'WT-000007' })
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
  await userEvent.click(screen.getByRole('button', { name: 'Review & Send' }))
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
  await screen.findByRole('dialog', { name: 'WT-000007' })
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
  await userEvent.click(screen.getByRole('button', { name: 'Review & Send' }))
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
  await screen.findByRole('button', { name: 'Review & Send' })
  await userEvent.click(screen.getByRole('button', { name: 'Review & Send' }))
  await userEvent.click(screen.getByRole('button', { name: 'Send Goods' }))
  await screen.findByRole('dialog', { name: 'WT-000007' })
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
  await userEvent.click(screen.getByRole('radio', { name: 'Some items were damaged, missing, or returned' }))
  const set = (label: string, value: string) =>
    fireEvent.change(screen.getByRole('textbox', { name: `${label} for item 10` }), {
      target: { value },
    })
  set('Received', '6.00')
  set('Damaged', '1.00')
  set('Returned \u2014 Good', '2.00')
  set('Returned \u2014 Damaged', '1.00')
  set('Missing', '1.00')
  await userEvent.click(screen.getByRole('button', { name: 'Review Receipt' }))
  expect(writes()).toHaveLength(0)
  expect(screen.getByText(/Explain the damage/)).toBeTruthy()
  await userEvent.type(screen.getByLabelText('Reason for difference for item 10'), 'Damaged and short')
  await userEvent.click(screen.getByRole('button', { name: 'Review Receipt' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save Receipt' }))
  await screen.findByRole('dialog', { name: 'WT-000007' })
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


async function openReceiving() {
  await userEvent.click(await screen.findByRole('button', { name: 'Receive Goods' }))
  return within(await screen.findByRole('dialog', { name: 'Record Goods Received' }))
}
function fillOutcomes(values = { receivedQuantity: '10.00', damagedQuantity: '0', returnedSellableQuantity: '0', returnedDamagedQuantity: '0', missingQuantity: '0' }) {
  const labels = { receivedQuantity: 'Received', damagedQuantity: 'Damaged', returnedSellableQuantity: 'Returned \u2014 Good', returnedDamagedQuantity: 'Returned \u2014 Damaged', missingQuantity: 'Missing' }
  for (const [field, value] of Object.entries(values))
    fireEvent.change(screen.getByLabelText(`${labels[field as keyof typeof labels]} for item 10`), { target: { value } })
}

it('opens an In Transit transfer directly with neutral choices and no assumed receipt', async () => {
  record = { ...record, status: 'DISPATCHED', revision: 2, dispatchedAt: '2026-11-05T01:00:00Z' }
  mount()
  const receipt = await openReceiving()
  expect(receipt.getAllByRole('radio').every((choice) => !(choice as HTMLInputElement).checked)).toBe(true)
  expect(receipt.queryByRole('textbox')).toBeNull()
  expect(receipt.getByRole('button', { name: 'Review Receipt' }).hasAttribute('disabled')).toBe(true)
  expect(receipt.getByText('WT-000007')).toBeTruthy()
  expect(receipt.getByText(/Actual departure:/).textContent).not.toContain('Not recorded')
  expect(writes()).toHaveLength(0)
  await userEvent.click(receipt.getByRole('button', { name: 'Back' }))
  await screen.findByRole('dialog', { name: 'WT-000007' })
  expect(record.status).toBe('DISPATCHED')
  expect(writes()).toHaveLength(0)
})

it('prepares full sent quantities only after selection and preserves other items during a correction', async () => {
  record = { ...record, status: 'DISPATCHED', revision: 2, items: [...record.items,
    { ...record.items[0], id: 72, inventoryItemId: 11, quantity: '2.35' }] }
  mount()
  const receipt = await openReceiving()
  await receipt.findByText('Other Item (boxes)')
  await userEvent.click(receipt.getByRole('radio', { name: 'All items received in good condition' }))
  expect(writes()).toHaveLength(0)
  const full = receipt.getAllByRole('row').slice(1)
  expect(within(full[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Test Item (kg)', '10.00', '10.00', '0.00', '0.00', '0.00', '0.00'])
  expect(within(full[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Other Item (boxes)', '2.35', '2.35', '0.00', '0.00', '0.00', '0.00'])
  await userEvent.click(receipt.getByRole('button', { name: 'Edit Quantities' }))
  expect((receipt.getByLabelText('Received for item 11') as HTMLInputElement).value).toBe('2.35')
  fillOutcomes({ receivedQuantity: '6.00', damagedQuantity: '1.00', returnedSellableQuantity: '2.00', returnedDamagedQuantity: '1.00', missingQuantity: '1.00' })
  await userEvent.type(receipt.getByLabelText('Reason for difference for item 10'), 'Damaged, returned and short')
  await userEvent.click(receipt.getByRole('button', { name: 'Review Receipt' }))
  const review = within(receipt.getByRole('region', { name: 'Review transfer receipt' }))
  expect(within(review.getAllByRole('row')[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Test Item (kg)', '10.00', '5.00', '1.00', '2.00', '1.00', '1.00'])
  expect(review.getByText('Test Item: Damaged, returned and short')).toBeTruthy()
  expect(writes()).toHaveLength(0)
  await userEvent.click(receipt.getByRole('button', { name: 'Back' }))
  expect((receipt.getByLabelText('Received for item 10') as HTMLInputElement).value).toBe('6.00')
  expect((receipt.getByLabelText('Received for item 11') as HTMLInputElement).value).toBe('2.35')
  await userEvent.click(receipt.getByRole('button', { name: 'Review Receipt' }))
  const form = receipt.getByRole('button', { name: 'Save Receipt' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await screen.findByRole('dialog', { name: 'WT-000007' })
  expect(writes()).toHaveLength(1)
  expect(writes()[0].body?.expectedRevision).toBe(2)
  const sent = writes()[0].body?.items as TransferOutcome[]
  expect(sent[0]).toMatchObject({ warehouseTransferItemId: 71, receivedQuantity: '6.00', damagedQuantity: '1.00', returnedSellableQuantity: '2.00', returnedDamagedQuantity: '1.00', missingQuantity: '1.00' })
  expect(sent[1]).toMatchObject({ warehouseTransferItemId: 72, receivedQuantity: '2.35', damagedQuantity: '0.00', returnedSellableQuantity: '0.00', returnedDamagedQuantity: '0.00', missingQuantity: '0.00' })
  expect(record.status).toBe('COMPLETED')
})

it.each(['-1', 'abc', '1.001', '9.99', '10.01'])('rejects invalid or unbalanced received counts %s before review', async (value) => {
  record = { ...record, status: 'DISPATCHED', revision: 2 }
  mount()
  const receipt = await openReceiving()
  await userEvent.click(receipt.getByRole('radio', { name: 'Some items were damaged, missing, or returned' }))
  expect((receipt.getByLabelText('Missing for item 10') as HTMLInputElement).value).toBe('')
  fillOutcomes()
  fireEvent.change(receipt.getByLabelText('Received for item 10'), { target: { value } })
  await userEvent.click(receipt.getByRole('button', { name: 'Review Receipt' }))
  expect(receipt.getAllByRole('alert').length).toBeGreaterThan(0)
  expect(receipt.queryByRole('button', { name: 'Save Receipt' })).toBeNull()
  expect(writes()).toHaveLength(0)
})

it('rejects damage above received and allows zero received only with all sent goods explicitly accounted for', async () => {
  record = { ...record, status: 'DISPATCHED', revision: 2 }
  mount()
  const receipt = await openReceiving()
  await userEvent.click(receipt.getByRole('radio', { name: 'Some items were damaged, missing, or returned' }))
  fillOutcomes({ receivedQuantity: '0', damagedQuantity: '1', returnedSellableQuantity: '0', returnedDamagedQuantity: '0', missingQuantity: '10.00' })
  await userEvent.click(receipt.getByRole('button', { name: 'Review Receipt' }))
  expect(receipt.getByText('Damage cannot exceed received quantity.')).toBeTruthy()
  expect(writes()).toHaveLength(0)
  fireEvent.change(receipt.getByLabelText('Damaged for item 10'), { target: { value: '0' } })
  await userEvent.type(receipt.getByLabelText('Reason for difference for item 10'), 'Shipment confirmed lost')
  await userEvent.click(receipt.getByRole('button', { name: 'Review Receipt' }))
  expect(writes()).toHaveLength(0)
  await userEvent.click(receipt.getByRole('button', { name: 'Save Receipt' }))
  await screen.findByRole('dialog', { name: 'WT-000007' })
  expect(writes()).toHaveLength(1)
  expect((writes()[0].body?.items as TransferOutcome[])[0]).toMatchObject({ receivedQuantity: '0', damagedQuantity: '0', missingQuantity: '10.00' })
})

it('blocks a stale receipt before writing and opens the latest saved transfer for review', async () => {
  record = { ...record, status: 'DISPATCHED', revision: 2 }
  mount()
  const receipt = await openReceiving()
  await userEvent.click(receipt.getByRole('radio', { name: 'All items received in good condition' }))
  await userEvent.click(receipt.getByRole('button', { name: 'Edit Quantities' }))
  fillOutcomes({ receivedQuantity: '9.00', damagedQuantity: '0', returnedSellableQuantity: '0', returnedDamagedQuantity: '0', missingQuantity: '1.00' })
  await userEvent.type(receipt.getByLabelText('Reason for difference for item 10'), 'One missing')
  await userEvent.click(receipt.getByRole('button', { name: 'Review Receipt' }))
  record = { ...record, revision: 3 }
  await userEvent.click(receipt.getByRole('button', { name: 'Save Receipt' }))
  await receipt.findByText(/This transfer changed.*entries have been kept/)
  expect((receipt.getByLabelText('Received for item 10') as HTMLInputElement).value).toBe('9.00')
  expect(writes()).toHaveLength(0)
  await userEvent.click(receipt.getByRole('button', { name: 'Review saved transfers' }))
  await screen.findByRole('dialog', { name: 'WT-000007' })
  await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Receive Goods' }))
  expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)
  expect(writes()).toHaveLength(0)
})

it('does not repeat an uncertain receipt when the saved transfer is already completed', async () => {
  record = { ...record, status: 'DISPATCHED', revision: 2 }
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    const response = await base(config)
    if (config.url?.endsWith('/reconcile')) throw new AxiosError('Connection lost', 'ERR_NETWORK', config)
    return response
  }
  mount()
  const receipt = await openReceiving()
  await userEvent.click(receipt.getByRole('radio', { name: 'All items received in good condition' }))
  await userEvent.click(receipt.getByRole('button', { name: 'Review Receipt' }))
  await userEvent.click(receipt.getByRole('button', { name: 'Save Receipt' }))
  await receipt.findByRole('alert')
  expect(writes()).toHaveLength(1)
  expect(screen.queryByText(/receipt saved\./)).toBeNull()
  await userEvent.click(receipt.getByRole('button', { name: 'Review saved transfers' }))
  const saved = within(await screen.findByRole('dialog', { name: 'WT-000007' }))
  expect(saved.getByText('Completed')).toBeTruthy()
  expect(saved.queryByRole('button', { name: 'Receive Goods' })).toBeNull()
  expect(saved.queryByRole('button', { name: 'Save Receipt' })).toBeNull()
  expect(writes()).toHaveLength(1)
})

it.each(['state', 'revision'])('does not report a successful departure for an unconfirmed response (%s)', async (kind) => {
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    const response = await base(config)
    if (config.url?.endsWith('/dispatch')) return { ...response, data: { ...response.data, ...(kind === 'state' ? { status: 'DRAFT' } : { revision: 1 }) } }
    return response
  }
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Review & Send' }))
  const send = within(await screen.findByRole('dialog', { name: 'Send Goods?' }))
  expect(writes()).toHaveLength(0)
  await userEvent.click(send.getByRole('button', { name: 'Send Goods' }))
  await send.findByRole('alert')
  expect(screen.queryByText(/departure recorded/)).toBeNull()
  expect(writes()).toHaveLength(1)
  expect(send.getByRole('button', { name: 'Send Goods' }).hasAttribute('disabled')).toBe(true)
})

it('preserves the destination and explains a source conflict instead of discarding input', async () => {
  mount()
  await userEvent.click(screen.getByRole('button', { name: 'Create Transfer' }))
  const draft = within(screen.getByRole('dialog'))
  await userEvent.click(draft.getByRole('button', { name: 'Choose from warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Source' }))
  await userEvent.click(draft.getByRole('button', { name: 'Choose to warehouse' }))
  expect(screen.queryByRole('menuitem', { name: 'Source' })).toBeNull()
  await userEvent.click(screen.getByRole('menuitem', { name: 'Destination' }))
  await userEvent.click(draft.getByRole('button', { name: 'Choose from warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Destination' }))
  expect(draft.getByRole('button', { name: 'Choose to warehouse' }).textContent).toContain('Destination')
  expect(draft.getByText('Choose different source and destination warehouses.')).toBeTruthy()
  await userEvent.click(draft.getByRole('button', { name: 'Save Transfer' }))
  expect(draft.getByText('Choose a different destination warehouse.')).toBeTruthy()
  expect(writes()).toHaveLength(0)
})


it.each(['dispatch', 'reconcile'] as const)('rejects unauthorized %s commands at the mutation boundary', async (action) => {
  auth.isAdmin = false
  auth.isStaff = false
  auth.isManager = false
  const client = new QueryClient()
  const { result } = renderHook(() => useTransferWrite(), { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> })
  await act(async () => {
    await expect(result.current.mutateAsync(action === 'dispatch'
      ? { action, id: 7, payload: { expectedRevision: 1 } }
      : { action, id: 7, payload: { expectedRevision: 2, items: [] } })).rejects.toThrow(/role/)
  })
  expect(writes()).toHaveLength(0)
  client.clear()
})

it('groups transfer preparation, keeps quantities when changing the source, and saves only a scheduled draft', async () => {
  mount()
  await userEvent.click(screen.getByRole('button', { name: 'Create Transfer' }))
  const draft = within(screen.getByRole('dialog'))
  for (const section of ['1. Warehouses', '2. Items to Transfer', '3. Additional Details']) expect(draft.getByRole('group', { name: section })).toBeTruthy()
  await userEvent.click(draft.getByRole('button', { name: 'Choose from warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Source' }))
  await userEvent.click(draft.getByRole('button', { name: 'Choose to warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Destination' }))
  await userEvent.click(draft.getByRole('button', { name: 'Choose item 1' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Test Item' }))
  await draft.findByText('Quantity (kg)')
  await userEvent.type(draft.getByRole('textbox', { name: 'Quantity for item 1' }), '3.75')
  await userEvent.click(draft.getByRole('button', { name: 'Add Item' }))
  expect(draft.getByRole('textbox', { name: 'Quantity for item 2' })).toBeTruthy()
  await userEvent.click(draft.getByRole('button', { name: 'Choose item 2' }))
  expect(screen.queryByRole('menuitem', { name: 'Test Item' })).toBeNull()
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Other Item' }))
  await userEvent.type(draft.getByRole('textbox', { name: 'Quantity for item 2' }), '2.00')
  expect((draft.getByRole('textbox', { name: 'Quantity for item 1' }) as HTMLInputElement).value).toBe('3.75')
  await userEvent.click(draft.getByRole('button', { name: 'Remove item 2' }))
  expect(draft.queryByRole('textbox', { name: 'Quantity for item 2' })).toBeNull()
  await userEvent.click(draft.getByRole('button', { name: 'Choose from warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Destination' }))
  expect((draft.getByRole('textbox', { name: 'Quantity for item 1' }) as HTMLInputElement).value).toBe('3.75')
  expect(draft.getByRole('button', { name: 'Choose item 1' }).textContent).toContain('Test Item')
  expect(writes()).toHaveLength(0)
  await userEvent.click(draft.getByRole('button', { name: 'Choose from warehouse' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Source' }))
  fireEvent.change(draft.getByLabelText('Scheduled Departure (Manila)'), { target: { value: '2026-11-05' } })
  await userEvent.type(draft.getByRole('textbox', { name: 'Scheduled Departure hour' }), '2')
  await userEvent.type(draft.getByRole('textbox', { name: 'Scheduled Departure minute' }), '55')
  await userEvent.click(draft.getByRole('combobox', { name: 'Scheduled Departure AM or PM' }))
  await userEvent.click(screen.getByRole('option', { name: 'PM' }))
  await userEvent.click(draft.getByRole('button', { name: 'Save Transfer' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ method: 'post', url: '/warehouse-transfers', body: { scheduledDepartureAt: '2026-11-05T14:55:00+08:00', items: [{ inventoryItemId: 10, quantity: '3.75' }] } })
  expect(record.status).toBe('DRAFT')
  expect(requests.some((request) => request.url.includes('/stock-items') || request.url.endsWith('/dispatch'))).toBe(false)
})
