import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { getAdapter } from 'axios'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Link, MemoryRouter, Route, Routes } from 'react-router'
import { apiClient } from '@/lib/api-client'
import { DeliveriesHub } from './DeliveriesHub'
import { DeliveryRunsHub } from './DeliveryRunsHub'
import { useCancelDeliveryRun, useReconcileRunMember } from '@/features/logistics/delivery-runs.hooks'
import type { DeliveryRunRecord, DeliveryRunStatus } from '@/features/logistics/delivery-runs.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'

const auth = vi.hoisted(() => ({ isAdmin: false, isManager: false, isStaff: true }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
const stamps = { createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-03T00:00:00Z' }
let trips: DeliveryRunRecord[]
let outgoing: OutgoingDeliveryRecord[]
let requests: { url: string; method: string; params: Record<string, unknown> }[]
let failure: string
let gate: Promise<void> | undefined
let ignoreStatuses: boolean
const writes = () => requests.filter((request) => request.method !== 'get')
function trip(id: number, status: DeliveryRunStatus): DeliveryRunRecord {
  return { id, runNumber: `TRIP-${id}`, revision: 4, status, warehouseId: 2, driverEmployeeId: status === 'CANCELLED' ? null : 3,
    deliveryVehicleId: status === 'CANCELLED' ? null : 4, scheduledDepartureAt: '2026-11-01T00:00:00Z',
    dispatchedAt: status === 'COMPLETED' || status === 'DISPATCHED' ? '2026-11-02T01:00:00Z' : null,
    completedAt: status === 'COMPLETED' ? '2026-11-03T00:00:00Z' : null, cancelledAt: status === 'CANCELLED' ? '2026-11-01T01:00:00Z' : null,
    departureConfirmedByUserId: null, loadedWeightKg: null, capacityKgAtDeparture: null, notes: null, ...stamps,
    deliveries: status === 'CANCELLED' ? [] : [8, 9].map((deliveryId) => ({ id: deliveryId, deliveryNumber: `OD-${deliveryId}`, revision: 5,
      status: status === 'COMPLETED' ? 'RECONCILED' : status === 'DRAFT' ? 'READY' : 'DISPATCHED', salesOrderId: deliveryId + 80, warehouseId: 2 })) }
}
function delivery(id: number): OutgoingDeliveryRecord {
  return { id, deliveryNumber: `OD-${id}`, revision: 5, status: 'RECONCILED', warehouseId: 2, salesOrderId: id + 80, runId: 31,
    reconciledAt: '2026-11-03T00:00:00Z', reconciledByUserId: null, fulfillmentOutcome: 'PARTIAL', hasDamage: true, hasMissing: true,
    notes: null, cancelledAt: null, plannedItems: [], ...stamps,
    items: [{ id: id * 100, outgoingDeliveryId: id, salesOrderItemId: id * 10, stockItemId: 55, quantity: '10.00', loadedQuantity: '10.00',
      deliveredQuantity: '6.00', returnedSellableQuantity: '1.00', returnedDamagedQuantity: '1.00', missingQuantity: '2.00',
      discrepancyReason: 'Damaged and missing bags', stockItem: { warehouseId: 2 }, ...stamps }] }
}
beforeEach(() => {
  auth.isAdmin = false; auth.isManager = false; auth.isStaff = true
  trips = [trip(31, 'COMPLETED'), trip(32, 'CANCELLED')]
  outgoing = [delivery(8), delivery(9)]
  requests = []; failure = ''; gate = undefined; ignoreStatuses = false
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    const params = config.params ?? {}
    requests.push({ url, method: config.method!, params: { ...params } })
    if (config.method !== 'get') throw Error('History must not write records')
    if (url === failure) throw { isAxiosError: true, response: { status: 503, data: { detail: 'History unavailable' } } }
    let data: unknown = { items: [], nextCursor: null }
    if (url === '/delivery-runs') {
      await gate
      const matches = trips.filter((entry) => (ignoreStatuses || !params.statuses || params.statuses.includes(entry.status)) && (!params.q || entry.runNumber.includes(params.q)))
      data = { items: params.cursor ? matches.slice(1) : matches.slice(0, 1), nextCursor: !params.cursor && matches.length > 1 ? 'trips-next' : null }
    } else if (/^\/delivery-runs\/\d+$/.test(url)) data = trips.find((entry) => entry.id === Number(url.split('/').at(-1)))
    else if (url === '/incoming-deliveries') data = { items: [{ id: 1, revision: 2, deliveryNumber: params.cursor ? 'IN-2' : 'IN-1', status: 'COMPLETED', warehouseId: 2, purchaseOrderId: 7, scheduledAt: null,
      completedAt: stamps.updatedAt, cancelledAt: null, supplierReference: null, notes: null, items: [], ...stamps }], nextCursor: params.cursor ? null : 'incoming-next' }
    else if (url === '/outgoing-deliveries') data = { items: [params.cursor ? outgoing[1] : outgoing[0]], nextCursor: params.cursor ? null : 'outgoing-next' }
    else if (/^\/outgoing-deliveries\/\d+$/.test(url)) data = outgoing.find((entry) => entry.id === Number(url.split('/').at(-1)))
    else if (/^\/sales-orders\/\d+$/.test(url)) {
      const id = Number(url.split('/').at(-1)); data = { id, clientId: id + 100, orderNumber: `SO-${id}`, deliveryAddress: 'Market Street', items: [{ id: (id - 80) * 10, inventoryItemId: 5 }] }
    } else if (/^\/clients\/\d+$/.test(url)) { const id = Number(url.split('/').at(-1)); data = { id, name: `Customer ${id}` } }
    else if (url === '/purchase-orders/7') data = { id: 7, orderNumber: 'PO-7', supplierId: 6, items: [] }
    else if (url === '/suppliers/6') data = { id: 6, name: 'Supplier' }
    else if (url === '/warehouses') data = { items: [{ id: 2, name: 'Main', isActive: true }], nextCursor: null }
    else if (url === '/warehouses/2') data = { id: 2, name: 'Main', isActive: true }
    else if (url === '/employees/3') data = { id: 3, firstName: 'Ana', lastName: 'Cruz' }
    else if (url === '/delivery-vehicles/4') data = { id: 4, plateNumber: 'ABC-123', vehicleType: 'Truck' }
    else if (url === '/inventory-items/5') data = { id: 5, name: 'Rice', unit: 'kg' }
    return { config, status: 200, statusText: '', headers: {}, data: structuredClone(data) }
  }
})
afterEach(() => { apiClient.defaults.adapter = original })
function mount({ direct = false, active = false, search = '' } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/deliveries/${active ? 'runs' : 'history'}${search}`]}><Link to="/deliveries/history?tab=trips">Open history</Link><Routes>
    <Route path="/deliveries/runs" element={<DeliveryRunsHub />} />
    <Route path="/deliveries/history" element={direct ? <DeliveryRunsHub history /> : <DeliveriesHub initialTab="history" />} />
  </Routes></MemoryRouter></QueryClientProvider>)
  return client
}
async function openTrips() {
  await userEvent.click(screen.getByRole('button', { name: 'Trips' }))
  await screen.findByRole('button', { name: 'TRIP-31' })
}
function noOperationalControls() {
  for (const name of ['Create Delivery Trip', 'Add to Trip', 'Send Trip', 'Record Results', 'Cancel Trip', 'Review Departure', 'Edit Trip'])
    expect(screen.queryByRole('button', { name })).toBeNull()
}

it('adds Trips while keeping individual deliveries separate in the other history tabs', async () => {
  mount()
  await screen.findByText('OD-8')
  for (const name of ['All Deliveries', 'Incoming', 'Outgoing', 'Trips']) expect(screen.getByRole('button', { name })).toBeTruthy()
  expect(screen.getAllByRole('table')).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'TRIP-31' })).toBeNull()
  await openTrips()
  expect(screen.getAllByRole('table')).toHaveLength(1)
  expect(screen.getAllByRole('navigation')).toHaveLength(1)
  expect(screen.getByRole('textbox', { name: 'Search delivery trips' }).closest('[data-delivery-table]')).toBeNull()
  expect(requests.find((entry) => entry.url === '/delivery-runs')?.params.statuses).toEqual(['COMPLETED', 'CANCELLED'])
  noOperationalControls()
  await userEvent.click(screen.getByRole('button', { name: 'All Deliveries' }))
  await screen.findByText('IN-1')
  expect(screen.getByText('OD-8')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'TRIP-31' })).toBeNull()
  expect(screen.getAllByRole('table')).toHaveLength(1)
  expect(writes()).toHaveLength(0)
})

it('pages and searches trips through their own backend cursor without mixing delivery cursors', async () => {
  mount()
  await openTrips()
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByRole('button', { name: 'TRIP-32' })
  expect(requests.filter((entry) => entry.url === '/delivery-runs').at(-1)?.params.cursor).toBe('trips-next')
  expect(screen.getByText('Page 2')).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'View Trip' }))
  const cancelled = within(await screen.findByRole('dialog', { name: 'TRIP-32' }))
  await userEvent.click(cancelled.getAllByRole('button', { name: 'Close' }).at(-1)!)
  expect(screen.getByText('Page 2')).toBeTruthy()
  fireEvent.change(screen.getByRole('textbox', { name: 'Search delivery trips' }), { target: { value: 'TRIP-31' } })
  await screen.findByRole('button', { name: 'TRIP-31' })
  const search = requests.filter((entry) => entry.url === '/delivery-runs' && entry.params.q === 'TRIP-31').at(-1)!
  expect(search.params.cursor).toBeUndefined()
  expect(search.params.statuses).toEqual(['COMPLETED', 'CANCELLED'])
  await userEvent.click(screen.getByRole('button', { name: 'Outgoing' }))
  await screen.findByText('OD-8')
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByText('OD-9')
  expect(requests.filter((entry) => entry.url === '/outgoing-deliveries').at(-1)?.params.cursor).toBe('outgoing-next')
  expect(requests.filter((entry) => entry.url === '/delivery-runs').every((entry) => !['incoming-next', 'outgoing-next'].includes(String(entry.params.cursor)))).toBe(true)
  expect(writes()).toHaveLength(0)
})

it('shows only actual departure and does not turn a cancelled trip schedule into a departure', async () => {
  mount()
  await openTrips()
  const completed = within(screen.getByRole('button', { name: 'TRIP-31' }).closest('tr')!)
  expect(completed.getByText('Completed')).toBeTruthy()
  await completed.findByText('Main')
  await completed.findByText('Ana Cruz / ABC-123')
  expect(completed.getByText('2 / 2 results recorded')).toBeTruthy()
  expect(completed.getAllByRole('cell')[3].textContent).toBe('Nov 2, 2026, 9:00 AM')
  expect(screen.getByRole('button', { name: 'TRIP-31' }).closest('tr')!.querySelector('time')?.getAttribute('datetime')).toBe(trips[0].dispatchedAt)
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  const cancelled = within((await screen.findByRole('button', { name: 'TRIP-32' })).closest('tr')!)
  expect(cancelled.getByText('Cancelled')).toBeTruthy()
  expect(cancelled.getAllByRole('cell')[3].textContent).toBe('Not recorded')
  expect(cancelled.queryByText(/Scheduled:/)).toBeNull()
  expect(screen.getByRole('button', { name: 'TRIP-32' }).closest('tr')!.querySelector('time')).toBeNull()
})

it('opens saved trip members and exact recorded delivery results then returns to the same list context', async () => {
  mount()
  await openTrips()
  fireEvent.change(screen.getByRole('textbox', { name: 'Search delivery trips' }), { target: { value: 'TRIP-31' } })
  await waitFor(() => expect(requests.some((entry) => entry.url === '/delivery-runs' && entry.params.q === 'TRIP-31')).toBe(true))
  await userEvent.click(screen.getByRole('button', { name: 'View Trip' }))
  const tripView = within(await screen.findByRole('dialog', { name: 'TRIP-31' }))
  await tripView.findByText('Customer 188')
  expect(tripView.getByText('OD-8')).toBeTruthy()
  expect(tripView.getByText('OD-9')).toBeTruthy()
  expect(tripView.getByText('Actual departure')).toBeTruthy()
  noOperationalControls()
  await userEvent.click(within(tripView.getByText('OD-8').closest('tr')!).getByRole('button', { name: 'View Results' }))
  const result = within(await screen.findByRole('dialog', { name: 'OD-8' }))
  await result.findByText('Rice')
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(result.getByRole('heading', { name: 'Delivery Results (1)' })).toBeTruthy()
  expect(result.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Item', 'Loaded Quantity', 'Delivered', 'Returned in Good Condition', 'Returned Damaged', 'Missing'])
  for (const quantity of ['10.00', '6.00', '2.00']) expect(result.getByRole('table').textContent).toContain(quantity)
  expect(result.getAllByText('1.00')).toHaveLength(2)
  expect(result.getByText('Rice: Damaged and missing bags')).toBeTruthy()
  noOperationalControls()
  await userEvent.click(result.getAllByRole('button', { name: 'Close' }).at(-1)!)
  await screen.findByRole('dialog', { name: 'TRIP-31' })
  await userEvent.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Close' }).at(-1)!)
  expect(screen.getByRole('textbox', { name: 'Search delivery trips' }).getAttribute('value')).toBe('TRIP-31')
  expect(screen.getByRole('button', { name: 'Trips' }).getAttribute('aria-pressed')).toBe('true')
  expect(writes()).toHaveLength(0)
})

it('shows recorded cancellation information without fabricated member results', async () => {
  mount({ direct: true, search: '?run=32&assign=8' })
  const view = within(await screen.findByRole('dialog', { name: 'TRIP-32' }))
  await view.findByText('No deliveries in this trip.')
  expect(view.getByText('Actual departure').parentElement?.textContent).toContain('Not recorded')
  expect(view.queryByRole('button', { name: 'View Results' })).toBeNull()
  noOperationalControls()
  expect(writes()).toHaveLength(0)
})

it.each(['DRAFT', 'DISPATCHED'] as const)('excludes %s records even when a response ignores the history status filter', async (status) => {
  trips = [trip(33, status)]
  ignoreStatuses = true
  mount({ direct: true })
  await screen.findByText('No historical trips shown on this page. Try another page or change the filters.')
  expect(screen.queryByRole('button', { name: 'TRIP-33' })).toBeNull()
  noOperationalControls()
  expect(writes()).toHaveLength(0)
})

it.each(['DRAFT', 'DISPATCHED'] as const)('does not expose %s operational controls through a history deep link', async (status) => {
  trips = [trip(33, status)]
  mount({ direct: true, search: '?run=33&assign=8' })
  await screen.findByText('This trip is not completed or cancelled.')
  noOperationalControls()
  expect(writes()).toHaveLength(0)
})

it.each(['admin', 'manager', 'staff'] as const)('allows read-only trip viewing for %s', async (role) => {
  auth.isAdmin = role === 'admin'; auth.isManager = role === 'manager'; auth.isStaff = role === 'staff'
  mount({ direct: true, search: '?run=31' })
  await screen.findByRole('dialog', { name: 'TRIP-31' })
  noOperationalControls()
  expect(writes()).toHaveLength(0)
})

it('does not fetch or expose trip records for unauthorized users', async () => {
  auth.isStaff = false
  mount({ direct: true, search: '?run=31' })
  await screen.findByText('You do not have permission to view Delivery Trips.')
  expect(requests.filter((entry) => entry.url.startsWith('/delivery-runs'))).toHaveLength(0)
  expect(screen.queryByRole('dialog')).toBeNull()
})

it('keeps an empty trip history honest and shows a retryable error on lookup failure', async () => {
  trips = []
  mount({ direct: true })
  await screen.findByText('No past trips found')
  expect(screen.getByText('Completed and cancelled trips will appear here.')).toBeTruthy()
  failure = '/delivery-runs'
  fireEvent.change(screen.getByRole('textbox', { name: 'Search delivery trips' }), { target: { value: 'missing' } })
  await screen.findByText(/The service is temporarily offline/)
  expect(screen.getByText('Delivery trips are unavailable. Refresh to try again.')).toBeTruthy()
  failure = ''
  await userEvent.click(screen.getByRole('button', { name: 'Refresh trips' }))
  await screen.findByText('No historical trips shown on this page. Try another page or change the filters.')
  expect(writes()).toHaveLength(0)
})

it('shows loading without claiming a confirmed empty history', async () => {
  let release!: () => void
  gate = new Promise<void>((resolve) => { release = resolve })
  mount({ direct: true })
  expect(screen.queryByText('No historical trips shown on this page. Try another page or change the filters.')).toBeNull()
  expect(screen.queryByText('No past trips found')).toBeNull()
  await act(async () => release())
  await screen.findByRole('button', { name: 'TRIP-31' })
  expect(writes()).toHaveLength(0)
})

it('paginates and searches only active trips even when finished trips precede them in storage', async () => {
  trips.push(trip(33, 'DRAFT'), trip(34, 'DISPATCHED'))
  mount({ active: true })
  await screen.findByRole('button', { name: 'TRIP-33' })
  expect(requests.find((entry) => entry.url === '/delivery-runs')?.params.statuses).toEqual(['DRAFT', 'DISPATCHED'])
  expect(screen.queryByRole('button', { name: 'TRIP-31' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'TRIP-32' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Review Trip' })).toBeTruthy()
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByRole('button', { name: 'TRIP-34' })
  expect(screen.getByText('Dispatched')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Record Results' })).toBeTruthy()
  expect(requests.filter((entry) => entry.url === '/delivery-runs').at(-1)?.params.cursor).toBe('trips-next')
  fireEvent.change(screen.getByRole('textbox', { name: 'Search delivery trips' }), { target: { value: 'TRIP-33' } })
  await screen.findByRole('button', { name: 'TRIP-33' })
  expect(requests.filter((entry) => entry.url === '/delivery-runs').at(-1)?.params).toMatchObject({ q: 'TRIP-33', statuses: ['DRAFT', 'DISPATCHED'] })
  expect(requests.filter((entry) => entry.url === '/delivery-runs').at(-1)?.params.cursor).toBeUndefined()
  expect(screen.getByText('Page 1')).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('limits active status choices and resets the cursor when a status is chosen', async () => {
  trips = [trip(33, 'DRAFT'), trip(34, 'DISPATCHED')]
  mount({ active: true })
  await screen.findByRole('button', { name: 'TRIP-33' })
  await userEvent.click(screen.getByRole('button', { name: 'Next page' }))
  await screen.findByRole('button', { name: 'TRIP-34' })
  await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
  await userEvent.click(screen.getByRole('combobox', { name: 'Trip status' }))
  expect(screen.queryByRole('option', { name: 'Completed' })).toBeNull()
  expect(screen.queryByRole('option', { name: 'Cancelled' })).toBeNull()
  await userEvent.click(screen.getByRole('option', { name: 'Preparing' }))
  await screen.findByRole('button', { name: 'TRIP-33' })
  expect(requests.filter((entry) => entry.url === '/delivery-runs').at(-1)?.params.statuses).toEqual(['DRAFT'])
  expect(requests.filter((entry) => entry.url === '/delivery-runs').at(-1)?.params.cursor).toBeUndefined()
  expect(screen.getByText('Page 1')).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('keeps history access separate from the active trips toolbar and preserves empty states', async () => {
  trips = []
  mount({ active: true })
  await screen.findByText('No active delivery trips')
  expect(screen.getByText('Create a delivery trip or add a ready delivery to a new trip.')).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Create Delivery Trip' })).toBeNull()
  expect(screen.queryByRole('link', { name: 'Delivery History' })).toBeNull()
  await userEvent.click(screen.getByRole('link', { name: 'Open history' }))
  await screen.findByText('No past trips found')
  expect(screen.getByRole('button', { name: 'Trips' }).getAttribute('aria-pressed')).toBe('true')
  expect(requests.filter((entry) => entry.url === '/delivery-runs').at(-1)?.params.statuses).toEqual(['COMPLETED', 'CANCELLED'])
  await userEvent.click(screen.getByRole('link', { name: 'Active Delivery Trips' }))
  await screen.findByText('No active delivery trips')
  expect(writes()).toHaveLength(0)
})

it('uses helpful text instead of zero-over-zero progress for a trip without deliveries', async () => {
  trips = [{ ...trip(33, 'DRAFT'), deliveries: [] }]
  mount({ active: true })
  const row = within((await screen.findByRole('button', { name: 'TRIP-33' })).closest('tr')!)
  expect(row.getByText('No deliveries added')).toBeTruthy()
  expect(row.queryByText('0 / 0 results recorded')).toBeNull()
})

it.each(['COMPLETED', 'CANCELLED'] as const)('moves a trip to history only after backend-confirmed %s and preserves read-only details', async (status) => {
  trips = [trip(33, status === 'COMPLETED' ? 'DISPATCHED' : 'DRAFT')]
  const client = mount({ active: true })
  await screen.findByRole('button', { name: 'TRIP-33' })
  // Prime the independent history cache before changing the trip.
  await userEvent.click(screen.getByRole('link', { name: 'Open history' }))
  await screen.findByText('No past trips found')
  await userEvent.click(screen.getByRole('link', { name: 'Active Delivery Trips' }))
  await screen.findByRole('button', { name: 'TRIP-33' })
  let release!: () => void
  const confirmation = new Promise<void>((resolve) => { release = resolve })
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'get') return base(config)
    requests.push({ url: config.url!, method: config.method!, params: JSON.parse(config.data) })
    await confirmation
    trips[0] = { ...trips[0], revision: 5, status,
      completedAt: status === 'COMPLETED' ? stamps.updatedAt : null,
      cancelledAt: status === 'CANCELLED' ? stamps.updatedAt : null,
      deliveries: trips[0].deliveries.map((member) => ({ ...member, status: status === 'COMPLETED' ? 'RECONCILED' : member.status })) }
    const data = status === 'COMPLETED' ? { run: trips[0], delivery: outgoing[0] } : trips[0]
    return { config, status: 200, statusText: '', headers: {}, data: structuredClone(data) }
  }
  const mutation = renderHook(() => ({ cancel: useCancelDeliveryRun(), complete: useReconcileRunMember() }), {
    wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  })
  let saved!: Promise<unknown>
  await act(async () => {
    saved = status === 'CANCELLED'
      ? mutation.result.current.cancel.mutateAsync({ id: 33, expectedRevision: 4 })
      : mutation.result.current.complete.mutateAsync({ id: 33, deliveryId: 8, payload: { expectedRevision: 5, items: [
          { outgoingDeliveryItemId: 800, deliveredQuantity: '6.00', returnedSellableQuantity: '1.00', returnedDamagedQuantity: '1.00', missingQuantity: '2.00', discrepancyReason: 'Damaged and missing bags' },
        ] } })
  })
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(screen.getByRole('button', { name: 'TRIP-33' })).toBeTruthy()
  await act(async () => { release(); await saved })
  await screen.findByText('No active delivery trips')
  expect(screen.queryByRole('button', { name: 'TRIP-33' })).toBeNull()
  await userEvent.click(screen.getByRole('link', { name: 'Open history' }))
  await screen.findByRole('button', { name: 'TRIP-33' })
  await userEvent.click(screen.getByRole('button', { name: 'View Trip' }))
  const view = within(await screen.findByRole('dialog', { name: 'TRIP-33' }))
  expect(view.getByText('OD-8')).toBeTruthy()
  expect(view.getByText('OD-9')).toBeTruthy()
  noOperationalControls()
  if (status === 'COMPLETED') {
    await userEvent.click(within(view.getByText('OD-8').closest('tr')!).getByRole('button', { name: 'View Results' }))
    const results = within(await screen.findByRole('dialog', { name: 'OD-8' }))
    expect(results.getByRole('table').textContent).toContain('6.00')
    noOperationalControls()
  }
  expect(writes()).toHaveLength(1)
})

it('keeps absent saved result quantities distinct from recorded zero', async () => {
  Object.assign(outgoing[0].items[0], { deliveredQuantity: null, returnedSellableQuantity: null, returnedDamagedQuantity: '0.00', missingQuantity: null })
  mount({ direct: true, search: '?run=31' })
  const tripView = within(await screen.findByRole('dialog', { name: 'TRIP-31' }))
  await userEvent.click(within(tripView.getByText('OD-8').closest('tr')!).getByRole('button', { name: 'View Results' }))
  const result = within(await screen.findByRole('dialog', { name: 'OD-8' }))
  const table = within(result.getByRole('table'))
  expect(table.getAllByText('Not recorded')).toHaveLength(3)
  expect(table.getByText('0.00')).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('retries an unavailable member delivery and returns to its trip without losing context', async () => {
  failure = '/outgoing-deliveries/8'
  mount({ direct: true, search: '?run=31' })
  const tripView = within(await screen.findByRole('dialog', { name: 'TRIP-31' }))
  await userEvent.click(within(tripView.getByText('OD-8').closest('tr')!).getByRole('button', { name: 'View Results' }))
  await screen.findByText('Failed to load delivery record.')
  noOperationalControls()
  failure = ''
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  const result = within(await screen.findByRole('dialog', { name: 'OD-8' }))
  await result.findByText('Rice')
  await userEvent.click(result.getAllByRole('button', { name: 'Close' }).at(-1)!)
  await screen.findByRole('dialog', { name: 'TRIP-31' })
  expect(writes()).toHaveLength(0)
})
