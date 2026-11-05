import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AxiosAdapter } from 'axios'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useNavigate, useLocation } from 'react-router'
import { apiClient } from '@/lib/api-client'
import { DeliveryRunsHub } from './DeliveryRunsHub'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
let run: DeliveryRunRecord
let deliveries: OutgoingDeliveryRecord[]
let requests: { url: string; method: string; body: Record<string, unknown>; params: Record<string, unknown> }[]
beforeEach(() => {
  auth.isAdmin = true; auth.isManager = false; auth.isStaff = false
  requests = []
  deliveries = [8, 9, 10].map((id) => ({ id, deliveryNumber: `OUT-${id}`, revision: 3, status: 'READY', warehouseId: id === 10 ? 3 : 2, runId: null, salesOrderId: id + 3, plannedItems: [], items: [], notes: null, reconciledAt: null, reconciledByUserId: null, fulfillmentOutcome: null, hasDamage: false, hasMissing: false, cancelledAt: null, createdAt: '', updatedAt: '' }))
  run = { id: 1, runNumber: 'RUN-1', revision: 4, status: 'DRAFT', warehouseId: 2, driverEmployeeId: null, deliveryVehicleId: null,
    scheduledDepartureAt: '2026-10-29T02:00:00Z', dispatchedAt: null, completedAt: null, cancelledAt: null, departureConfirmedByUserId: null,
    loadedWeightKg: null, capacityKgAtDeparture: null, notes: 'Original notes', createdAt: '', updatedAt: '',
    deliveries: [{ id: 7, revision: 9, deliveryNumber: 'OUT-7', status: 'READY', salesOrderId: 10, warehouseId: 2 }] }
  apiClient.defaults.adapter = async (config) => {
    const body = config.data ? JSON.parse(config.data) : {}
    requests.push({ url: config.url!, method: config.method!, body, params: config.params ?? {} })
    let data: unknown = { items: [], nextCursor: null }
    if (config.method === 'get') {
      if (config.url === '/delivery-runs') data = { items: [run], nextCursor: null }
      if (config.url === '/delivery-runs/1') data = structuredClone(run)
      if (config.url === '/warehouses') data = { items: [{ id: 2, name: 'Main', isActive: true }, { id: 3, name: 'Other', isActive: true }], nextCursor: null }
      if (config.url === '/warehouses/2') data = { id: 2, name: 'Main', isActive: true }
      if (config.url === '/employees') data = { items: [{ id: 3, firstName: 'Ana', lastName: 'Cruz', canDrive: true, isActive: true }], nextCursor: null }
      if (config.url === '/employees/3') data = { id: 3, firstName: 'Ana', lastName: 'Cruz', canDrive: true, isActive: true }
      if (config.url === '/delivery-vehicles') data = { items: [{ id: 4, plateNumber: 'ABC-123' }], nextCursor: null }
      if (config.url === '/delivery-vehicles/4') data = { id: 4, plateNumber: 'ABC-123' }
      if (config.url === '/delivery-vehicles/available') data = { items: [{ id: 4, plateNumber: 'ABC-123', capacityKg: '1000.00', isAvailable: true, operationalStatus: 'SERVICEABLE' }], nextCursor: null }
      if (config.url === '/outgoing-deliveries') {
        const matches = deliveries.filter((delivery) => delivery.warehouseId === config.params.warehouseId && delivery.runId === null && delivery.status === 'READY' && (!config.params.q || delivery.deliveryNumber.includes(config.params.q)))
        data = { items: config.params.cursor ? matches.slice(1) : matches.slice(0, 1), nextCursor: !config.params.cursor && matches.length > 1 ? 'ready-next' : null }
      }
      if (/^\/outgoing-deliveries\/\d+$/.test(config.url!)) data = structuredClone(deliveries.find((delivery) => delivery.id === Number(config.url!.split('/').at(-1))) ?? null)
    } else {
      if (body.expectedRevision !== undefined && body.expectedRevision !== run.revision)
        throw { isAxiosError: true, response: { status: 409, data: { detail: 'Run changed', code: 'STALE_REVISION', currentRevision: run.revision } } }
      run = { ...run, revision: run.revision + 1, ...(config.url?.endsWith('/draft') ? body : {}) }
      if ((config.method === 'post' && config.url === '/delivery-runs') || config.url?.endsWith('/deliveries')) {
        const members = (body.deliveries ?? body.add ?? []) as { deliveryId: number; expectedRevision: number }[]
        const added = members.map((entry) => {
          const delivery = deliveries.find((record) => record.id === entry.deliveryId)!
          delivery.runId = run.id
          return { id: delivery.id, revision: delivery.revision, deliveryNumber: delivery.deliveryNumber, status: delivery.status, warehouseId: delivery.warehouseId, salesOrderId: delivery.salesOrderId }
        })
        run = { ...run, ...(config.method === 'post' ? { warehouseId: body.warehouseId } : {}), deliveries: config.method === 'post' ? added : [...run.deliveries, ...added] }
      }
      data = structuredClone(run)
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data: structuredClone(data) }
  }
})
afterEach(() => { apiClient.defaults.adapter = original })
function mount(selected: boolean | string = true) {
  function Location() { const location = useLocation(); return <output data-testid="run-location">{location.search}</output> }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/deliveries/runs${typeof selected === 'string' ? selected : selected ? '?run=1' : ''}`]}><DeliveryRunsHub /><Location /></MemoryRouter></QueryClientProvider>)
  return client
}
const writes = () => requests.filter((request) => request.method !== 'get')

it('keeps trip rows and unsaved notes mounted during refresh, then removes confirmed terminal trips', async () => {
  const client = mount(false)
  await screen.findByText('RUN-1')
  await userEvent.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await userEvent.type(screen.getByLabelText(/Notes/), 'Keep my input')
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/delivery-runs') await gate
    return adapter(config)
  }
  let refreshed!: Promise<void>
  act(() => { refreshed = client.invalidateQueries({ queryKey: ['delivery-runs'] }) })
  await screen.findByText('Updating trips...')
  expect(screen.getByText('RUN-1')).toBeTruthy()
  expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe('Keep my input')
  run.status = 'COMPLETED'
  await act(async () => { release(); await refreshed })
  await waitFor(() => expect(screen.queryByText('RUN-1')).toBeNull())
  expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe('Keep my input')
})

it.each([503, 403])('handles trip refresh failure %s without treating protected or stale data as fresh', async (status) => {
  const client = mount(false)
  await screen.findByText('RUN-1')
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/delivery-runs') throw { isAxiosError: true, response: { status, data: { message: 'Refresh failed' } } }
    return adapter(config)
  }
  await act(async () => { await client.invalidateQueries({ queryKey: ['delivery-runs'] }) })
  expect(await screen.findByRole('alert')).toBeTruthy()
  if (status === 503) {
    expect(screen.getByText('RUN-1')).toBeTruthy()
    expect(screen.getByText(/Latest trip update could not be retrieved/)).toBeTruthy()
  } else expect(screen.queryByText('RUN-1')).toBeNull()
})

it('uses a warning badge for an in-transit run in both the list and detail view', async () => {
  run.status = 'DISPATCHED'
  const client = mount()
  await screen.findByRole('dialog', { name: 'Delivery Trip RUN-1' })
  const statuses = screen.getAllByText('Dispatched')
  expect(statuses.length).toBeGreaterThanOrEqual(2)
  for (const status of statuses)
    expect(status.closest('[data-slot="badge"]')?.classList.contains('bg-status-warning')).toBe(true)
  client.clear()
})

it('reviews an incoming assignment context and confirms membership without automatic writes', async () => {
  mount('?assign=8&keep=yes')
  const user = userEvent.setup()
  const assignment = within(await screen.findByRole('dialog', { name: 'Add Delivery to Trip' }))
  await assignment.findByText('OUT-8 · Sales Order #11')
  expect(within(assignment.getByRole('region', { name: 'Delivery information' })).getByText('Main')).toBeTruthy()
  expect(assignment.getByText('Choose an existing trip or create a new one.')).toBeTruthy()
  expect(writes()).toHaveLength(0)
  expect(assignment.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(true)
  expect(assignment.queryByRole('button', { name: 'Use Existing Trip' })).toBeNull()
  expect(assignment.queryByRole('button', { name: /Refresh/ })).toBeNull()
  await user.click(await within(screen.getByRole('dialog', { name: 'Add Delivery to Trip' })).findByRole('button', { name: 'RUN-1' }))
  await waitFor(() => expect(assignment.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(false))
  const confirm = assignment.getByRole('button', { name: 'Add to Trip' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ url: '/delivery-runs/1/deliveries', body: { expectedRevision: 4, add: [{ deliveryId: 8, expectedRevision: 3 }] } })
  await screen.findByRole('dialog', { name: 'Delivery Trip RUN-1' })
  const params = new URLSearchParams(screen.getByTestId('run-location').textContent!)
  expect(params.get('keep')).toBe('yes')
  expect(params.get('run')).toBe('1')
  expect(params.has('assign')).toBe(false)
  expect(run.deliveries.map((member) => member.id)).toContain(8)
  expect(writes().some((request) => request.url.endsWith('/dispatch'))).toBe(false)
})

it('preserves a handoff delivery when creating a new run and waits for explicit save', async () => {
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Create New Trip' }))
  const editor = within(await screen.findByRole('dialog', { name: 'Create Delivery Trip' }))
  await editor.findByText('OUT-8')
  expect(writes()).toHaveLength(0)
  expect(editor.getByRole('region', { name: 'Deliveries in This Trip' })).toBeTruthy()
  expect(within(editor.getByRole('list', { name: 'Selected deliveries' })).getByText('Sales Order #11')).toBeTruthy()
  expect(editor.getByText(/1 selected/)).toBeTruthy()
  expect(editor.getByText('Fixed by the selected outgoing delivery.')).toBeTruthy()
  expect(editor.getByLabelText('Warehouse').textContent).toBe('Main')
  expect(editor.queryByRole('button', { name: 'Choose warehouse' })).toBeNull()
  await waitFor(() => expect(editor.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(false))
  await user.click(editor.getByRole('button', { name: 'Create Trip' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ method: 'post', url: '/delivery-runs', body: { warehouseId: 2, deliveries: [{ deliveryId: 8, expectedRevision: 3 }] } })
})

it('returns from cancelled creation to assignment without writing', async () => {
  mount('?assign=8&keep=yes')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Create New Trip' }))
  expect(screen.queryByRole('dialog', { name: 'Add Delivery to Trip' })).toBeNull()
  const editor = within(await screen.findByRole('dialog', { name: 'Create Delivery Trip' }))
  await editor.findByText('OUT-8')
  expect(editor.getByLabelText('Warehouse').textContent).toBe('Main')
  expect(editor.getByText('Fixed by the selected outgoing delivery.')).toBeTruthy()
  await user.click(within(editor.getByRole('button', { name: 'Create Trip' }).closest('form')!).getByRole('button', { name: 'Cancel' }))
  const assignment = within(await screen.findByRole('dialog', { name: 'Add Delivery to Trip' }))
  await assignment.findByText('OUT-8 \u00b7 Sales Order #11')
  await assignment.findByRole('button', { name: 'RUN-1' })
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(writes()).toHaveLength(0)
})

it('applies supported run column filters on the server without making writes', async () => {
  mount(false)
  const user = userEvent.setup()
  await screen.findByRole('button', { name: 'RUN-1' })
  expect(screen.getByRole('textbox', { name: 'Search delivery trips' }).closest('[data-delivery-table]')).toBeNull()
  expect(screen.getByRole('button', { name: 'Create Delivery Trip' }).closest('[data-delivery-table]')).toBeNull()
  const open = (name: string) => user.click(screen.getByRole('button', { name: 'Filter by ' + name }))
  const done = (name: string) => user.click(within(screen.getByRole('dialog', { name: 'Filter by ' + name })).getByRole('button', { name: 'Done' }))
  await open('warehouse')
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await done('warehouse')
  await open('driver / vehicle')
  await user.click(screen.getByRole('button', { name: 'Choose driver' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Ana Cruz' }))
  await user.click(screen.getByRole('button', { name: 'Choose vehicle' }))
  await user.click(await screen.findByRole('menuitem', { name: 'ABC-123' }))
  await done('driver / vehicle')
  await open('scheduled departure')
  fireEvent.change(screen.getByLabelText('Departure from'), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('Departure through'), { target: { value: '2026-11-03' } })
  await done('scheduled departure')
  await waitFor(() => expect(requests.filter(request => request.url === '/delivery-runs' && request.method === 'get').at(-1)?.params).toMatchObject({ warehouseId: 2, driverEmployeeId: 3, deliveryVehicleId: 4, scheduledFrom: '2026-10-31T16:00:00.000Z', scheduledBefore: '2026-11-03T16:00:00.000Z' }))
  await open('driver / vehicle')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Choose driver' }).textContent).toContain('Ana Cruz'))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Choose vehicle' }).textContent).toContain('ABC-123'))
  await done('driver / vehicle')
  await user.click(screen.getByRole('button', { name: 'Clear filters' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull())
  expect(writes()).toHaveLength(0)
})

it('rejects an invalid assignment deep link without mounting a stalled editor', async () => {
  mount('?assign=-8')
  await screen.findByText(/does not contain a valid record ID/)
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(requests.some((request) => request.url === '/outgoing-deliveries/-8')).toBe(false)
  expect(writes()).toHaveLength(0)
})

it('offers review rather than a nonexistent reconciliation when no run members are outstanding', async () => {
  run = { ...run, status: 'DISPATCHED', deliveries: run.deliveries.map((member) => ({ ...member, status: 'RECONCILED' })) }
  mount(false)
  await screen.findByRole('button', { name: 'View Details' })
  expect(screen.queryByRole('button', { name: 'Record Results' })).toBeNull()
  expect(writes()).toHaveLength(0)
})

it('blocks a changed assignment revision until the user refreshes and reviews', async () => {
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await within(screen.getByRole('dialog', { name: 'Add Delivery to Trip' })).findByRole('button', { name: 'RUN-1' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(false))
  run = { ...run, revision: 5 }
  await user.click(screen.getByRole('button', { name: 'Add to Trip' }))
  await screen.findByText(/The delivery or trip changed/)
  expect(writes()).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Refresh to review' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Add to Trip' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0].body.expectedRevision).toBe(5)
})

it('does not allow staff assignment writes', async () => {
  auth.isAdmin = false; auth.isStaff = true
  mount('?assign=8')
  await screen.findByText(/Only administrators and managers can assign/)
  expect(screen.queryByRole('button', { name: 'Add to Trip' })).toBeNull()
  expect(requests.some((request) => request.url === '/outgoing-deliveries/8')).toBe(false)
  expect(writes()).toHaveLength(0)
})

it('excludes preparing runs from another warehouse from the assignment picker', async () => {
  run = { ...run, warehouseId: 3 }
  mount('?assign=8')
  await screen.findByText('No eligible trips shown. Create a new trip or load more results.')
  const assignment = within(screen.getByRole('dialog', { name: 'Add Delivery to Trip' }))
  expect(assignment.queryByRole('button', { name: 'RUN-1' })).toBeNull()
  expect(assignment.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(true)
  expect(writes()).toHaveLength(0)
})

it('keeps an already assigned delivery read-only and opens its run', async () => {
  deliveries[0] = { ...deliveries[0], runId: 1 }
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'View Trip' }))
  await screen.findByRole('dialog', { name: 'Delivery Trip RUN-1' })
  expect(writes()).toHaveLength(0)
})

it('preserves assignment review after an ambiguous response and prevents blind resubmission', async () => {
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  apiClient.defaults.adapter = async (config) => {
    const response = await adapter(config)
    return config.method === 'patch' && config.url === '/delivery-runs/1/deliveries' ? { ...response, data: { ...response.data, deliveries: [] } } : response
  }
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await within(screen.getByRole('dialog', { name: 'Add Delivery to Trip' })).findByRole('button', { name: 'RUN-1' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Add to Trip' }))
  await screen.findByText(/The delivery was not added/)
  expect(writes()).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Add to Trip' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Review Trip' }))
  await screen.findByRole('dialog', { name: 'Delivery Trip RUN-1' })
  expect(writes()).toHaveLength(1)
})

it('edits the reviewed draft revision without closing on a stale write', async () => {
  const client = mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit Trip' }))
  const editor = await screen.findByRole('dialog', { name: 'Edit RUN-1' })
  fireEvent.change(within(editor).getByLabelText(/Notes/), { target: { value: 'Unsaved loading instructions' } })
  run = { ...run, revision: 5, notes: 'Changed by another user' }
  await act(() => client.invalidateQueries({ queryKey: ['delivery-runs'] }))
  await user.click(within(editor).getByRole('button', { name: 'Save Trip' }))
  await waitFor(() => expect(within(editor).getByRole('alert').textContent).toContain('Run changed'))
  expect(writes()[0].body.expectedRevision).toBe(4)
  expect((within(editor).getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe('Unsaved loading instructions')
  expect(within(editor).getByRole('button', { name: 'Save Trip' }).hasAttribute('disabled')).toBe(true)
})

it('adds an eligible READY member using distinct run and delivery revisions', async () => {
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: 'OUT-8 · Sales Order #11' }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Add to Trip' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ url: '/delivery-runs/1/deliveries', body: { expectedRevision: 4, add: [{ deliveryId: 8, expectedRevision: 3 }] } })
  expect(requests.find((request) => request.url === '/outgoing-deliveries')?.params).toMatchObject({ statuses: ['READY'], warehouseId: 2, unassigned: 'true' })
})

it('reopens an assigned member with the reviewed paired revisions', async () => {
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Manage OUT-7' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Reopen draft' }))
  await user.click(screen.getByRole('button', { name: 'Reopen Draft' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ url: '/delivery-runs/1/deliveries/7/reopen', body: { expectedRunRevision: 4, expectedDeliveryRevision: 9 } })
})

it('does not expose draft mutation or dispatch actions on a completed run', async () => {
  run.status = 'COMPLETED'
  run.deliveries[0].status = 'RECONCILED'
  mount()
  await screen.findByRole('dialog', { name: 'Delivery Trip RUN-1' })
  expect(screen.queryByRole('button', { name: 'Edit Trip' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Review Departure' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Cancel Trip' })).toBeNull()
  expect(writes()).toEqual([])
})

it('creates an empty draft run without inventing deliveries or assignments', async () => {
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Create Trip' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ url: '/delivery-runs', body: { warehouseId: 2, driverEmployeeId: null, deliveryVehicleId: null } })
  expect(writes()[0].body).not.toHaveProperty('expectedRevision')
  expect(writes()[0].body).not.toHaveProperty('deliveries')
})

it('creates a trip with an exact scheduled minute without dispatching it', async () => {
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  fireEvent.change(screen.getByLabelText('Scheduled Departure Date'), {
    target: { value: '2026-12-01' },
  })
  await user.type(screen.getByLabelText('Scheduled Departure Time'), '10:17')
  expect(screen.queryByRole('combobox', { name: /AM or PM/ })).toBeNull()
  const createTrip = screen.getByRole('button', { name: 'Create Trip' })
  await waitFor(() => expect(createTrip.hasAttribute('disabled')).toBe(false))
  await user.click(createTrip)
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({
    method: 'post',
    url: '/delivery-runs',
    body: { scheduledDepartureAt: '2026-12-01T02:17:00.000Z' },
  })
  expect(writes().some((request) => request.url.endsWith('/dispatch'))).toBe(false)
})

it('shows inline clear actions only for selected assignments and saves cleared values', async () => {
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  const editor = within(screen.getByRole('dialog', { name: 'Create Delivery Trip' }))
  expect(editor.queryByRole('button', { name: 'Clear driver' })).toBeNull()
  expect(editor.queryByRole('button', { name: 'Clear vehicle' })).toBeNull()
  await user.click(editor.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(editor.getByRole('button', { name: 'Choose driver' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Ana Cruz' }))
  await user.click(editor.getByRole('button', { name: 'Choose vehicle' }))
  await user.click(await screen.findByRole('menuitem', { name: /ABC-123/ }))
  for (const field of ['driver', 'vehicle']) {
    const clear = editor.getByRole('button', { name: `Clear ${field}` })
    expect(clear.parentElement?.querySelector('label')?.htmlFor).toBe(`run-${field}`)
    await user.click(clear)
    expect(editor.queryByRole('button', { name: `Clear ${field}` })).toBeNull()
    expect(editor.getByRole('button', { name: `Choose ${field}` })).toBeTruthy()
  }
  const notes = editor.getByLabelText(/Notes/) as HTMLTextAreaElement
  expect(notes.tagName).toBe('TEXTAREA')
  expect(notes.rows).toBe(2)
  await user.type(notes, 'Loading instructions{Enter}Bring receipt')
  await user.click(editor.getByRole('button', { name: 'Create Trip' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0].body).toMatchObject({ warehouseId: 2, driverEmployeeId: null, deliveryVehicleId: null, notes: 'Loading instructions\nBring receipt' })
  expect(requests.find((request) => request.url === '/employees')?.params).toMatchObject({ canDrive: 'true', available: 'true' })
})

it('keeps an open READY-delivery search mounted when the run revision refreshes', async () => {
  const client = mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Choose ready delivery' }))
  const search = screen.getByRole('searchbox', { name: 'Search ready delivery' })
  await user.type(search, 'OUT')
  run = { ...run, revision: run.revision + 1 }
  await act(async () => { await client.invalidateQueries({ queryKey: ['delivery-runs', 'id', run.id] }) })
  await user.type(search, '-8')
  expect(screen.getByRole('searchbox', { name: 'Search ready delivery' })).toBe(search)
  expect((search as HTMLInputElement).value).toBe('OUT-8')
})

it('submits a new run only once for repeated synchronous form submissions', async () => {
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  let posts = 0
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'post') { posts++; await pending }
    return adapter(config)
  }
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  const form = screen.getByRole('button', { name: 'Create Trip' }).closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  await waitFor(() => expect(posts).toBeGreaterThan(0))
  try { expect(posts).toBe(1) } finally { release() }
})

it('creates one run from multiple cursor pages while retaining search, assignments and notes', async () => {
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  expect(screen.getByRole('menuitemcheckbox', { name: /OUT-8/, checked: true })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Load more results' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-9/ }))
  await user.type(screen.getByRole('searchbox', { name: 'Search ready delivery' }), 'OUT-9')
  await screen.findByRole('menuitemcheckbox', { name: /OUT-9/, checked: true })
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  const selected = within(screen.getByRole('list', { name: 'Selected deliveries' }))
  expect(selected.getByText('OUT-8')).toBeTruthy()
  expect(selected.getByText('OUT-9')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Choose driver' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Ana Cruz' }))
  await user.click(screen.getByRole('button', { name: 'Choose vehicle' }))
  await user.click(await screen.findByRole('menuitem', { name: /ABC-123/ }))
  await user.type(screen.getByLabelText(/Notes/), 'Review both stops')
  expect(selected.getAllByRole('listitem')).toHaveLength(2)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Create Trip' }))
  await screen.findByRole('dialog', { name: 'Delivery Trip RUN-1' })
  expect(writes()).toHaveLength(1)
  expect(writes()[0].body).toMatchObject({ warehouseId: 2, driverEmployeeId: 3, deliveryVehicleId: 4, notes: 'Review both stops', deliveries: [{ deliveryId: 8, expectedRevision: 3 }, { deliveryId: 9, expectedRevision: 3 }] })
  expect(screen.getByRole('cell', { name: 'OUT-8' })).toBeTruthy()
  expect(screen.getByRole('cell', { name: 'OUT-9' })).toBeTruthy()
  expect(run.status).toBe('DRAFT')
  expect(requests.filter((request) => request.method !== 'get').some((request) => request.url.includes('dispatch'))).toBe(false)
})

it('preserves incompatible selections on warehouse changes and permits explicit removal', async () => {
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await user.type(screen.getByLabelText(/Notes/), 'Keep these instructions')
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Other' }))
  const selected = within(screen.getByRole('list', { name: 'Selected deliveries' }))
  expect(selected.getByText('OUT-8')).toBeTruthy()
  expect(selected.getByRole('alert').textContent).toContain('chosen warehouse')
  expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  expect(screen.queryByRole('menuitemcheckbox', { name: /OUT-8/ })).toBeNull()
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-10/ }))
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Remove OUT-8 from selection' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(false))
  expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe('Keep these instructions')
  await user.click(screen.getByRole('button', { name: 'Create Trip' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0].body).toMatchObject({ warehouseId: 3, deliveries: [{ deliveryId: 10, expectedRevision: 3 }] })
})

it('keeps changed selections visible after invalidation and requires explicit reselection', async () => {
  const client = mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(false))
  deliveries[0].revision = 4
  await act(async () => { await client.invalidateQueries({ queryKey: ['outgoing-deliveries'] }) })
  await screen.findByText(/This delivery changed/)
  expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(true)
  expect(writes()).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Remove OUT-8 from selection' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Create Trip' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0].body.deliveries).toEqual([{ deliveryId: 8, expectedRevision: 4 }])
})

it('retains a selection and requires review after an uncertain membership response', async () => {
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  let attempts = 0
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'patch' && config.url === '/delivery-runs/1/deliveries') {
      attempts++
      throw { isAxiosError: true, response: { status: 503, data: { code: 'RUN_UNAVAILABLE', detail: 'Changes were not confirmed.' } } }
    }
    return adapter(config)
  }
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Add to Trip' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('temporarily offline'))
  expect(within(screen.getByRole('list', { name: 'Selected deliveries' })).getByText('OUT-8')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Add to Trip' }))
  expect(attempts).toBe(1)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh trip for review' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Refresh trip for review' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(false))
})

it('keeps assignments and delivery selections for review after an uncertain create response', async () => {
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  let attempts = 0
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'post' && config.url === '/delivery-runs') { attempts++; throw Error('Connection lost') }
    return adapter(config)
  }
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await user.type(screen.getByLabelText(/Notes/), 'Keep my review')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Create Trip' }))
  await screen.findByText(/Close and reopen the latest trip/)
  expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe('Keep my review')
  expect(within(screen.getByRole('list', { name: 'Selected deliveries' })).getByText('OUT-8')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Create Trip' }))
  expect(attempts).toBe(1)
  const close = within(screen.getByRole('button', { name: 'Create Trip' }).closest('form')!).getByRole('button', { name: 'Cancel' })
  await waitFor(() => expect(close.hasAttribute('disabled')).toBe(false))
  await user.click(close)
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  expect(within(screen.getByRole('list', { name: 'Selected deliveries' })).queryByRole('listitem')).toBeNull()
  expect((screen.getByLabelText(/Notes/) as HTMLTextAreaElement).value).toBe('')
})

it('adds multiple members in one revision-checked operation despite repeated clicks', async () => {
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Load more results' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-9/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  const add = screen.getByRole('button', { name: 'Add to Trip' })
  await waitFor(() => expect(add.hasAttribute('disabled')).toBe(false))
  act(() => { fireEvent.click(add); fireEvent.click(add) })
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ url: '/delivery-runs/1/deliveries', body: { expectedRevision: 4, add: [{ deliveryId: 8, expectedRevision: 3 }, { deliveryId: 9, expectedRevision: 3 }] } })
  await screen.findByRole('cell', { name: 'OUT-8' })
  expect(screen.getByRole('cell', { name: 'OUT-9' })).toBeTruthy()
  await waitFor(() => expect(within(screen.getByRole('list', { name: 'Selected deliveries' })).queryByRole('listitem')).toBeNull())
})

it('checks authoritative availability immediately before creating a run', async () => {
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(false))
  deliveries[0].runId = 99
  await user.click(screen.getByRole('button', { name: 'Create Trip' }))
  await screen.findByText('This delivery belongs to another trip.')
  expect(writes()).toHaveLength(0)
  expect(within(screen.getByRole('list', { name: 'Selected deliveries' })).getByText('OUT-8')).toBeTruthy()
})

it('cancels a removed selection check and never restores it when the response arrives late', async () => {
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  let release!: () => void
  let signal: { readonly aborted: boolean } | undefined
  const delayed = new Promise<void>((resolve) => { release = resolve })
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/outgoing-deliveries/8') { signal = config.signal; await delayed }
    return adapter(config)
  }
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(signal).toBeDefined())
  await user.click(screen.getByRole('button', { name: 'Remove OUT-8 from selection' }))
  expect(signal?.aborted).toBe(true)
  await act(async () => { release(); await delayed })
  expect(within(screen.getByRole('list', { name: 'Selected deliveries' })).queryByRole('listitem')).toBeNull()
  expect(screen.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(false)
})

it('does not reopen a run after the user navigates away during a pending create', async () => {
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  let release!: () => void
  let started = false
  const pending = new Promise<void>((resolve) => { release = resolve })
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'post') { started = true; await pending }
    return adapter(config)
  }
  let leave!: () => void
  function Navigation() {
    const navigate = useNavigate()
    const location = useLocation()
    leave = () => navigate('/other')
    return <><output data-testid="location">{location.pathname}{location.search}</output><Routes><Route path="/runs" element={<DeliveryRunsHub />} /><Route path="/other" element={<h1>Other workflow</h1>} /></Routes></>
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/runs']}><Navigation /></MemoryRouter></QueryClientProvider>)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Trip' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Create Trip' }))
  await waitFor(() => expect(started).toBe(true))
  act(() => leave())
  await act(async () => { release(); await waitFor(() => expect(client.isMutating()).toBe(0)) })
  expect(screen.getByRole('heading', { name: 'Other workflow' })).toBeTruthy()
  expect(screen.getByTestId('location').textContent).toBe('/other')
})


it.each(['DISPATCHED', 'COMPLETED', 'CANCELLED', 'FULL'] as const)('excludes %s trips from assignment', async (status) => {
  run = status === 'FULL'
    ? { ...run, deliveries: Array.from({ length: 100 }, (_, index) => ({ ...run.deliveries[0], id: index + 100 })) }
    : { ...run, status }
  mount('?assign=8')
  const assignment = within(await screen.findByRole('dialog', { name: 'Add Delivery to Trip' }))
  await assignment.findByText('No eligible trips shown. Create a new trip or load more results.')
  expect(assignment.queryByRole('button', { name: 'RUN-1' })).toBeNull()
  expect(assignment.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(true)
  expect(assignment.getByRole('button', { name: 'Create New Trip' })).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('loads another cursor page after an ineligible page and searches with warehouse filters', async () => {
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  apiClient.defaults.adapter = async (config) => {
    const response = await adapter(config)
    if (config.method === 'get' && config.url === '/delivery-runs' && config.params.limit === 50) {
      const later = config.params.cursor || config.params.q
      return { ...response, data: { items: later ? [structuredClone(run)] : [{ ...run, warehouseId: 3 }], nextCursor: later ? null : 'next-trip' } }
    }
    return response
  }
  mount('?assign=8')
  const user = userEvent.setup()
  const assignment = within(await screen.findByRole('dialog', { name: 'Add Delivery to Trip' }))
  await assignment.findByText('No eligible trips shown. Create a new trip or load more results.')
  await user.click(assignment.getByRole('button', { name: 'Load more results' }))
  await assignment.findByRole('button', { name: 'RUN-1' })
  expect(requests.some((entry) => entry.params.cursor === 'next-trip')).toBe(true)
  await user.type(assignment.getByRole('textbox', { name: 'Search delivery trips' }), 'RUN')
  await waitFor(() => expect(requests.some((entry) => entry.params.q === 'RUN' && entry.params.warehouseId === 2 && (entry.params.statuses as string[])?.[0] === 'DRAFT' && !entry.params.cursor)).toBe(true))
  expect(writes()).toHaveLength(0)
})

it('offers the saved trip for review when creation does not confirm the handoff member', async () => {
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  apiClient.defaults.adapter = async (config) => {
    const response = await adapter(config)
    return config.method === 'post' && config.url === '/delivery-runs'
      ? { ...response, data: { ...response.data, deliveries: [] } } : response
  }
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Create New Trip' }))
  const editor = within(await screen.findByRole('dialog', { name: 'Create Delivery Trip' }))
  await waitFor(() => expect(editor.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(false))
  await user.click(editor.getByRole('button', { name: 'Create Trip' }))
  await editor.findByText(/Trip membership was not confirmed/)
  expect(editor.getByRole('button', { name: 'Create Trip' }).hasAttribute('disabled')).toBe(true)
  await user.click(editor.getByRole('button', { name: 'Review Trip' }))
  await screen.findByRole('dialog', { name: 'Delivery Trip RUN-1' })
  expect(writes()).toHaveLength(1)
})

it('does not save a handoff trip after its original delivery is removed', async () => {
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Create New Trip' }))
  const editor = within(await screen.findByRole('dialog', { name: 'Create Delivery Trip' }))
  await user.click(await editor.findByRole('button', { name: 'Remove OUT-8 from selection' }))
  await user.click(editor.getByRole('button', { name: 'Create Trip' }))
  await editor.findByText('Keep the original delivery selected before saving this trip.')
  expect(writes()).toHaveLength(0)
})


it.each(['STALE_REVISION', 'NETWORK', 'REJECTED'])('keeps assignment reviewable after %s errors without reporting success', async (code) => {
  const adapter = apiClient.defaults.adapter as AxiosAdapter
  let attempts = 0
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'patch' && config.url === '/delivery-runs/1/deliveries') {
      attempts++
      if (code === 'NETWORK') throw Error('Connection lost')
      throw { isAxiosError: true, response: { status: code === 'STALE_REVISION' ? 409 : 422, data: { detail: 'Review required', code } } }
    }
    return adapter(config)
  }
  mount('?assign=8')
  const user = userEvent.setup()
  const assignment = within(await screen.findByRole('dialog', { name: 'Add Delivery to Trip' }))
  await user.click(await assignment.findByRole('button', { name: 'RUN-1' }))
  const add = assignment.getByRole('button', { name: 'Add to Trip' })
  await waitFor(() => expect(add.hasAttribute('disabled')).toBe(false))
  await user.click(add)
  await assignment.findByRole('alert')
  expect(screen.getByTestId('run-location').textContent).toBe('?assign=8')
  expect(deliveries[0].runId).toBeNull()
  if (code !== 'REJECTED') {
    expect(add.hasAttribute('disabled')).toBe(true)
    fireEvent.click(add)
  }
  expect(attempts).toBe(1)
})

it('requires a READY delivery before showing assignment options', async () => {
  deliveries[0].status = 'DRAFT'
  mount('?assign=8')
  const assignment = within(await screen.findByRole('dialog', { name: 'Add Delivery to Trip' }))
  await assignment.findByText(/This delivery is not available for assignment/)
  expect(assignment.queryByRole('button', { name: 'Create New Trip' })).toBeNull()
  expect(assignment.queryByRole('button', { name: 'Add to Trip' })).toBeNull()
  expect(writes()).toHaveLength(0)
})

it.each([['Remove from Trip', 'Remove from Trip'], ['Cancel delivery', 'Cancel Delivery']])('keeps %s behind a keyboard-accessible menu and confirmation', async (action, confirm) => {
  mount()
  const manage = await screen.findByRole('button', { name: 'Manage OUT-7' })
  manage.focus()
  await userEvent.keyboard('{Enter}')
  await userEvent.click(await screen.findByRole('menuitem', { name: action }))
  expect(writes()).toHaveLength(0)
  await userEvent.click(screen.getByRole('button', { name: confirm }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject(action === 'Remove from Trip'
    ? { url: '/delivery-runs/1/deliveries', body: { expectedRevision: 4, remove: [{ deliveryId: 7, expectedRevision: 9 }] } }
    : { url: '/delivery-runs/1/deliveries/7/cancel', body: { expectedRunRevision: 4, expectedDeliveryRevision: 9 } })
})
it('keeps stored departure precision when editing other trip information', async () => {
  run.scheduledDepartureAt = '2026-11-05T01:40:27.123Z'
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Trip' }))
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect((screen.getByLabelText('Scheduled Departure Date') as HTMLInputElement).value).toBe('2026-11-05')
  expect((screen.getByLabelText('Scheduled Departure Time') as HTMLInputElement).value).toBe('09:40')
  expect(screen.queryByRole('combobox', { name: /AM or PM/ })).toBeNull()
  await userEvent.type(screen.getByLabelText(/Notes/), ' More instructions')
  await userEvent.click(screen.getByRole('button', { name: 'Save Trip' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0].body.scheduledDepartureAt).toBe('2026-11-05T01:40:27.123Z')
  expect(writes()[0].url).toBe('/delivery-runs/1/draft')
})

it('groups the draft workspace and uses an honest load explanation until departure review', async () => {
  mount()
  const trip = within(await screen.findByRole('dialog', { name: 'Delivery Trip RUN-1' }))
  for (const section of ['Trip Summary', 'Deliveries in This Trip', 'Add Deliveries']) expect(trip.getByRole('region', { name: section })).toBeTruthy()
  expect(trip.getByText('Checked during departure review')).toBeTruthy()
  expect(trip.getByText('Preparing')).toBeTruthy()
  expect(trip.getByRole('button', { name: 'Review Departure' })).toBeTruthy()
  expect(trip.getByRole('button', { name: 'Add to Trip' }).classList.contains('self-start')).toBe(true)
  expect(trip.queryByRole('button', { name: 'Remove from Trip' })).toBeNull()
  expect(writes()).toHaveLength(0)
})
