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

it('reviews an incoming assignment context and confirms membership without automatic writes', async () => {
  mount('?assign=8&keep=yes')
  const user = userEvent.setup()
  const assignment = within(await screen.findByRole('dialog', { name: 'Assign Delivery' }))
  await assignment.findByText('OUT-8 · Sales Order #11')
  expect(writes()).toHaveLength(0)
  expect(assignment.queryByRole('button', { name: 'Assign Delivery' })).toBeNull()
  expect(assignment.queryByRole('button', { name: /Refresh/ })).toBeNull()
  await user.click(assignment.getByRole('button', { name: 'Use Existing Run' }))
  await user.click(assignment.getByRole('button', { name: 'Choose run' }))
  await user.click(await screen.findByRole('menuitem', { name: 'RUN-1 · Main · 1 delivery assigned' }))
  await waitFor(() => expect(assignment.getByRole('button', { name: 'Assign Delivery' }).hasAttribute('disabled')).toBe(false))
  const confirm = assignment.getByRole('button', { name: 'Assign Delivery' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ url: '/delivery-runs/1/deliveries', body: { expectedRevision: 4, add: [{ deliveryId: 8, expectedRevision: 3 }] } })
  await screen.findByRole('dialog', { name: 'RUN-1' })
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
  await user.click(await screen.findByRole('button', { name: 'Create New Run' }))
  const editor = within(await screen.findByRole('dialog', { name: 'Create Delivery Run' }))
  await editor.findByText('OUT-8')
  expect(writes()).toHaveLength(0)
  await waitFor(() => expect(editor.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(false))
  await user.click(editor.getByRole('button', { name: 'Save Run' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ method: 'post', url: '/delivery-runs', body: { warehouseId: 2, deliveries: [{ deliveryId: 8, expectedRevision: 3 }] } })
})

it('returns to the choice step with keyboard focus and preserves a selected run', async () => {
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Use Existing Run' }))
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Choose run' })))
  await user.click(screen.getByRole('button', { name: 'Choose run' }))
  await user.click(await screen.findByRole('menuitem', { name: 'RUN-1 · Main · 1 delivery assigned' }))
  await user.click(screen.getByRole('button', { name: 'Back' }))
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Use Existing Run' }))
  await user.click(screen.getByRole('button', { name: 'Use Existing Run' }))
  expect(screen.getByRole('button', { name: 'Choose run' }).textContent).toContain('RUN-1')
  expect(screen.getByText('OUT-8 · Sales Order #11')).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('applies supported run filters on the server without making writes', async () => {
  mount(false)
  const user = userEvent.setup()
  await screen.findByRole('button', { name: 'RUN-1' })
  expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Filters' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose driver' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Ana Cruz' }))
  await user.click(screen.getByRole('button', { name: 'Choose vehicle' }))
  await user.click(await screen.findByRole('menuitem', { name: 'ABC-123' }))
  fireEvent.change(screen.getByLabelText('Departure from'), { target: { value: '2026-11-01' } })
  fireEvent.change(screen.getByLabelText('Departure through'), { target: { value: '2026-11-03' } })
  await user.click(within(screen.getByRole('dialog', { name: 'Filters' })).getByRole('button', { name: 'Done' }))
  await waitFor(() => expect(requests.filter((request) => request.url === '/delivery-runs' && request.method === 'get').at(-1)?.params).toMatchObject({ warehouseId: 2, driverEmployeeId: 3, deliveryVehicleId: 4, scheduledFrom: '2026-10-31T16:00:00.000Z', scheduledBefore: '2026-11-03T16:00:00.000Z' }))
  await user.click(screen.getByRole('button', { name: /^Filters/ }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Choose driver' }).textContent).toContain('Ana Cruz'))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Choose vehicle' }).textContent).toContain('ABC-123'))
  await user.click(within(screen.getByRole('dialog', { name: 'Filters' })).getByRole('button', { name: 'Done' }))
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
  expect(screen.queryByRole('button', { name: 'Reconcile Deliveries' })).toBeNull()
  expect(writes()).toHaveLength(0)
})

it('blocks a changed assignment revision until the user refreshes and reviews', async () => {
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Use Existing Run' }))
  await user.click(await screen.findByRole('button', { name: 'Choose run' }))
  await user.click(await screen.findByRole('menuitem', { name: 'RUN-1 · Main · 1 delivery assigned' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Assign Delivery' }).hasAttribute('disabled')).toBe(false))
  run = { ...run, revision: 5 }
  await user.click(screen.getByRole('button', { name: 'Assign Delivery' }))
  await screen.findByText(/The delivery or run changed/)
  expect(writes()).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Assign Delivery' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Refresh to review' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Assign Delivery' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Assign Delivery' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0].body.expectedRevision).toBe(5)
})

it('does not allow staff assignment writes', async () => {
  auth.isAdmin = false; auth.isStaff = true
  mount('?assign=8')
  await screen.findByText(/Only administrators and managers can assign/)
  expect(screen.queryByRole('button', { name: 'Assign Delivery' })).toBeNull()
  expect(requests.some((request) => request.url === '/outgoing-deliveries/8')).toBe(false)
  expect(writes()).toHaveLength(0)
})

it('excludes preparing runs from another warehouse from the assignment picker', async () => {
  run = { ...run, warehouseId: 3 }
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Use Existing Run' }))
  await user.click(await screen.findByRole('button', { name: 'Choose run' }))
  await screen.findByText('No eligible runs on this page. Create a new run or check another page.')
  expect(screen.queryByRole('menuitem', { name: /RUN-1/ })).toBeNull()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('button', { name: 'Assign Delivery' })).toBeNull()
  expect(writes()).toHaveLength(0)
})

it('keeps an already assigned delivery read-only and opens its run', async () => {
  deliveries[0] = { ...deliveries[0], runId: 1 }
  mount('?assign=8')
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Open Run' }))
  await screen.findByRole('dialog', { name: 'RUN-1' })
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
  await user.click(await screen.findByRole('button', { name: 'Use Existing Run' }))
  await user.click(await screen.findByRole('button', { name: 'Choose run' }))
  await user.click(await screen.findByRole('menuitem', { name: 'RUN-1 · Main · 1 delivery assigned' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Assign Delivery' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Assign Delivery' }))
  await screen.findByText(/Assignment was not confirmed/)
  expect(writes()).toHaveLength(1)
  expect(screen.queryByRole('button', { name: 'Assign Delivery' })).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Open run for review' }))
  await screen.findByRole('dialog', { name: 'RUN-1' })
  expect(writes()).toHaveLength(1)
})

it('edits the reviewed draft revision without closing on a stale write', async () => {
  const client = mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Edit Run' }))
  const editor = await screen.findByRole('dialog', { name: 'Edit RUN-1' })
  fireEvent.change(within(editor).getByLabelText('Notes'), { target: { value: 'Unsaved loading instructions' } })
  run = { ...run, revision: 5, notes: 'Changed by another user' }
  await act(() => client.invalidateQueries({ queryKey: ['delivery-runs'] }))
  await user.click(within(editor).getByRole('button', { name: 'Save Run' }))
  await waitFor(() => expect(within(editor).getByRole('alert').textContent).toContain('Run changed'))
  expect(writes()[0].body.expectedRevision).toBe(4)
  expect((within(editor).getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Unsaved loading instructions')
  expect(within(editor).getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(true)
})

it('adds an eligible READY member using distinct run and delivery revisions', async () => {
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: 'OUT-8 · Sales Order #11' }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add Delivery' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Add Delivery' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ url: '/delivery-runs/1/deliveries', body: { expectedRevision: 4, add: [{ deliveryId: 8, expectedRevision: 3 }] } })
  expect(requests.find((request) => request.url === '/outgoing-deliveries')?.params).toMatchObject({ statuses: ['READY'], warehouseId: 2, unassigned: 'true' })
})

it('reopens an assigned member with the reviewed paired revisions', async () => {
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Reopen draft' }))
  await user.click(screen.getByRole('button', { name: 'Confirm change' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ url: '/delivery-runs/1/deliveries/7/reopen', body: { expectedRunRevision: 4, expectedDeliveryRevision: 9 } })
})

it('does not expose draft mutation or dispatch actions on a completed run', async () => {
  run.status = 'COMPLETED'
  run.deliveries[0].status = 'RECONCILED'
  mount()
  await screen.findByRole('dialog', { name: 'RUN-1' })
  expect(screen.queryByRole('button', { name: 'Edit Run' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Dispatch Run' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Cancel Run' })).toBeNull()
  expect(writes()).toEqual([])
})

it('creates an empty draft run without inventing deliveries or assignments', async () => {
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Save Run' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0]).toMatchObject({ url: '/delivery-runs', body: { warehouseId: 2, driverEmployeeId: null, deliveryVehicleId: null } })
  expect(writes()[0].body).not.toHaveProperty('expectedRevision')
  expect(writes()[0].body).not.toHaveProperty('deliveries')
})

it('shows inline clear actions only for selected assignments and saves cleared values', async () => {
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
  const editor = within(screen.getByRole('dialog', { name: 'Create Delivery Run' }))
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
  const notes = editor.getByLabelText('Notes') as HTMLTextAreaElement
  expect(notes.tagName).toBe('TEXTAREA')
  expect(notes.rows).toBe(2)
  await user.type(notes, 'Loading instructions{Enter}Bring receipt')
  await user.click(editor.getByRole('button', { name: 'Save Run' }))
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
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  const form = screen.getByRole('button', { name: 'Save Run' }).closest('form')!
  act(() => { fireEvent.submit(form); fireEvent.submit(form) })
  await waitFor(() => expect(posts).toBeGreaterThan(0))
  try { expect(posts).toBe(1) } finally { release() }
})

it('creates one run from multiple cursor pages while retaining search, assignments and notes', async () => {
  mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
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
  await user.type(screen.getByLabelText('Notes'), 'Review both stops')
  expect(selected.getAllByRole('listitem')).toHaveLength(2)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Save Run' }))
  await screen.findByRole('dialog', { name: 'RUN-1' })
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
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await user.type(screen.getByLabelText('Notes'), 'Keep these instructions')
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Other' }))
  const selected = within(screen.getByRole('list', { name: 'Selected deliveries' }))
  expect(selected.getByText('OUT-8')).toBeTruthy()
  expect(selected.getByRole('alert').textContent).toContain('chosen warehouse')
  expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  expect(screen.queryByRole('menuitemcheckbox', { name: /OUT-8/ })).toBeNull()
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-10/ }))
  await user.keyboard('{Escape}')
  await user.click(screen.getByRole('button', { name: 'Remove OUT-8 from selection' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(false))
  expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Keep these instructions')
  await user.click(screen.getByRole('button', { name: 'Save Run' }))
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(writes()[0].body).toMatchObject({ warehouseId: 3, deliveries: [{ deliveryId: 10, expectedRevision: 3 }] })
})

it('keeps changed selections visible after invalidation and requires explicit reselection', async () => {
  const client = mount(false)
  const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(false))
  deliveries[0].revision = 4
  await act(async () => { await client.invalidateQueries({ queryKey: ['outgoing-deliveries'] }) })
  await screen.findByText(/This delivery changed/)
  expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(true)
  expect(writes()).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: 'Remove OUT-8 from selection' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Save Run' }))
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
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add Delivery' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Add Delivery' }))
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('temporarily offline'))
  expect(within(screen.getByRole('list', { name: 'Selected deliveries' })).getByText('OUT-8')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Add Delivery' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Add Delivery' }))
  expect(attempts).toBe(1)
  await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh run for review' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Refresh run for review' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Add Delivery' }).hasAttribute('disabled')).toBe(false))
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
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await user.type(screen.getByLabelText('Notes'), 'Keep my review')
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(false))
  await user.click(screen.getByRole('button', { name: 'Save Run' }))
  await screen.findByText(/Close and reopen the latest run/)
  expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Keep my review')
  expect(within(screen.getByRole('list', { name: 'Selected deliveries' })).getByText('OUT-8')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('button', { name: 'Save Run' }))
  expect(attempts).toBe(1)
  const close = within(screen.getByRole('button', { name: 'Save Run' }).closest('form')!).getByRole('button', { name: 'Close' })
  await waitFor(() => expect(close.hasAttribute('disabled')).toBe(false))
  await user.click(close)
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
  expect(within(screen.getByRole('list', { name: 'Selected deliveries' })).queryByRole('listitem')).toBeNull()
  expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('')
})

it('adds multiple members in one revision-checked operation despite repeated clicks', async () => {
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Load more results' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-9/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  const add = screen.getByRole('button', { name: 'Add 2 Deliveries' })
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
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitemcheckbox', { name: /OUT-8/ }))
  await user.click(screen.getByRole('button', { name: 'Done selecting' }))
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(false))
  deliveries[0].runId = 99
  await user.click(screen.getByRole('button', { name: 'Save Run' }))
  await screen.findByText('This delivery belongs to another run.')
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
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
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
  expect(screen.getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(false)
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
  await user.click(screen.getByRole('button', { name: 'Create Delivery Run' }))
  await user.click(screen.getByRole('button', { name: 'Choose warehouse' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Main' }))
  await user.click(screen.getByRole('button', { name: 'Save Run' }))
  await waitFor(() => expect(started).toBe(true))
  act(() => leave())
  await act(async () => { release(); await waitFor(() => expect(client.isMutating()).toBe(0)) })
  expect(screen.getByRole('heading', { name: 'Other workflow' })).toBeTruthy()
  expect(screen.getByTestId('location').textContent).toBe('/other')
})
