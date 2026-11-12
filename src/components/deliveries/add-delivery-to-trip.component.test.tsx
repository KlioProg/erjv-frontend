import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import { apiClient } from '@/lib/api-client'
import { toast } from '@/lib/notifications'
import { useDeliveryRunById } from '@/features/logistics/delivery-runs.hooks'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import { AddDeliveryToTrip } from './AddDeliveryToTrip'

const original = apiClient.defaults.adapter
let run: DeliveryRunRecord
let deliveries: OutgoingDeliveryRecord[]
let writes: Record<string, unknown>[]
let searches: string[]
let failList: boolean
let failAssignment: boolean
let stale: boolean
let release: (() => void) | undefined
let blocked: Promise<void> | undefined
beforeEach(() => {
  writes = []
  searches = []
  failList = false
  failAssignment = false
  stale = false
  release = undefined
  blocked = undefined
  vi.spyOn(toast, 'success').mockReturnValue('success')
  vi.spyOn(toast, 'error').mockReturnValue('error')
  run = {
    id: 1,
    revision: 4,
    runNumber: 'RUN-1',
    status: 'DRAFT',
    warehouseId: 2,
    deliveries: [],
    warehouseTransfers: [],
    driverEmployeeId: null,
    deliveryVehicleId: null,
    scheduledDepartureAt: null,
    dispatchedAt: null,
    completedAt: null,
    cancelledAt: null,
    departureConfirmedByUserId: null,
    loadedWeightKg: null,
    capacityKgAtDeparture: null,
    notes: null,
    createdAt: '',
    updatedAt: '',
  }
  deliveries = [8, 9].map((id) => ({
    id,
    revision: 3,
    deliveryNumber: `OD-${id}`,
    status: 'READY',
    warehouseId: 2,
    salesOrderId: id + 10,
    runId: null,
    items: [],
    notes: null,
    plannedItems: [
      {
        id,
        outgoingDeliveryId: id,
        salesOrderItemId: id,
        plannedQuantity: '1.00',
        createdAt: '',
        updatedAt: '',
      },
    ],
    reconciledAt: null,
    reconciledByUserId: null,
    fulfillmentOutcome: null,
    hasDamage: false,
    hasMissing: false,
    cancelledAt: null,
    createdAt: '',
    updatedAt: '',
  }))
  apiClient.defaults.adapter = async (config) => {
    let data: unknown = null
    if (config.method === 'get') {
      if (config.url === '/delivery-runs/1') data = structuredClone(run)
      else if (config.url === '/outgoing-deliveries') {
        if (failList)
          throw new AxiosError('Unavailable', undefined, config, undefined, {
            config,
            status: 503,
            statusText: '',
            headers: {},
            data: { message: 'Lookup unavailable' },
          })
        const q = config.params?.q ?? ''
        searches.push(q)
        data = {
          items: deliveries.filter(
            (delivery) =>
              delivery.runId === null && (!q || `${delivery.deliveryNumber} Customer`.includes(q)),
          ),
          nextCursor: null,
        }
      } else if (config.url?.startsWith('/outgoing-deliveries/')) {
        const record = deliveries.find(
          (delivery) => delivery.id === Number(config.url!.split('/').at(-1)),
        )
        data = record
          ? { ...record, revision: stale ? record.revision + 1 : record.revision }
          : null
      } else if (config.url?.startsWith('/sales-orders/'))
        data = { id: Number(config.url.split('/').at(-1)), orderNumber: 'SO-TEST', clientId: 5 }
      else if (config.url === '/clients/5') data = { id: 5, name: 'Customer' }
    } else {
      const body = JSON.parse(config.data)
      writes.push(body)
      if (blocked) await blocked
      if (failAssignment)
        throw new AxiosError('Conflict', undefined, config, undefined, {
          config,
          status: 409,
          statusText: '',
          headers: {},
          data: { message: 'Delivery changed' },
        })
      const entry = body.add[0]
      const delivery = deliveries.find((delivery) => delivery.id === entry.deliveryId)!
      delivery.runId = 1
      run = {
        ...run,
        revision: run.revision + 1,
        deliveries: [
          ...run.deliveries,
          {
            id: delivery.id,
            revision: delivery.revision,
            deliveryNumber: delivery.deliveryNumber,
            status: delivery.status,
            salesOrderId: delivery.salesOrderId,
            warehouseId: delivery.warehouseId,
          },
        ],
      }
      data = structuredClone(run)
    }
    return { config, data, status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => {
  release?.()
  apiClient.defaults.adapter = original
  vi.restoreAllMocks()
})
function mount() {
  const busy = vi.fn()
  const submit = vi.fn()
  function Harness() {
    const query = useDeliveryRunById(1)
    return query.data ? (
      <>
        <h2>Deliveries ({query.data.deliveries.length})</h2>
        <AddDeliveryToTrip run={query.data} onBusyChange={busy} onRefresh={() => query.refetch()} />
      </>
    ) : null
  }
  const view = render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <form onSubmit={(event) => { event.preventDefault(); submit() }}><Harness /></form>
    </QueryClientProvider>,
  )
  return { busy, submit, unmount: view.unmount }
}

it('does not assign after the workflow unmounts during eligibility verification', async () => {
  const base = apiClient.defaults.adapter as import('axios').AxiosAdapter
  let finish!: () => void
  let started = false
  const pending = new Promise<void>((resolve) => { finish = resolve })
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/outgoing-deliveries/8') { started = true; await pending }
    return base(config)
  }
  const view = mount()
  await open()
  await userEvent.click(await screen.findByRole('menuitem', { name: /OD-8/ }))
  await waitFor(() => expect(started).toBe(true))
  view.unmount()
  finish()
  await waitFor(() => expect(view.busy).toHaveBeenLastCalledWith(false))
  expect(writes).toHaveLength(0)
})

it('dismisses by outside pointer without submitting the surrounding form', async () => {
  const { submit } = mount()
  await open()
  await screen.findByRole('menuitem', { name: /OD-8/ })
  fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 })
  await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
  expect(submit).not.toHaveBeenCalled()
  expect(writes).toHaveLength(0)
})
async function open() {
  await userEvent.click(await screen.findByRole('button', { name: 'Add Delivery' }))
  return screen.findByRole('searchbox', { name: 'Search delivery, sales order or customer' })
}

it('adds multiple deliveries with one selection each, fresh revisions, and no second submit', async () => {
  mount()
  await open()
  await userEvent.click(await screen.findByRole('menuitem', { name: /OD-8/ }))
  expect(await screen.findByRole('heading', { name: 'Deliveries (1)', hidden: true })).toBeTruthy()
  expect(screen.getByRole('menu')).toBeTruthy()
  await waitFor(() => expect(screen.queryByRole('menuitem', { name: /OD-8/ })).toBeNull())
  const next = await screen.findByRole('menuitem', { name: /OD-9/ })
  await waitFor(() => expect(next.getAttribute('aria-disabled')).not.toBe('true'))
  await userEvent.click(next)
  expect(await screen.findByRole('heading', { name: 'Deliveries (2)', hidden: true })).toBeTruthy()
  expect(writes).toEqual([
    { expectedRevision: 4, add: [{ deliveryId: 8, expectedRevision: 3 }] },
    { expectedRevision: 5, add: [{ deliveryId: 9, expectedRevision: 3 }] },
  ])
  expect(toast.success).toHaveBeenCalledTimes(2)
  expect(run.status).toBe('DRAFT')
  expect(screen.queryByRole('button', { name: /Add to Trip|Done selecting/ })).toBeNull()
})
it('supports keyboard selection, Escape, and focus return', async () => {
  mount()
  const search = await open()
  await screen.findByRole('menuitem', { name: /OD-8/ })
  search.focus()
  await userEvent.keyboard('{ArrowDown}{Enter}')
  await waitFor(() => expect(writes).toHaveLength(1))
  await userEvent.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add Delivery' }))
})
it('prevents duplicate selection and waits for backend confirmation', async () => {
  blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  mount()
  await open()
  const option = await screen.findByRole('menuitem', { name: /OD-8/ })
  fireEvent.click(option)
  fireEvent.click(option)
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(screen.getByRole('heading', { name: 'Deliveries (0)', hidden: true })).toBeTruthy()
  expect(screen.getByRole('status').textContent).toBe('Adding delivery…')
  release!()
  expect(await screen.findByRole('heading', { name: 'Deliveries (1)', hidden: true })).toBeTruthy()
})
it('keeps search usable after a failed assignment and shows one error notification', async () => {
  failAssignment = true
  mount()
  const search = await open()
  await userEvent.type(search, 'OD-8')
  await userEvent.click(await screen.findByRole('menuitem', { name: /OD-8/ }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1))
  expect((search as HTMLInputElement).value).toBe('OD-8')
  expect(run.deliveries).toHaveLength(0)
  expect(searches).toContain('OD-8')
})
it('rejects stale eligibility before issuing assignment', async () => {
  stale = true
  mount()
  await open()
  await userEvent.click(await screen.findByRole('menuitem', { name: /OD-8/ }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(writes).toHaveLength(0)
})
it.each(['warehouse', 'plan', 'assigned'] as const)(
  'excludes an ineligible %s delivery',
  async (issue) => {
    if (issue === 'warehouse') deliveries[0].warehouseId = 3
    if (issue === 'plan') deliveries[0].plannedItems = []
    if (issue === 'assigned') deliveries[0].runId = 9
    mount()
    await open()
    await screen.findByRole('menuitem', { name: /OD-9/ })
    expect(screen.queryByRole('menuitem', { name: /OD-8/ })).toBeNull()
    expect(writes).toHaveLength(0)
  },
)
it('distinguishes no ready records, no matching search, and a recoverable loading error', async () => {
  deliveries = []
  mount()
  const search = await open()
  expect(await screen.findByText('No ready deliveries available.')).toBeTruthy()
  await userEvent.type(search, 'missing')
  expect(await screen.findByText('No matching deliveries.')).toBeTruthy()
  failList = true
  await userEvent.type(search, 'x')
  expect(await screen.findByText('Unable to load deliveries.')).toBeTruthy()
  failList = false
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByText('No matching deliveries.')).toBeTruthy()
})
