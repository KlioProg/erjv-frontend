import { openDeliveryRecord, startDeliveryAction } from '@/test/delivery-record'
import { toast } from '@/lib/notifications'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { apiClient } from '@/lib/api-client'
import { DeliveriesHub } from './DeliveriesHub'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { AxiosAdapter } from 'axios'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const adapter = apiClient.defaults.adapter
let order: PurchaseOrderRecord
let draft: IncomingDeliveryRecord
let requests: { url: string; method: string }[]
let orderFails: boolean
let rejection: boolean
let activeWarehouse: boolean
let warehouseFails: boolean
let correctionRejected: boolean
let orderGate: Promise<void> | undefined
beforeEach(() => {
  vi.spyOn(toast, 'success').mockReturnValue('success')
  auth.isAdmin = true
  requests = []
  correctionRejected = false
  auth.isManager = false
  orderFails = false
  rejection = false
  activeWarehouse = true
  warehouseFails = false
  orderGate = undefined
  order = {
    id: 2,
    revision: 1,
    orderNumber: 'PO-000002',
    status: 'CONFIRMED',
    supplierId: null,
    items: [],
    orderedAt: '',
    expectedAt: null,
    confirmedAt: null,
    completedAt: null,
    cancelledAt: null,
    externalReference: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
  }
  draft = {
    id: 66,
    revision: 1,
    deliveryNumber: 'ID-000066',
    purchaseOrderId: 2,
    warehouseId: 1,
    status: 'DRAFT',
    scheduledAt: '2026-12-01T01:00:00Z',
    completedAt: null,
    cancelledAt: null,
    supplierReference: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    items: [],
  }
  apiClient.defaults.adapter = async (config) => {
    const url = config.url!
    requests.push({ url, method: config.method! })
    let data: unknown = { items: [], nextCursor: null }
    if (url === '/incoming-deliveries') data = { items: [draft], nextCursor: null }
    if (url === '/incoming-deliveries/66') data = draft
    if (url === '/purchase-orders/2') {
      if (orderGate) await orderGate
      if (orderFails) throw Error('offline')
      data = structuredClone(order)
    }
    if (url === '/warehouses' && warehouseFails) throw Error('offline')
    if (url === '/warehouses')
      data = {
        items: [
          { id: 1, name: 'Main', isActive: activeWarehouse },
          { id: 2, name: 'Backup', isActive: true },
        ],
        nextCursor: null,
      }
    if (url === '/warehouses/2') data = { id: 2, name: 'Backup', isActive: true }
    if (url === '/warehouses/1') data = { id: 1, name: 'Main', isActive: activeWarehouse }
    if (url === '/incoming-deliveries/66/draft') {
      const payload = JSON.parse(config.data)
      if (correctionRejected || payload.expectedRevision !== draft.revision)
        throw {
          isAxiosError: true,
          response: {
            status: 409,
            data: {
              code: 'STALE_REVISION',
              message: 'Incoming delivery changed; reload before continuing',
            },
          },
        }
      draft = { ...draft, ...payload, revision: draft.revision + 1 }
      data = draft
    }
    if (url === '/incoming-deliveries/66/schedule') {
      if (rejection)
        throw {
          isAxiosError: true,
          response: {
            status: 409,
            data: {
              code: 'INVALID_ORDER_STATE',
              message: 'Purchase order is not receivable',
              details: { currentStatus: 'RECEIVED' },
            },
          },
        }
      draft = { ...draft, revision: 2, status: 'SCHEDULED' }
      data = draft
    }
    return { config, status: 200, statusText: '', headers: {}, data }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = adapter
  vi.restoreAllMocks()
})
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DeliveriesHub initialTab="incoming" />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}
const writes = () => requests.filter((request) => request.method !== 'get')
const open = async () => {
  await startDeliveryAction('ID-000066', 'Schedule Arrival')
  return within(await screen.findByRole('dialog', { name: 'Schedule Arrival' }))
}

it('keeps a received-order draft compact and discloses its explanation only in details', async () => {
  order.status = 'RECEIVED'
  mount()
  expect(await screen.findByText('PO already received')).toBeTruthy()
  const row = within(screen.getByRole('row', { name: /ID-000066/ }))
  expect(row.getByText('Draft')).toBeTruthy()
  expect(row.queryByText(/All goods for this purchase order/)).toBeNull()
  expect(row.queryByText(/This draft remains saved/)).toBeNull()
  expect(row.getAllByRole('cell')).toHaveLength(7)
  expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
    'Delivery #',
    'Purchase Order',
    'Supplier',
    'Schedule',
    'Delivery Status',
    'Issue',
    'Next Action',
  ])
  expect(screen.queryByRole('button', { name: 'Schedule Arrival ID-000066' })).toBeNull()
  const user = userEvent.setup()
  expect(row.queryByRole('button', { name: 'More actions for ID-000066' })).toBeNull()
  await user.click(row.getByRole('button', { name: 'View delivery ID-000066' }))
  const details = within(await screen.findByRole('dialog', { name: 'ID-000066' }))
  expect(details.getByText('Purchase Order Already Received')).toBeTruthy()
  expect(details.getByText(/All goods for this purchase order/)).toBeTruthy()
  expect(await details.findByRole('button', { name: 'Cancel Delivery' })).toBeTruthy()
  expect(draft.status).toBe('DRAFT')
  expect(writes()).toHaveLength(0)
})

it.each(['CONFIRMED', 'PARTIALLY_RECEIVED'] as const)(
  'schedules a %s order only after fresh checks and confirmation',
  async (status) => {
    order.status = status
    mount()
    const dialog = await open()
    const confirm = await dialog.findByRole('button', { name: 'Schedule Arrival' })
    await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false))
    expect(
      requests.filter((request) => request.url === '/purchase-orders/2').length,
    ).toBeGreaterThanOrEqual(2)
    expect(writes()).toHaveLength(0)
    fireEvent.click(confirm)
    await waitFor(() => expect(writes()).toHaveLength(1))
    expect(writes()[0].url).toBe('/incoming-deliveries/66/schedule')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: 'View Details' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Receive Goods' })).toBeNull()
  },
)

it('reopens a scheduled arrival before its planned date and refreshes a receipt saved by another employee', async () => {
  draft.status = 'SCHEDULED'
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'View delivery ID-000066' }))
  const details = within(await screen.findByRole('dialog', { name: 'ID-000066' }))
  const receive = await screen.findByRole('button', { name: 'Receive Goods ID-000066', hidden: true })
  await waitFor(() => expect(receive.hasAttribute('disabled')).toBe(false))
  expect(details.queryByText('Received at')).toBeNull()
  expect(writes()).toHaveLength(0)
  await user.keyboard('{Escape}')
  draft = { ...draft, status: 'COMPLETED', revision: 3, completedAt: '2026-11-11T02:00:00Z' }
  await user.click(screen.getByRole('button', { name: 'View delivery ID-000066' }))
  const resumed = within(await screen.findByRole('dialog', { name: 'ID-000066' }))
  expect(await resumed.findByText('Received at')).toBeTruthy()
  expect(resumed.queryByRole('button', { name: /^Receive Goods/ })).toBeNull()
  expect(requests.filter((request) => request.url === '/incoming-deliveries/66')).toHaveLength(2)
  expect(writes()).toHaveLength(0)
})

it.each(['unavailable', 'missing'])(
  'blocks receiving from stale details when the current incoming record is %s',
  async (failure) => {
    draft.status = 'SCHEDULED'
    const base = apiClient.defaults.adapter as AxiosAdapter
    apiClient.defaults.adapter = async (config) => {
      if (config.url === '/incoming-deliveries/66') {
        if (failure === 'unavailable') throw Error('Current arrival unavailable')
        return { config, status: 200, statusText: 'OK', headers: {}, data: null }
      }
      return base(config)
    }
    mount()
    await userEvent.click(await screen.findByRole('button', { name: 'View delivery ID-000066' }))
    const details = within(await screen.findByRole('dialog', { name: 'ID-000066' }))
    await details.findByRole('alert')
    expect(details.queryByRole('button', { name: /^Receive Goods/ })).toBeNull()
    expect(details.getByRole('button', { name: 'Refresh delivery' })).toBeTruthy()
    expect(writes()).toHaveLength(0)
  },
)

it('rechecks a warm cached order on opening and stops a newly received order', async () => {
  mount()
  await screen.findByRole('button', { name: 'View delivery ID-000066' })
  order.status = 'RECEIVED'
  const dialog = await open()
  expect(await dialog.findByText('Purchase Order Already Received')).toBeTruthy()
  expect(dialog.getByRole('button', { name: 'Schedule Arrival' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(dialog.getByRole('button', { name: 'View Purchase Order' })).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('stops a purchase order that becomes received after the scheduling dialog opens', async () => {
  mount()
  const dialog = await open()
  const confirm = dialog.getByRole('button', { name: 'Schedule Arrival' })
  await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false))
  order.status = 'RECEIVED'
  fireEvent.click(confirm)
  expect(await dialog.findByText(/All goods for this purchase order have already/)).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('fails closed when eligibility cannot be checked and supports explicit recovery', async () => {
  mount()
  await screen.findByRole('button', { name: 'View delivery ID-000066' })
  orderFails = true
  const dialog = await open()
  expect(await dialog.findByText(/Unable to verify/)).toBeTruthy()
  expect(dialog.getByRole('button', { name: 'Schedule Arrival' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(writes()).toHaveLength(0)
  orderFails = false
  fireEvent.click(dialog.getByRole('button', { name: 'Recheck Eligibility' }))
  await waitFor(() =>
    expect(dialog.getByRole('button', { name: 'Schedule Arrival' }).hasAttribute('disabled')).toBe(
      false,
    ),
  )
})

it('explains a backend eligibility rejection without retrying or exposing raw enums', async () => {
  rejection = true
  mount()
  const dialog = await open()
  const confirm = dialog.getByRole('button', { name: 'Schedule Arrival' })
  await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false))
  fireEvent.click(confirm)
  expect(await dialog.findByText(/All goods for this purchase order have already/)).toBeTruthy()
  expect(dialog.getByRole('alert').textContent).not.toContain('INVALID_ORDER_STATE')
  expect(writes()).toHaveLength(1)
  expect(confirm.hasAttribute('disabled')).toBe(true)
})

it.each(['DRAFT', 'CANCELLED'] as const)(
  'does not offer scheduling for a %s purchase order',
  async (status) => {
    order.status = status
    mount()
    await screen.findByText('Needs review')
    fireEvent.click(screen.getByRole('button', { name: 'View delivery ID-000066' }))
    expect(
      await screen.findByText(
        status === 'DRAFT' ? 'Purchase Order Not Confirmed' : 'Purchase Order Cancelled',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Schedule Arrival ID-000066' })).toBeNull()
    expect(writes()).toHaveLength(0)
  },
)

it('does not trust a cached eligible order after a reference refresh fails', async () => {
  const client = mount()
  await screen.findByRole('button', { name: 'View delivery ID-000066' })
  orderFails = true
  await client.invalidateQueries({ queryKey: ['purchase-orders'] })
  expect(await screen.findByText('Needs review')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'View delivery ID-000066' }))
  expect(await screen.findByText('Purchase Order Eligibility Unavailable')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Schedule Arrival ID-000066' })).toBeNull()
  expect(writes()).toHaveLength(0)
})

it('keeps confirmation disabled while fresh eligibility is loading', async () => {
  mount()
  await screen.findByRole('button', { name: 'View delivery ID-000066' })
  let release!: () => void
  orderGate = new Promise<void>((resolve) => {
    release = resolve
  })
  const dialog = await open()
  expect(dialog.getByRole('status').textContent).toContain('Checking current')
  expect(dialog.getByRole('button', { name: 'Schedule Arrival' }).hasAttribute('disabled')).toBe(
    true,
  )
  release()
  await waitFor(() =>
    expect(dialog.getByRole('button', { name: 'Schedule Arrival' }).hasAttribute('disabled')).toBe(
      false,
    ),
  )
  expect(writes()).toHaveLength(0)
})

it.each(['warehouse', 'date', 'revision', 'status'] as const)(
  'rechecks the delivery %s before sending a scheduling mutation',
  async (change) => {
    mount()
    const dialog = await open()
    const confirm = dialog.getByRole('button', { name: 'Schedule Arrival' })
    await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false))
    if (change === 'warehouse') activeWarehouse = false
    if (change === 'date') draft = { ...draft, scheduledAt: null }
    if (change === 'revision') draft = { ...draft, revision: 2 }
    if (change === 'status') draft = { ...draft, status: 'CANCELLED' }
    fireEvent.click(confirm)
    await dialog.findByRole('alert')
    expect(writes()).toHaveLength(0)
    expect(dialog.getByRole('button', { name: 'Schedule Arrival' }).hasAttribute('disabled')).toBe(
      true,
    )
  },
)

it('stops scheduling if management permission is lost while the dialog is open', async () => {
  const client = mount()
  const dialog = await open()
  const confirm = dialog.getByRole('button', { name: 'Schedule Arrival' })
  await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(false))
  auth.isAdmin = false
  await client.invalidateQueries({ queryKey: ['incoming-deliveries'] })
  await waitFor(() => expect(confirm.hasAttribute('disabled')).toBe(true))
  fireEvent.click(confirm)
  expect(writes()).toHaveLength(0)
})

it('does not offer scheduling when the saved draft has no arrival date', async () => {
  draft = { ...draft, scheduledAt: null }
  mount()
  await screen.findByText('Needs review')
  fireEvent.click(screen.getByRole('button', { name: 'View delivery ID-000066' }))
  expect(await screen.findByText('Arrival Date Required')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Schedule Arrival ID-000066' })).toBeNull()
  expect(writes()).toHaveLength(0)
})

it('offers eligible scheduling directly in the table while keeping details informational', async () => {
  mount()
  const details = await openDeliveryRecord('ID-000066')
  expect(details.queryByRole('button', { name: /^Schedule Arrival/ })).toBeNull()
  expect(await screen.findByRole('button', { name: 'Schedule Arrival ID-000066', hidden: true })).toBeTruthy()
  expect(writes()).toHaveLength(0)
})
it('keeps read-only users able to review delivery and order navigation', async () => {
  auth.isAdmin = false
  mount()
  const details = await openDeliveryRecord('ID-000066')
  expect(details.getByRole('button', { name: /View purchase order/ })).toBeTruthy()
  expect(details.queryByRole('button', { name: 'Cancel Delivery' })).toBeNull()
  expect(details.queryByRole('button', { name: /^Schedule Arrival/ })).toBeNull()
  expect(writes()).toHaveLength(0)
})

const review = async () => {
  fireEvent.click(await screen.findByRole('button', { name: 'View delivery ID-000066' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'ID-000066' }))
  await waitFor(() => expect(dialog.queryByText('Refreshing incoming delivery…')).toBeNull())
  return dialog
}
async function enterArrival() {
  fireEvent.change(screen.getByLabelText('Arrival date and time Date'), {
    target: { value: '2026-12-02' },
  })
  fireEvent.change(screen.getByLabelText('Arrival date and time Time'), {
    target: { value: '09:00' },
  })
}
it('corrects an arrival date in details and offers scheduling after authoritative refresh', async () => {
  draft.scheduledAt = null
  mount()
  const details = await review()
  fireEvent.click(await details.findByRole('button', { name: 'Correct Arrival Date' }))
  await enterArrival()
  fireEvent.click(details.getByRole('button', { name: 'Save Correction' }))
  expect(await screen.findByRole('button', { name: 'Schedule Arrival ID-000066', hidden: true })).toBeTruthy()
  expect(details.queryByText('Arrival Date Required')).toBeNull()
  expect(await details.findByRole('button', { name: 'Schedule Arrival' })).toBeTruthy()
  expect(writes()).toEqual([{ url: '/incoming-deliveries/66/draft', method: 'patch' }])
  expect(draft.status).toBe('DRAFT')
})
it('rechecks an unverified warehouse without guessing that it needs correction', async () => {
  const client = mount()
  await screen.findByRole('button', { name: 'Schedule Arrival ID-000066' })
  warehouseFails = true
  await client.invalidateQueries({ queryKey: ['warehouses'] })
  fireEvent.click(await screen.findByRole('button', { name: 'Review Issue' }))
  const details = within(await screen.findByRole('dialog', { name: 'ID-000066' }))
  expect(await details.findByText('Receiving Warehouse Unavailable')).toBeTruthy()
  expect(details.queryByRole('button', { name: 'Correct Warehouse' })).toBeNull()
  expect(details.queryByRole('button', { name: 'Schedule Arrival' })).toBeNull()
  warehouseFails = false
  fireEvent.click(details.getByRole('button', { name: 'Recheck Issue' }))
  expect(await details.findByRole('button', { name: 'Schedule Arrival' })).toBeTruthy()
  expect(writes()).toHaveLength(0)
})
it('retains a refresh issue when a correction saves but its parent cannot be revalidated', async () => {
  draft.scheduledAt = null
  const base = apiClient.defaults.adapter as AxiosAdapter
  apiClient.defaults.adapter = async (config) => {
    const response = await base(config)
    if (config.url === '/incoming-deliveries/66/draft') orderFails = true
    return response
  }
  mount()
  const details = await review()
  fireEvent.click(await details.findByRole('button', { name: 'Correct Arrival Date' }))
  await enterArrival()
  fireEvent.click(details.getByRole('button', { name: 'Save Correction' }))
  expect(await details.findByText('Purchase Order Eligibility Unavailable')).toBeTruthy()
  expect(details.queryByRole('button', { name: 'Schedule Arrival' })).toBeNull()
  expect(draft.scheduledAt).toBe('2026-12-02T01:00:00.000Z')
  expect(draft.status).toBe('DRAFT')
  expect(writes()).toEqual([{ url: '/incoming-deliveries/66/draft', method: 'patch' }])
})
it('keeps the issue after a rejected correction and prevents blind retry', async () => {
  draft.scheduledAt = null
  correctionRejected = true
  mount()
  const details = await review()
  fireEvent.click(await details.findByRole('button', { name: 'Correct Arrival Date' }))
  await enterArrival()
  fireEvent.click(details.getByRole('button', { name: 'Save Correction' }))
  expect(await details.findByText(/Close the edit section and refresh/)).toBeTruthy()
  expect(details.getByText('Arrival Date Required')).toBeTruthy()
  expect(details.getByRole('button', { name: 'Save Correction' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(writes()).toHaveLength(1)
})
it('keeps unsaved correction local and blocks it when another employee changes the delivery', async () => {
  draft.scheduledAt = null
  const client = mount()
  const details = await review()
  fireEvent.click(await details.findByRole('button', { name: 'Correct Arrival Date' }))
  await enterArrival()
  draft = { ...draft, revision: 2 }
  await client.invalidateQueries({ queryKey: ['incoming-deliveries'] })
  expect(await details.findByText(/changed while you were editing/)).toBeTruthy()
  expect(details.getByRole('button', { name: 'Save Correction' }).hasAttribute('disabled')).toBe(
    true,
  )
  fireEvent.click(details.getByRole('button', { name: 'Close Edit' }))
  expect(draft.scheduledAt).toBeNull()
  expect(writes()).toHaveLength(0)
})
it('explains missing correction permission without exposing an editor', async () => {
  auth.isAdmin = false
  draft.scheduledAt = null
  mount()
  const details = await review()
  expect(details.getByText(/Ask an administrator or manager/)).toBeTruthy()
  expect(details.queryByRole('button', { name: 'Correct Arrival Date' })).toBeNull()
  expect(writes()).toHaveLength(0)
})
it.each(['DRAFT', 'CANCELLED', 'RECEIVED'] as const)(
  'opens the linked %s purchase order and restores the same delivery on close',
  async (status) => {
    order.status = status
    mount()
    const details = await review()
    fireEvent.click(details.getByRole('button', { name: 'Review Purchase Order' }))
    const parent = within(await screen.findByRole('dialog', { name: 'PO-000002' }))
    await waitFor(() =>
      expect(parent.getAllByRole('button', { name: 'Close' })[0].hasAttribute('disabled')).toBe(
        false,
      ),
    )
    fireEvent.click(parent.getAllByRole('button', { name: 'Close' })[0])
    expect(await screen.findByRole('dialog', { name: 'ID-000066' })).toBeTruthy()
    expect(writes()).toHaveLength(0)
  },
)

it('corrects an inactive receiving warehouse within delivery details', async () => {
  activeWarehouse = false
  mount()
  const details = await review()
  fireEvent.click(await details.findByRole('button', { name: 'Correct Warehouse' }))
  const user = userEvent.setup()
  await user.click(details.getByRole('button', { name: 'Receiving warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Backup' }))
  fireEvent.click(details.getByRole('button', { name: 'Save Correction' }))
  expect(await screen.findByRole('button', { name: 'Schedule Arrival ID-000066', hidden: true })).toBeTruthy()
  expect(draft.warehouseId).toBe(2)
  expect(writes()).toEqual([{ url: '/incoming-deliveries/66/draft', method: 'patch' }])
})

it.each(['DRAFT', 'SCHEDULED'] as const)('cancels an eligible %s arrival from details without cancelling the purchase order', async (status) => {
  draft.status = status
  const commands: unknown[] = []
  const base = apiClient.defaults.adapter as AxiosAdapter
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/incoming-deliveries/66/cancel') {
      commands.push(JSON.parse(config.data))
      draft = { ...draft, status: 'CANCELLED', revision: draft.revision + 1 }
      return { config, data: draft, status: 200, statusText: 'OK', headers: {} }
    }
    return base(config)
  }
  mount()
  const details = await openDeliveryRecord('ID-000066')
  const user = userEvent.setup()
  const more = await details.findByRole('button', { name: 'Cancel Delivery' })
  await waitFor(() => expect(more.hasAttribute('disabled')).toBe(false))
  await user.click(details.getByRole('button', { name: 'Cancel Delivery' }))
  const confirm = within(await screen.findByRole('dialog', { name: 'Cancel Delivery' })).getByRole('button', { name: 'Cancel Delivery' })
  expect(commands).toHaveLength(0)
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  await waitFor(() => expect(draft.status).toBe('CANCELLED'))
  expect(commands).toEqual([{ expectedRevision: 1 }])
  expect(order.status).toBe('CONFIRMED')
})

it('retains the confirmation and current order when delivery cancellation is rejected', async () => {
  const base = apiClient.defaults.adapter as AxiosAdapter
  let calls = 0
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/incoming-deliveries/66/cancel') {
      calls += 1
      throw { isAxiosError: true, response: { status: 409, data: { code: 'STALE_REVISION', message: 'Delivery changed. Refresh and review before continuing.' } } }
    }
    return base(config)
  }
  mount()
  const details = await openDeliveryRecord('ID-000066')
  const more = details.getByRole('button', { name: 'Cancel Delivery' })
  await waitFor(() => expect(more.hasAttribute('disabled')).toBe(false))
  await userEvent.click(details.getByRole('button', { name: 'Cancel Delivery' }))
  const confirm = within(await screen.findByRole('dialog', { name: 'Cancel Delivery' }))
  await userEvent.click(confirm.getByRole('button', { name: 'Cancel Delivery' }))
  expect(await confirm.findByRole('alert')).toBeTruthy()
  expect(calls).toBe(1)
  expect(draft.status).toBe('DRAFT')
  expect(order.status).toBe('CONFIRMED')
})
