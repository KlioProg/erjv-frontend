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
let orderGate: Promise<void> | undefined
beforeEach(() => {
  auth.isAdmin = true
  requests = []
  orderFails = false
  rejection = false
  activeWarehouse = true
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
    if (url === '/warehouses')
      data = { items: [{ id: 1, name: 'Main', isActive: true }], nextCursor: null }
    if (url === '/warehouses/1') data = { id: 1, name: 'Main', isActive: activeWarehouse }
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
  fireEvent.click(await screen.findByRole('button', { name: 'Schedule Arrival ID-000066' }))
  return within(await screen.findByRole('dialog', { name: 'Schedule Arrival' }))
}

it('keeps a received-order draft compact and discloses its explanation only in details', async () => {
  order.status = 'RECEIVED'
  mount()
  expect(await screen.findByText('PO already received')).toBeTruthy()
  const row = within(screen.getByRole('row', { name: /ID-000066/ }))
  expect(row.getByText('Inactive draft')).toBeTruthy()
  expect(row.queryByText(/All goods for this purchase order/)).toBeNull()
  expect(row.queryByText(/This draft remains saved/)).toBeNull()
  expect(row.getAllByRole('cell')).toHaveLength(7)
  expect(screen.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
    'Delivery #',
    'Purchase Order',
    'Supplier',
    'Schedule',
    'Status',
    'Issue',
    'Actions',
  ])
  expect(screen.queryByRole('button', { name: 'Schedule Arrival ID-000066' })).toBeNull()
  const user = userEvent.setup()
  await user.click(row.getByRole('button', { name: 'More actions for ID-000066' }))
  expect(screen.queryByRole('menuitem', { name: 'View delivery details' })).toBeNull()
  expect(screen.getByRole('menuitem', { name: /View Purchase Order/ })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: 'Cancel Delivery ID-000066' })).toBeTruthy()
  await user.keyboard('{Escape}')
  await user.click(row.getByRole('button', { name: 'View Details ID-000066' }))
  const details = within(await screen.findByRole('dialog', { name: 'ID-000066' }))
  expect(details.getByText('Purchase Order Already Received')).toBeTruthy()
  expect(details.getByText(/This draft remains saved for record purposes/)).toBeTruthy()
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
    const confirmation = within(screen.getByRole('alert'))
    expect(confirmation.getByText(/Arrival scheduled for ID-000066/)).toBeTruthy()
    expect(confirmation.getByRole('button', { name: 'View Details' })).toBeTruthy()
    expect(confirmation.queryByRole('button', { name: 'Receive Goods' })).toBeNull()
  },
)

it('reopens a scheduled arrival before its planned date and refreshes a receipt saved by another employee', async () => {
  draft.status = 'SCHEDULED'
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'View delivery ID-000066' }))
  const details = within(await screen.findByRole('dialog', { name: 'ID-000066' }))
  const receive = await details.findByRole('button', { name: /^Receive Goods/ })
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

it.each(['unavailable', 'missing'])('blocks receiving from stale details when the current incoming record is %s', async (failure) => {
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
})

it('rechecks a warm cached order on opening and stops a newly received order', async () => {
  mount()
  await screen.findByRole('button', { name: 'Schedule Arrival ID-000066' })
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
  await screen.findByRole('button', { name: 'Schedule Arrival ID-000066' })
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
  await screen.findByRole('button', { name: 'Schedule Arrival ID-000066' })
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
  await screen.findByRole('button', { name: 'Schedule Arrival ID-000066' })
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

it('keeps active row actions clear and moves review actions into the menu', async () => {
  mount()
  await screen.findByRole('button', { name: 'Schedule Arrival ID-000066' })
  const user = userEvent.setup()
  expect(screen.queryByRole('button', { name: 'View Details ID-000066' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'More actions for ID-000066' }))
  await user.click(screen.getByRole('menuitem', { name: 'View delivery details' }))
  const details = within(await screen.findByRole('dialog', { name: 'ID-000066' }))
  expect(details.queryByRole('alert')).toBeNull()
  expect(writes()).toHaveLength(0)
})

it('keeps read-only users able to review deliveries without management actions', async () => {
  auth.isAdmin = false
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'More actions for ID-000066' }))
  expect(screen.getByRole('menuitem', { name: 'View delivery details' })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: /View Purchase Order/ })).toBeTruthy()
  expect(screen.queryByRole('menuitem', { name: /Cancel Delivery/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /Schedule Arrival/ })).toBeNull()
  expect(writes()).toHaveLength(0)
})
