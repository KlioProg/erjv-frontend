import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { apiClient } from '@/lib/api-client'
import { DeliveryRunsHub } from './DeliveryRunsHub'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'

vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isAdmin: true, isManager: false, isStaff: false }) }))
const original = apiClient.defaults.adapter
let run: DeliveryRunRecord
let requests: { url: string; method: string; body: Record<string, unknown>; params: Record<string, unknown> }[]
beforeEach(() => {
  requests = []
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
      if (config.url === '/warehouses') data = { items: [{ id: 2, name: 'Main', isActive: true }], nextCursor: null }
      if (config.url === '/outgoing-deliveries') data = { items: [{ id: 8, revision: 3, deliveryNumber: 'OUT-8', status: 'READY', warehouseId: 2, runId: null, salesOrderId: 11 }], nextCursor: null }
    } else {
      if (body.expectedRevision !== undefined && body.expectedRevision !== run.revision)
        throw { isAxiosError: true, response: { status: 409, data: { detail: 'Run changed', code: 'STALE_REVISION', currentRevision: run.revision } } }
      run = { ...run, revision: run.revision + 1, ...(config.url?.endsWith('/draft') ? body : {}) }
      data = structuredClone(run)
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
})
afterEach(() => { apiClient.defaults.adapter = original })
function mount(selected = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[`/deliveries/runs${selected ? '?run=1' : ''}`]}><DeliveryRunsHub /></MemoryRouter></QueryClientProvider>)
  return client
}
const writes = () => requests.filter((request) => request.method !== 'get')

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
  expect((within(editor).getByLabelText('Notes') as HTMLInputElement).value).toBe('Unsaved loading instructions')
  expect(within(editor).getByRole('button', { name: 'Save Run' }).hasAttribute('disabled')).toBe(true)
})

it('adds an eligible READY member using distinct run and delivery revisions', async () => {
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Choose ready delivery' }))
  await user.click(await screen.findByRole('menuitem', { name: 'OUT-8 · Sales Order #11' }))
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
