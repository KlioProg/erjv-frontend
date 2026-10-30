import { getAdapter } from 'axios'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { dispatchDeliveryRunApi } from '@/features/logistics/delivery-runs.api'
import { validateRunLoad, type RunLoadRow } from '@/features/logistics/run-load-validation'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { DispatchDeliveryModal } from './shared/DispatchDeliveryModal'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
let run: DeliveryRunRecord
let available: string | undefined
let capacity: string | null
let failure: number | 'network' | undefined
let gate: Promise<void> | undefined
let unconfirmed: boolean
let broken: string | undefined
let vehicleAvailable: boolean
let driverAvailable: boolean
let writes: { url: string; body: Record<string, unknown> }[]
let reads: string[]
const loaded = (name = 'Banana') =>
  screen.getByLabelText(`Quantity loaded for ${name} on OD-90`) as HTMLInputElement
const weight = () => screen.getByLabelText('Actual total loaded weight (kg)') as HTMLInputElement
const button = () => screen.getByRole('button', { name: /Confirm Run Departure|Dispatching/ })
function mount() {
  const onClose = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <DispatchDeliveryModal runId={40} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { client, onClose }
}
async function ready() {
  await screen.findAllByText('Banana')
  await waitFor(() => expect(button().hasAttribute('disabled')).toBe(false))
}
function fill(quantity = '1.25', kg = '10.00') {
  fireEvent.change(loaded(), { target: { value: quantity } })
  fireEvent.change(weight(), { target: { value: kg } })
}
function submit() {
  fireEvent.submit(button().closest('form')!)
}
beforeEach(() => {
  auth.isAdmin = true
  auth.isManager = false
  auth.isStaff = false
  run = {
    id: 40,
    runNumber: 'RUN-40',
    revision: 2,
    status: 'DRAFT',
    warehouseId: 2,
    driverEmployeeId: 9,
    deliveryVehicleId: 8,
    scheduledDepartureAt: '2026-10-20T08:00:00Z',
    dispatchedAt: null,
    completedAt: null,
    cancelledAt: null,
    departureConfirmedByUserId: null,
    loadedWeightKg: null,
    capacityKgAtDeparture: null,
    notes: null,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
    deliveries: [
      {
        id: 90,
        revision: 4,
        status: 'READY',
        deliveryNumber: 'OD-90',
        warehouseId: 2,
        salesOrderId: 7,
      },
    ],
  }
  available = '4.25'
  capacity = '100.00'
  failure = undefined
  gate = undefined
  broken = undefined
  unconfirmed = false
  vehicleAvailable = true
  driverAvailable = true
  writes = []
  reads = []
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    let data: unknown
    if (config.method === 'patch') {
      const body = JSON.parse(config.data)
      writes.push({ url, body })
      await gate
      if (failure)
        throw {
          isAxiosError: true,
          response:
            failure === 'network'
              ? undefined
              : { status: failure, data: { message: 'Departure conflict; review current run' } },
        }
      data = {
        ...run,
        revision: run.revision + 1,
        status: unconfirmed ? 'DRAFT' : 'DISPATCHED',
        loadedWeightKg: body.loadedWeightKg,
      }
    } else {
      reads.push(url)
      if (broken === 'load failure' && url === '/delivery-runs/40')
        throw new Error('Run unavailable')
      if (url === '/delivery-runs/40') data = run
      else if (url === '/delivery-runs')
        data = { items: broken === 'active driver' ? [{ id: 99 }] : [], nextCursor: null }
      else if (url === '/outgoing-deliveries/90')
        data = {
          id: 90,
          deliveryNumber: 'OD-90',
          runId: 40,
          revision: broken === 'member revision' ? 3 : 4,
          salesOrderId: 7,
          warehouseId: broken === 'missing warehouse' ? null : 2,
          status: 'READY',
          items: [],
          plannedItems:
            broken === 'missing plan'
              ? []
              : [
                  { salesOrderItemId: 10, plannedQuantity: '5.25' },
                  {
                    salesOrderItemId: broken === 'duplicate plan' ? 10 : 20,
                    plannedQuantity: '3.00',
                  },
                ],
        }
      else if (url === '/sales-orders/7')
        data = {
          id: 7,
          status: broken === 'cancelled order' ? 'CANCELLED' : 'CONFIRMED',
          items:
            broken === 'missing order line'
              ? []
              : [
                  { id: 10, inventoryItemId: 1 },
                  { id: 20, inventoryItemId: 2 },
                ],
        }
      else if (url.startsWith('/inventory-items/'))
        data = {
          id: Number(url.split('/').pop()),
          name: url.endsWith('/1') ? 'Banana' : 'Mango',
          unit: url.endsWith('/1') ? 'kg' : 'boxes',
        }
      else if (url.startsWith('/stock-items/pair/'))
        data = {
          id: url.includes('/1/') ? 301 : 302,
          inventoryItemId: url.includes('/1/') ? 1 : 2,
          warehouseId: broken === 'wrong warehouse stock' ? 1 : 2,
          quantity: '20.25',
          availableQuantity:
            broken === 'unknown availability'
              ? undefined
              : url.includes('/1/')
                ? available
                : '100.00',
        }
      else if (url === '/delivery-vehicles/8')
        data = {
          id: 8,
          plateNumber: 'ABC-123',
          isActive: true,
          operationalStatus: 'SERVICEABLE',
          isAvailable: vehicleAvailable,
          activeRunId: null,
          capacityKg: capacity,
        }
      else if (url === '/employees/9')
        data = {
          id: 9,
          firstName: 'Test',
          lastName: 'Driver',
          isActive: true,
          canDrive: driverAvailable,
        }
      else if (url === '/warehouses/2') data = { id: 2, name: 'Saved warehouse', isActive: true }
      else throw new Error(`Unexpected request ${url}`)
    }
    return { config, data: structuredClone(data), status: 200, statusText: '', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
  vi.restoreAllMocks()
})

it('loads the persisted run, member plan, exact warehouse stock and saved assignments without writes', async () => {
  mount()
  await ready()
  for (const text of ['Mango', 'Saved warehouse', 'ABC-123', 'Test Driver'])
    expect(screen.getByText(text)).toBeTruthy()
  expect(loaded().value).toBe('')
  expect(weight().value).toBe('')
  expect(reads).toContain('/stock-items/pair/1/2')
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(writes).toHaveLength(0)
})
it('serializes one run departure with run and member revisions, measured weight and partial loads', async () => {
  await dispatchDeliveryRunApi(40, {
    expectedRevision: 2,
    loadedWeightKg: '10.00',
    loads: [
      {
        deliveryId: 90,
        expectedRevision: 4,
        items: [{ salesOrderItemId: 10, stockItemId: 301, loadedQuantity: '1.25' }],
      },
    ],
  })
  expect(writes).toEqual([
    {
      url: '/delivery-runs/40/dispatch',
      body: {
        expectedRevision: 2,
        loadedWeightKg: '10.00',
        loads: [
          {
            deliveryId: 90,
            expectedRevision: 4,
            items: [{ salesOrderItemId: 10, stockItemId: 301, loadedQuantity: '1.25' }],
          },
        ],
      },
    },
  ])
})
it('skips zero lines and refreshes every operational cache only after confirmed departure', async () => {
  const { client, onClose } = mount()
  await ready()
  const keys = [
    'stock-items',
    'sales-orders',
    'delivery-vehicles',
    'staffing',
    'quarantine-lots',
    'products',
    'warehouses',
  ]
  keys.forEach((key) => client.setQueryData([key, 'check'], []))
  fill()
  fireEvent.change(loaded('Mango'), { target: { value: '0' } })
  submit()
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(writes).toHaveLength(1)
  expect(writes[0].body.loads).toEqual([
    {
      deliveryId: 90,
      expectedRevision: 4,
      items: [{ salesOrderItemId: 10, stockItemId: 301, loadedQuantity: '1.25' }],
    },
  ])
  keys.forEach((key) => expect(client.getQueryState([key, 'check'])?.isInvalidated).toBe(true))
})
it('prevents duplicate submissions, edits and dismissal while departure is pending', async () => {
  let release!: () => void
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { onClose } = mount()
  await ready()
  fill()
  submit()
  submit()
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(loaded().disabled).toBe(true)
  expect(weight().disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => release())
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
})
it.each(['-1', 'abc', '1.001', '1e2', '5.26', '4.26'])(
  'rejects invalid or excessive actual member load %s',
  async (value) => {
    mount()
    await ready()
    fill(value)
    submit()
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(loaded().value).toBe(value)
    expect(writes).toHaveLength(0)
  },
)
it.each(['', '0', '-1', '1.001', 'abc', '100.01'])(
  'rejects missing, invalid or over-capacity measured weight %s',
  async (value) => {
    mount()
    await ready()
    fill('1.25', value)
    submit()
    expect((await screen.findByRole('alert')).textContent).toMatch(/actual loaded weight/)
    expect(writes).toHaveLength(0)
  },
)
it('requires a positive member line and never assumes its full plan was loaded', async () => {
  mount()
  await ready()
  fill('0')
  submit()
  expect((await screen.findByRole('alert')).textContent).toMatch(/at least one loaded product/)
  expect(writes).toHaveLength(0)
})
it.each([
  'missing plan',
  'missing warehouse',
  'missing order line',
  'wrong warehouse stock',
  'unknown availability',
  'member revision',
  'cancelled order',
])('blocks unsafe persisted context: %s', async (condition) => {
  broken = condition
  mount()
  await waitFor(() => expect(screen.getByRole('alert').textContent).not.toMatch(/Loading current/))
  expect(button().hasAttribute('disabled')).toBe(true)
  expect(writes).toHaveLength(0)
})
it('rejects duplicate plan lines before any inventory mutation', async () => {
  broken = 'duplicate plan'
  mount()
  await ready()
  fireEvent.change(screen.getAllByLabelText('Quantity loaded for Banana on OD-90')[0], {
    target: { value: '1' },
  })
  fireEvent.change(weight(), { target: { value: '10' } })
  submit()
  expect((await screen.findByRole('alert')).textContent).toMatch(/duplicate lines/)
  expect(writes).toHaveLength(0)
})
it.each(['vehicle', 'driver', 'active driver', 'capacity'] as const)(
  'validates saved run assignments before departure: %s',
  async (kind) => {
    if (kind === 'vehicle') vehicleAvailable = false
    if (kind === 'driver') driverAvailable = false
    if (kind === 'active driver') broken = kind
    if (kind === 'capacity') capacity = null
    mount()
    await screen.findByText('Banana')
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/assigned|capacity/))
    expect(button().hasAttribute('disabled')).toBe(true)
    expect(writes).toHaveLength(0)
  },
)
it.each([400, 403, 404, 409, 'network'] as const)(
  'retains entries after %s and requires explicit review before retry',
  async (status) => {
    failure = status
    const { onClose } = mount()
    await ready()
    fill('2.25')
    submit()
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/Refresh and review/))
    expect(loaded().value).toBe('2.25')
    expect(button().hasAttribute('disabled')).toBe(true)
    expect(writes).toHaveLength(1)
    expect(onClose).not.toHaveBeenCalled()
    failure = undefined
    fireEvent.click(screen.getByRole('button', { name: 'Refresh run and review current data' }))
    await waitFor(() => expect(button().hasAttribute('disabled')).toBe(false))
    submit()
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(writes).toHaveLength(2)
  },
)
it('never retries an uncertain departure when refresh shows the run already dispatched', async () => {
  failure = 'network'
  const { onClose } = mount()
  await ready()
  fill()
  submit()
  await waitFor(() => expect(button().hasAttribute('disabled')).toBe(true))
  run.status = 'DISPATCHED'
  fireEvent.click(screen.getByRole('button', { name: 'Refresh run and review current data' }))
  expect(await screen.findByText(/Only a draft run can depart/)).toBeTruthy()
  expect(writes).toHaveLength(1)
  expect(onClose).not.toHaveBeenCalled()
})
it('does not close on an unconfirmed departure response', async () => {
  unconfirmed = true
  const { onClose } = mount()
  await ready()
  fill()
  submit()
  await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/confirm|Refresh/))
  expect(onClose).not.toHaveBeenCalled()
  expect(writes).toHaveLength(1)
})
it('recovers a run load failure by explicit refresh', async () => {
  broken = 'load failure'
  mount()
  expect(await screen.findByText(/Run unavailable/)).toBeTruthy()
  expect(writes).toHaveLength(0)
  broken = undefined
  fireEvent.click(screen.getByRole('button', { name: 'Refresh run and review current data' }))
  await ready()
})
it('requires reviewed member revisions after an updated run is fetched', async () => {
  const { client } = mount()
  await ready()
  fill()
  run = { ...run, revision: 3 }
  await act(async () => {
    client.setQueryData(['delivery-runs', 'id', 40], structuredClone(run))
  })
  expect(await screen.findByText(/revision changed/)).toBeTruthy()
  expect(button().hasAttribute('disabled')).toBe(true)
  expect(loaded().value).toBe('1.25')
  expect(writes).toHaveLength(0)
})
it('preserves explicit quantities after current stock falls instead of clamping', async () => {
  mount()
  await ready()
  fill('2.25')
  available = '1.00'
  fireEvent.click(screen.getByRole('button', { name: 'Refresh run and review current data' }))
  await waitFor(() => expect(button().hasAttribute('disabled')).toBe(false))
  submit()
  expect((await screen.findByRole('alert')).textContent).toMatch(/Combined loads exceed/)
  expect(loaded().value).toBe('2.25')
  expect(writes).toHaveLength(0)
})
it('keeps planned quantities editable and never submits the shortcut automatically', async () => {
  available = '10.00'
  mount()
  await ready()
  fireEvent.click(screen.getByRole('button', { name: 'Use Planned Quantities' }))
  expect(loaded().value).toBe('5.25')
  expect(writes).toHaveLength(0)
  fill('1.00')
  expect(loaded().value).toBe('1.00')
})
it('retains permission restrictions and accessible keyboard dismissal without writing', async () => {
  auth.isAdmin = false
  const { onClose } = mount()
  expect(await screen.findByText(/do not have permission/)).toBeTruthy()
  expect(button().hasAttribute('disabled')).toBe(true)
  await userEvent.setup().keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledOnce()
  expect(writes).toHaveLength(0)
})
it('keeps large quantities exact and sums availability shared by member product lines', () => {
  const row: RunLoadRow = {
    key: '90:10',
    deliveryId: 90,
    deliveryNumber: 'OD-90',
    expectedRevision: 4,
    salesOrderItemId: 10,
    stockItemId: 301,
    productName: 'Banana',
    unit: 'kg',
    plannedQuantity: '9999999999.99',
    availableQuantity: '9999999999.99',
  }
  expect(
    validateRunLoad([{ id: 90, revision: 4 }], [row], { '90:10': '9999999999.98' }).loads[0]
      .items[0].loadedQuantity,
  ).toBe('9999999999.98')
  const shared = [
    { ...row, plannedQuantity: '5', availableQuantity: '4.25' },
    { ...row, key: '90:20', salesOrderItemId: 20, plannedQuantity: '3', availableQuantity: '4.25' },
  ]
  expect(() =>
    validateRunLoad([{ id: 90, revision: 4 }], shared, { '90:10': '3', '90:20': '2' }),
  ).toThrow(/Combined loads exceed/)
  expect(
    validateRunLoad([{ id: 90, revision: 4 }], shared, { '90:10': '1.25', '90:20': '2' }).loads[0]
      .items,
  ).toHaveLength(2)
})

it('allows staff to confirm an authorized run departure', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  const { onClose } = mount()
  await ready()
  fill()
  submit()
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(writes).toHaveLength(1)
  expect(writes[0].url).toBe('/delivery-runs/40/dispatch')
})

it('binds nested run load issues to the submitted member item and measured weight', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'patch') throw { isAxiosError: true, response: { status: 400, data: { detail: 'Review run loads.', issues: [
      { path: 'loads[0].items[1].loadedQuantity', code: 'INVALID', message: 'Mango stock changed.' },
      { path: 'loadedWeightKg', code: 'INVALID', message: 'Recheck the scale reading.' },
    ] } } }
    return base(config)
  }
  const { onClose } = mount()
  await ready()
  fill()
  fireEvent.change(loaded('Mango'), { target: { value: '2' } })
  submit()
  await waitFor(() => expect(loaded('Mango').getAttribute('aria-invalid')).toBe('true'))
  expect(loaded().getAttribute('aria-invalid')).toBe('false')
  expect(weight().getAttribute('aria-invalid')).toBe('true')
  expect(document.getElementById(loaded('Mango').getAttribute('aria-describedby')!)?.textContent).toBe('Mango stock changed.')
  expect(loaded('Mango').value).toBe('2')
  expect(onClose).not.toHaveBeenCalled()
})
