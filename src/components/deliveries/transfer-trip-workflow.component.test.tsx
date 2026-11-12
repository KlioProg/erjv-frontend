import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { apiClient } from '@/lib/api-client'
import { transferFixture } from '@/features/warehouse-transfers/warehouse-transfers.fixtures'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { WarehouseTransfersPage } from '@/components/warehouse-transfers/WarehouseTransfersPage'
import { DeliveryRunsHub } from './DeliveryRunsHub'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
let transfer: ReturnType<typeof transferFixture>
let run: DeliveryRunRecord
let writes: { url: string; body: Record<string, unknown> }[]
let reads: string[]
let conflict: boolean
beforeEach(() => {
  auth.isAdmin = true
  auth.isStaff = false
  transfer = { ...transferFixture(), runId: null }
  run = {
    id: 40,
    runNumber: 'RUN-40',
    revision: 2,
    status: 'DRAFT',
    warehouseId: 1,
    driverEmployeeId: 9,
    deliveryVehicleId: 8,
    scheduledDepartureAt: '2026-11-11T01:00:00Z',
    dispatchedAt: null,
    completedAt: null,
    cancelledAt: null,
    departureConfirmedByUserId: null,
    loadedWeightKg: null,
    capacityKgAtDeparture: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
    deliveries: [],
    warehouseTransfers: [],
  }
  writes = []
  reads = []
  conflict = false
  apiClient.defaults.adapter = async (config) => {
    const url = config.url!
    let data: unknown = { items: [], nextCursor: null }
    if (config.method === 'get') {
      reads.push(url)
      if (url === '/warehouse-transfers/7') data = transfer
      if (url === '/warehouse-transfers') data = { items: [transfer], nextCursor: null }
      if (url === '/delivery-runs/40') data = run
      if (url === '/delivery-runs')
        data = { items: config.params?.driverEmployeeId ? [] : [run], nextCursor: null }
      if (url === '/warehouses/1' || url === '/warehouses/2')
        data = {
          id: Number(url.at(-1)),
          name: url.endsWith('1') ? 'Source' : 'Destination',
          isActive: true,
        }
      if (url === '/inventory-items/10') data = { id: 10, name: 'Rice', unit: 'kg', isActive: true }
      if (url === '/outgoing-deliveries/90')
        data = {
          id: 90,
          deliveryNumber: 'OD-90',
          runId: 40,
          revision: 3,
          status: 'READY',
          salesOrderId: 3,
          warehouseId: 1,
          items: [],
          plannedItems: [{ salesOrderItemId: 30, plannedQuantity: '5.00' }],
        }
      if (url === '/sales-orders/3')
        data = { id: 3, status: 'CONFIRMED', items: [{ id: 30, inventoryItemId: 10 }] }
      if (url === '/stock-items/pair/10/1')
        data = { id: 100, inventoryItemId: 10, warehouseId: 1, availableQuantity: '20.00' }
      if (url === '/employees/9')
        data = { id: 9, firstName: 'Ana', lastName: 'Cruz', canDrive: true, isActive: true }
      if (url === '/delivery-vehicles/8')
        data = {
          id: 8,
          plateNumber: 'ABC-123',
          isActive: true,
          operationalStatus: 'SERVICEABLE',
          isAvailable: true,
          activeRunId: null,
          capacityKg: '100.00',
        }
    } else {
      const body = JSON.parse(config.data)
      writes.push({ url, body })
      if (conflict)
        throw {
          isAxiosError: true,
          response: {
            status: 409,
            data: { code: 'STALE_REVISION', detail: 'Trip changed. Review saved state.' },
          },
        }
      if (
        url === '/delivery-runs/40/warehouse-transfers' ||
        (url === '/delivery-runs' && config.method === 'post')
      ) {
        transfer = { ...transfer, runId: 40, revision: transfer.revision + 1 }
        run = {
          ...run,
          ...(config.method === 'post' ? body : {}),
          revision: run.revision + 1,
          warehouseTransfers: [
            {
              id: 7,
              transferNumber: transfer.transferNumber,
              revision: transfer.revision,
              status: 'DRAFT',
              destinationWarehouseId: 2,
            },
          ],
        }
        data = run
      }
      if (url === '/delivery-runs/40/dispatch') {
        transfer = {
          ...transfer,
          status: 'DISPATCHED',
          revision: transfer.revision + 1,
          dispatchedAt: '2026-11-11T01:23:00Z',
        }
        run = {
          ...run,
          status: 'DISPATCHED',
          revision: run.revision + 1,
          dispatchedAt: transfer.dispatchedAt!,
          deliveries: run.deliveries.map((member) => ({
            ...member,
            status: 'DISPATCHED',
            revision: member.revision + 1,
          })),
          warehouseTransfers: run.warehouseTransfers!.map((member) => ({
            ...member,
            status: 'DISPATCHED',
            revision: transfer.revision,
          })),
        }
        data = run
      }
      if (url === '/warehouse-transfers/7/reconcile') {
        transfer = {
          ...transfer,
          status: 'COMPLETED',
          revision: transfer.revision + 1,
          reconciledAt: '2026-11-11T05:00:00Z',
          items: transfer.items.map((item, index) => ({ ...item, ...body.items[index] })),
        }
        run = {
          ...run,
          status: run.deliveries.every((member) => member.status === 'RECONCILED')
            ? 'COMPLETED'
            : 'DISPATCHED',
          revision: run.revision + 1,
          warehouseTransfers: run.warehouseTransfers!.map((member) => ({
            ...member,
            status: 'COMPLETED',
            revision: transfer.revision,
          })),
        }
        data = transfer
      }
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data: structuredClone(data) }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
function attach() {
  transfer.runId = run.id
  run.warehouseTransfers = [
    {
      id: 7,
      revision: transfer.revision,
      transferNumber: transfer.transferNumber,
      status: transfer.status,
      destinationWarehouseId: 2,
    },
  ]
}
function mount(path = '/deliveries/runs?transfer=7') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Location() {
    const loc = useLocation()
    return (
      <output data-testid="location">
        {loc.pathname}
        {loc.search}
      </output>
    )
  }
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/deliveries/runs" element={<DeliveryRunsHub />} />
          <Route path="/warehouse-transfers" element={<WarehouseTransfersPage />} />
        </Routes>
        <Location />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
}

it('routes a saved transfer to trip assignment instead of the obsolete direct departure endpoint', async () => {
  mount('/warehouse-transfers')
  await userEvent.click(await screen.findByRole('button', { name: 'Add to Trip' }))
  await screen.findByRole('dialog', { name: 'Add Transfer to Trip' })
  expect(screen.getByTestId('location').textContent).toBe('/deliveries/runs?transfer=7')
  expect(writes).toEqual([])
})

it('assigns an existing trip using both saved revisions and opens its saved context', async () => {
  mount()
  const dialog = within(await screen.findByRole('dialog', { name: 'Add Transfer to Trip' }))
  await userEvent.click(await dialog.findByRole('button', { name: 'Choose delivery trip' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: /RUN-40/ }))
  const add = dialog.getByRole('button', { name: 'Add to Trip' })
  await waitFor(() => expect(add.hasAttribute('disabled')).toBe(false))
  fireEvent.click(add)
  fireEvent.click(add)
  const trip = within(await screen.findByRole('dialog', { name: 'Delivery Trip RUN-40' }))
  expect(await trip.findByText('WT-000007')).toBeTruthy()
  expect(writes).toEqual([
    {
      url: '/delivery-runs/40/warehouse-transfers',
      body: { expectedRevision: 2, add: [{ transferId: 7, expectedRevision: 1 }] },
    },
  ])
})

it('blocks assignment after another employee changes a revision until saved state is reviewed', async () => {
  mount()
  const dialog = within(await screen.findByRole('dialog', { name: 'Add Transfer to Trip' }))
  await userEvent.click(await dialog.findByRole('button', { name: 'Choose delivery trip' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: /RUN-40/ }))
  await waitFor(() =>
    expect(dialog.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(
      false,
    ),
  )
  transfer.revision++
  await userEvent.click(dialog.getByRole('button', { name: 'Add to Trip' }))
  await dialog.findByRole('alert')
  expect(writes).toEqual([])
  expect(dialog.getByRole('button', { name: 'Add to Trip' }).hasAttribute('disabled')).toBe(true)
})

it('creates a trip with the saved transfer and fixes the source warehouse', async () => {
  mount()
  await userEvent.click(await screen.findByRole('button', { name: 'Create New Trip' }))
  const editor = within(await screen.findByRole('dialog', { name: 'Create Delivery Trip' }))
  expect(editor.queryByRole('button', { name: 'Choose warehouse' })).toBeNull()
  fireEvent.change(editor.getByLabelText('Scheduled Departure Date'), {
    target: { value: '2026-11-12' },
  })
  fireEvent.change(editor.getByLabelText('Scheduled Departure Time'), {
    target: { value: '09:30' },
  })
  await userEvent.click(editor.getByRole('button', { name: 'Create Trip' }))
  await screen.findByRole('dialog', { name: 'Delivery Trip RUN-40' })
  expect(writes[0]).toMatchObject({
    url: '/delivery-runs',
    body: { warehouseId: 1, warehouseTransfers: [{ transferId: 7, expectedRevision: 1 }] },
  })
})

it('sends a transfer-only trip once, pauses at the list, and lets another authorized employee reopen receiving', async () => {
  attach()
  const first = mount('/deliveries/runs?run=40')
  await userEvent.click(await screen.findByRole('button', { name: 'Review Departure' }))
  const departure = within(await screen.findByRole('dialog', { name: 'Confirm Departure?' }))
  await departure.findByText('WT-000007')
  expect(await departure.findByText('10.00')).toBeTruthy()
  fireEvent.change(departure.getByLabelText('Actual total loaded weight (kg)'), {
    target: { value: '10.00' },
  })
  await waitFor(() =>
    expect(
      departure.getByRole('button', { name: 'Review Departure' }).hasAttribute('disabled'),
    ).toBe(false),
  )
  await userEvent.click(departure.getByRole('button', { name: 'Review Departure' }))
  const send = departure.getByRole('button', { name: 'Send Trip' })
  fireEvent.click(send)
  fireEvent.click(send)
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(writes).toEqual([
    {
      url: '/delivery-runs/40/dispatch',
      body: {
        expectedRevision: 2,
        loadedWeightKg: '10.00',
        loads: [],
        transferLoads: [{ transferId: 7, expectedRevision: 1 }],
      },
    },
  ])
  expect(transfer.status).toBe('DISPATCHED')
  expect(screen.getByTestId('location').textContent).toBe('/deliveries/runs')
  first.unmount()
  first.client.clear()
  auth.isAdmin = false
  auth.isStaff = true
  mount('/deliveries/runs?run=40')
  const trip = within(await screen.findByRole('dialog', { name: 'Delivery Trip RUN-40' }))
  expect(trip.getByText('Actual departure').nextElementSibling?.textContent).not.toBe(
    'Not recorded',
  )
  await userEvent.click(trip.getByRole('button', { name: 'View Transfer' }))
  const detail = within(await screen.findByRole('dialog', { name: 'WT-000007' }))
  await userEvent.click(detail.getByRole('button', { name: /^Receive Goods/ }))
  const receipt = within(await screen.findByRole('dialog', { name: 'Record Goods Received' }))
  expect(writes).toHaveLength(1)
  await userEvent.click(
    receipt.getByRole('radio', { name: 'All items received in good condition' }),
  )
  await userEvent.click(receipt.getByRole('button', { name: 'Review Receipt' }))
  await userEvent.click(receipt.getByRole('button', { name: 'Save Receipt' }))
  const saved = within(await screen.findByRole('dialog', { name: 'WT-000007' }))
  expect(saved.getByText('Completed')).toBeTruthy()
  await userEvent.click(saved.getByRole('button', { name: 'Close' }))
  const resumed = within(await screen.findByRole('dialog', { name: 'Delivery Trip RUN-40' }))
  expect(await resumed.findByText('1 of 1 transfer receipts recorded')).toBeTruthy()
  expect(writes.map((write) => write.url)).toEqual([
    '/delivery-runs/40/dispatch',
    '/warehouse-transfers/7/reconcile',
  ])
  expect(transfer.status).toBe('COMPLETED')
})

it('sends customer and transfer members together with their own saved revisions', async () => {
  attach()
  run.deliveries = [
    {
      id: 90,
      deliveryNumber: 'OD-90',
      revision: 3,
      status: 'READY',
      warehouseId: 1,
      salesOrderId: 3,
    },
  ]
  mount('/deliveries/runs?run=40')
  await userEvent.click(await screen.findByRole('button', { name: 'Review Departure' }))
  const departure = within(await screen.findByRole('dialog', { name: 'Confirm Departure?' }))
  const quantity = await departure.findByLabelText('Quantity loaded for Rice on OD-90')
  fireEvent.change(quantity, { target: { value: '3.00' } })
  fireEvent.change(departure.getByLabelText('Actual total loaded weight (kg)'), {
    target: { value: '15.00' },
  })
  await waitFor(() =>
    expect(
      departure.getByRole('button', { name: 'Review Departure' }).hasAttribute('disabled'),
    ).toBe(false),
  )
  await userEvent.click(departure.getByRole('button', { name: 'Review Departure' }))
  await userEvent.click(departure.getByRole('button', { name: 'Send Trip' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(writes[0]).toEqual({
    url: '/delivery-runs/40/dispatch',
    body: {
      expectedRevision: 2,
      loadedWeightKg: '15.00',
      transferLoads: [{ transferId: 7, expectedRevision: 1 }],
      loads: [
        {
          deliveryId: 90,
          expectedRevision: 3,
          items: [{ salesOrderItemId: 30, stockItemId: 100, loadedQuantity: '3.00' }],
        },
      ],
    },
  })
  expect(run.status).toBe('DISPATCHED')
  expect(run.deliveries[0].status).toBe('DISPATCHED')
})

it('refreshes saved transfer results when the trip is reopened', async () => {
  attach()
  run.status = 'DISPATCHED'
  transfer.status = 'DISPATCHED'
  run.warehouseTransfers![0].status = 'DISPATCHED'
  const { client } = mount('/deliveries/runs?run=40')
  const trip = within(await screen.findByRole('dialog', { name: 'Delivery Trip RUN-40' }))
  expect(trip.getByText('0 of 1 transfer receipts recorded')).toBeTruthy()
  run.warehouseTransfers![0].status = 'COMPLETED'
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['delivery-runs'] })
  })
  expect(await trip.findByText('1 of 1 transfer receipts recorded')).toBeTruthy()
  expect(writes).toEqual([])
})
