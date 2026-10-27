import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { dispatchOutgoingDeliveryApi } from '@/features/logistics/outgoing-deliveries.api'
import { DispatchDeliveryModal } from './shared/DispatchDeliveryModal'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { StockItemWithInventoryItem } from '@/features/logistics/stock-items.types'
import { buildDispatchPlan, validateDispatchLoad } from '@/features/logistics/outgoing-dispatch'
import { DeliveriesHub } from './DeliveriesHub'
import { QuickDispatchModal } from '@/components/orders/QuickDispatchModal'
import type { ReactNode } from 'react'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false, isStaff: false }),
}))

const dates = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
let delivery: OutgoingDeliveryRecord
let order: SalesOrderRecord
let stocks: StockItemWithInventoryItem[]
let requests: { method: string; url: string; body: Record<string, unknown> }[]
let conflict: { status: number; message: string } | 'network' | undefined
let failLoad: boolean
let gate: Promise<void> | undefined
let unavailableVehicle: boolean
let unavailableDriver: boolean
let unconfirmedResponse: boolean
const originalAdapter = apiClient.defaults.adapter
const patches = () => requests.filter((request) => request.method === 'patch')
const loaded = (name = 'Banana') =>
  screen.getByRole('textbox', { name: `Actual loaded quantity for ${name}` }) as HTMLInputElement
function mount(ui?: ReactNode) {
  const onClose = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    ...render(
      <QueryClientProvider client={client}>
        {ui ?? <DispatchDeliveryModal deliveryId={90} open onClose={onClose} />}
      </QueryClientProvider>,
    ),
    client,
    onClose,
  }
}
beforeEach(() => {
  requests = []
  conflict = undefined
  failLoad = false
  gate = undefined
  unavailableVehicle = false
  unavailableDriver = false
  unconfirmedResponse = false
  delivery = {
    id: 90,
    deliveryNumber: 'OD-90',
    salesOrderId: 7,
    warehouseId: 2,
    revision: 4,
    deliveryVehicleId: null,
    driverEmployeeId: null,
    status: 'SCHEDULED',
    scheduledAt: '2026-10-20',
    dispatchedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    notes: null,
    ...dates,
    items: [],
    plannedItems: [
      { id: 531, outgoingDeliveryId: 90, salesOrderItemId: 10, plannedQuantity: '5.25', ...dates },
      { id: 532, outgoingDeliveryId: 90, salesOrderItemId: 20, plannedQuantity: '3.00', ...dates },
    ],
  }
  order = {
    id: 7,
    revision: 1,
    orderNumber: 'SO-7',
    status: 'CONFIRMED',
    clientId: 70,
    deliveryAddress: 'Saved destination',
    items: [
      { id: 10, salesOrderId: 7, inventoryItemId: 1, quantity: '100' },
      { id: 20, salesOrderId: 7, inventoryItemId: 2, quantity: '100' },
    ],
  } as SalesOrderRecord
  stocks = [
    {
      id: 301,
      inventoryItemId: 1,
      warehouseId: 2,
      quantity: '20.25',
      availableQuantity: '4.25',
      inventoryItem: { id: 1, name: 'Banana', unit: 'kg' },
      ...dates,
    },
    {
      id: 302,
      inventoryItemId: 2,
      warehouseId: 2,
      quantity: '100',
      availableQuantity: '100',
      inventoryItem: { id: 2, name: 'Mango', unit: 'boxes' },
      ...dates,
    },
    {
      id: 999,
      inventoryItemId: 1,
      warehouseId: 1,
      quantity: '500',
      availableQuantity: '500',
      inventoryItem: { id: 1, name: 'Banana', unit: 'kg' },
      ...dates,
    },
  ]
  vi.spyOn(toast, 'success').mockReturnValue('success')
  vi.spyOn(toast, 'error').mockReturnValue('error')
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    const method = config.method ?? 'get'
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})
    requests.push({ method, url, body })
    let data: unknown = []
    if (method === 'get') {
      if (url === '/outgoing-deliveries/90' && failLoad)
        throw { isAxiosError: true, response: { status: 503, data: { message: 'Unavailable' } } }
      data =
        url === '/outgoing-deliveries/90'
          ? delivery
          : url === '/outgoing-deliveries'
            ? [{ ...delivery, warehouseId: 1, plannedItems: [], items: [] }]
            : url === '/sales-orders/7'
              ? order
              : url === '/sales-orders'
                ? [order]
                : url === '/clients'
                  ? [{ id: 70, name: 'Saved customer', isActive: true }]
                  : url === '/warehouses'
                    ? [
                        { id: 1, name: 'Wrong warehouse', isActive: true },
                        { id: 2, name: 'Saved warehouse', isActive: true },
                      ]
                    : url === '/stock-items/warehouses/2'
                      ? stocks.filter((stock) => stock.warehouseId === 2)
                      : url === '/delivery-vehicles'
                        ? [
                            {
                              id: 8,
                              plateNumber: 'ABC-123',
                              status: unavailableVehicle
                                ? 'MAINTENANCE'
                                : delivery.status === 'DISPATCHED'
                                  ? 'IN_DELIVERY'
                                  : 'AVAILABLE',
                              vehicleType: 'TRUCK',
                              isActive: true,
                              model: null,
                            },
                          ]
                        : url === '/employees'
                          ? [
                              {
                                id: 9,
                                firstName: 'Test',
                                lastName: 'Driver',
                                isActive: !unavailableDriver,
                              },
                            ]
                          : []
    } else if (url === '/outgoing-deliveries/90/dispatch') {
      await gate
      if (conflict)
        throw {
          isAxiosError: true,
          response:
            conflict === 'network'
              ? undefined
              : { status: conflict.status, data: { message: conflict.message } },
        }
      delivery = {
        ...delivery,
        status: 'DISPATCHED',
        deliveryVehicleId: 8,
        driverEmployeeId: 9,
        revision: 5,
        items: (
          body.items as { salesOrderItemId: number; stockItemId: number; loadedQuantity: string }[]
        ).map((line, index) => ({
          id: index + 900,
          outgoingDeliveryId: 90,
          salesOrderItemId: line.salesOrderItemId,
          stockItemId: line.stockItemId,
          quantity: line.loadedQuantity,
          ...dates,
        })),
      }
      data = unconfirmedResponse ? { ...delivery, status: 'SCHEDULED' } : delivery
    }
    return { config, data: structuredClone(data), status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

async function chooseAssignments() {
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: /Available Delivery Vehicle/ }))
  await user.click(screen.getByRole('option', { name: /ABC-123/ }))
  await user.click(screen.getByRole('combobox', { name: /Assigned Driver/ }))
  await user.click(screen.getByRole('option', { name: /Test Driver/ }))
}

it('serializes actual loaded items with the latest dispatch contract', async () => {
  await dispatchOutgoingDeliveryApi(90, {
    deliveryVehicleId: 8,
    driverEmployeeId: 9,
    items: [{ salesOrderItemId: 10, stockItemId: 301, loadedQuantity: '1.25' }],
  })
  expect(patches()[0].body).toEqual({
    deliveryVehicleId: 8,
    driverEmployeeId: 9,
    items: [{ salesOrderItemId: 10, stockItemId: 301, loadedQuantity: '1.25' }],
  })
})

it('loads the persisted scheduled plan and source warehouse with empty confirmed items', async () => {
  mount()
  expect(await screen.findByText('Banana')).toBeTruthy()
  expect(screen.getByText('Mango')).toBeTruthy()
  expect(screen.getByText('Saved warehouse')).toBeTruthy()
  expect(screen.getByText('Saved customer')).toBeTruthy()
  expect(screen.getByText('Saved destination')).toBeTruthy()
  expect(screen.getByText('2 planned product lines')).toBeTruthy()
  expect(screen.queryByText(/0 items to transport/)).toBeNull()
  expect(loaded().value).toBe('')
  expect(loaded('Mango').value).toBe('')
  expect(screen.getByText('5.25')).toBeTruthy()
  expect(screen.getByText('4.25')).toBeTruthy()
  expect(requests.some((request) => request.url === '/outgoing-deliveries/90')).toBe(true)
  expect(patches()).toHaveLength(0)
})

it('dispatches a partial load, skips zero lines, confirms the response and refreshes shared caches', async () => {
  const user = userEvent.setup()
  const { onClose, client } = mount()
  for (const key of [
    ['stock-items', 'item', 1],
    ['sales-orders', 'ALL', 'ALL'],
    ['products'],
    ['warehouses', 'detail', 2],
  ])
    client.setQueryData(key, [])
  await screen.findByText('Banana')
  await chooseAssignments()
  fireEvent.change(loaded(), { target: { value: '1.25' } })
  fireEvent.change(loaded('Mango'), { target: { value: '0.00' } })
  await user.click(screen.getByRole('button', { name: 'Dispatch Shipment' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(patches()).toHaveLength(1)
  expect(patches()[0]).toEqual({
    method: 'patch',
    url: '/outgoing-deliveries/90/dispatch',
    body: {
      deliveryVehicleId: 8,
      driverEmployeeId: 9,
      items: [{ salesOrderItemId: 10, stockItemId: 301, loadedQuantity: '1.25' }],
    },
  })
  expect(
    client.getQueryData<OutgoingDeliveryRecord>(['outgoing-deliveries', 'id', 90])?.status,
  ).toBe('DISPATCHED')
  for (const key of [
    ['stock-items', 'item', 1],
    ['sales-orders', 'ALL', 'ALL'],
    ['products'],
    ['warehouses', 'detail', 2],
  ])
    expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  for (const url of [
    '/outgoing-deliveries',
    '/delivery-vehicles',
    '/stock-items/warehouses/2',
    '/sales-orders/7',
  ])
    expect(requests.filter((request) => request.url === url).length).toBeGreaterThan(1)
  expect(toast.success).toHaveBeenCalledTimes(1)
})

it('blocks duplicate submissions, closing and input edits while dispatch is pending', async () => {
  let release!: () => void
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { onClose } = mount()
  await screen.findByText('Banana')
  await chooseAssignments()
  fireEvent.change(loaded(), { target: { value: '2.25' } })
  const form = screen.getByRole('button', { name: 'Dispatch Shipment' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(patches()).toHaveLength(1))
  expect(loaded().disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Close' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
  expect(toast.success).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => release())
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
})

it.each(['-1', 'abc', '1.001', '1e2', '5.26', '4.26'])(
  'rejects invalid, excessive planned or unavailable loaded quantity %s',
  async (quantity) => {
    mount()
    await screen.findByText('Banana')
    await chooseAssignments()
    fireEvent.change(loaded(), { target: { value: quantity } })
    fireEvent.submit(screen.getByRole('button', { name: 'Dispatch Shipment' }).closest('form')!)
    expect(within(loaded().closest('tr')!).getByRole('alert')).toBeTruthy()
    expect(loaded().value).toBe(quantity)
    expect(patches()).toHaveLength(0)
  },
)

it('requires a positive line rather than treating the full plan as loaded', async () => {
  mount()
  await screen.findByText('Banana')
  await chooseAssignments()
  fireEvent.submit(screen.getByRole('button', { name: 'Dispatch Shipment' }).closest('form')!)
  expect(screen.getByText(/Enter at least one positive actual loaded quantity/)).toBeTruthy()
  expect(patches()).toHaveLength(0)
  fireEvent.change(loaded(), { target: { value: '0' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Dispatch Shipment' }).closest('form')!)
  expect(patches()).toHaveLength(0)
})

it.each([
  'missing plan',
  'missing warehouse',
  'missing order line',
  'wrong warehouse stock',
  'unknown availability',
  'duplicate stock',
] as const)('safely blocks %s and offers refresh', async (condition) => {
  if (condition === 'missing plan') delivery.plannedItems = []
  if (condition === 'missing warehouse') delivery.warehouseId = null
  if (condition === 'missing order line') order.items = []
  if (condition === 'wrong warehouse stock') stocks[0].warehouseId = 1
  if (condition === 'unknown availability') stocks[0].availableQuantity = undefined
  if (condition === 'duplicate stock') stocks.push({ ...stocks[0], id: 303 })
  const { onClose } = mount()
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Refresh shipment' })).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Dispatch Shipment' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(patches()).toHaveLength(0)
  expect(onClose).not.toHaveBeenCalled()
})

it.each([
  'WAREHOUSE_CAPACITY_CHANGED',
  'Vehicle is not available',
  'Driver is not active',
  'Only a scheduled delivery can be dispatched',
])(
  'retains loading inputs after backend conflict %s and requires an explicit refresh',
  async (message) => {
    conflict = { status: 409, message }
    const user = userEvent.setup()
    const { onClose } = mount()
    await screen.findByText('Banana')
    await chooseAssignments()
    fireEvent.change(loaded(), { target: { value: '2.25' } })
    await user.click(screen.getByRole('button', { name: 'Dispatch Shipment' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(loaded().value).toBe('2.25')
    expect(screen.getByRole('button', { name: 'Dispatch Shipment' }).hasAttribute('disabled')).toBe(
      true,
    )
    expect(patches()).toHaveLength(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    conflict = undefined
    await user.click(screen.getByRole('button', { name: 'Refresh shipment' }))
    await waitFor(() => expect(loaded().disabled).toBe(false))
    expect(loaded().value).toBe('2.25')
    await user.click(screen.getByRole('button', { name: 'Dispatch Shipment' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  },
)

it('does not retry an uncertain network dispatch and blocks resubmission if refresh confirms it already dispatched', async () => {
  conflict = 'network'
  const user = userEvent.setup()
  const { onClose } = mount()
  await screen.findByText('Banana')
  await chooseAssignments()
  fireEvent.change(loaded(), { target: { value: '2.25' } })
  await user.click(screen.getByRole('button', { name: 'Dispatch Shipment' }))
  await screen.findByRole('alert')
  expect(patches()).toHaveLength(1)
  expect(loaded().value).toBe('2.25')
  delivery.status = 'DISPATCHED'
  await user.click(screen.getByRole('button', { name: 'Refresh shipment' }))
  expect(await screen.findByText(/Only a scheduled shipment can be dispatched/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Dispatch Shipment' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(patches()).toHaveLength(1)
  expect(onClose).not.toHaveBeenCalled()
})

it('does not close or announce success for an unconfirmed dispatch response', async () => {
  unconfirmedResponse = true
  const user = userEvent.setup()
  const { onClose } = mount()
  await screen.findByText('Banana')
  await chooseAssignments()
  fireEvent.change(loaded(), { target: { value: '2.25' } })
  await user.click(screen.getByRole('button', { name: 'Dispatch Shipment' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(toast.success).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
})

it.each(['vehicle', 'driver'] as const)(
  'rejects a %s that becomes unavailable on refresh without dropping entered loads',
  async (assignment) => {
    const user = userEvent.setup()
    mount()
    await screen.findByText('Banana')
    await chooseAssignments()
    fireEvent.change(loaded(), { target: { value: '1.25' } })
    if (assignment === 'vehicle') unavailableVehicle = true
    else unavailableDriver = true
    await user.click(screen.getByRole('button', { name: 'Refresh shipment' }))
    await waitFor(() => expect(loaded().disabled).toBe(false))
    fireEvent.submit(screen.getByRole('button', { name: 'Dispatch Shipment' }).closest('form')!)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(loaded().value).toBe('1.25')
    expect(patches()).toHaveLength(0)
  },
)

it('recovers a delivery load failure with a safe refresh', async () => {
  failLoad = true
  const user = userEvent.setup()
  mount()
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(patches()).toHaveLength(0)
  failLoad = false
  await user.click(screen.getByRole('button', { name: 'Refresh shipment' }))
  expect(await screen.findByText('Banana')).toBeTruthy()
})

it('validates aggregate stock availability for two order lines sharing one warehouse stock item', () => {
  order.items[1].inventoryItemId = 1
  const plan = buildDispatchPlan(delivery, order, stocks)
  expect(plan.error).toBeUndefined()
  expect(plan.rows.map((row) => row.stockItemId)).toEqual([301, 301])
  const excessive = validateDispatchLoad(plan.rows, { 10: '3.00', 20: '2.00' })
  expect(Object.keys(excessive.errors)).toEqual(['10', '20'])
  const partial = validateDispatchLoad(plan.rows, { 10: '1.25', 20: '2.00' })
  expect(partial.error).toBeUndefined()
  expect(partial.items.map((item) => item.loadedQuantity)).toEqual(['1.25', '2.00'])
})

it('keeps large decimal strings exact through validation and dispatch serialization', async () => {
  delivery.plannedItems[0].plannedQuantity = '9999999999.99'
  stocks[0].availableQuantity = '9999999999.99'
  const plan = buildDispatchPlan(delivery, order, stocks)
  const validation = validateDispatchLoad(plan.rows, { 10: '9999999999.98' })
  expect(validation.error).toBeUndefined()
  await dispatchOutgoingDeliveryApi(90, {
    deliveryVehicleId: 8,
    driverEmployeeId: 9,
    items: validation.items,
  })
  expect((patches()[0].body.items as { loadedQuantity: string }[])[0].loadedQuantity).toBe(
    '9999999999.98',
  )
})

it('opens from the delivery list using its ID and updates the shipment to In Transit after confirmation', async () => {
  const user = userEvent.setup()
  mount(<DeliveriesHub initialTab="outgoing" />)
  await user.click(await screen.findByRole('button', { name: 'Dispatch OD-90' }))
  expect(await screen.findByText('Banana')).toBeTruthy()
  expect(within(screen.getByRole('dialog')).getByText('Saved warehouse')).toBeTruthy()
  await chooseAssignments()
  fireEvent.change(loaded(), { target: { value: '2.25' } })
  await user.click(screen.getByRole('button', { name: 'Dispatch Shipment' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Dispatch Shipment to Transit' })).toBeNull(),
  )
  expect(screen.queryByRole('button', { name: 'Dispatch OD-90' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Complete Delivery OD-90' })).toBeTruthy()
  expect(screen.getByText('In Transit')).toBeTruthy()
})

it('requires review when a saved plan revision changes and validates retained input against the updated plan', async () => {
  const user = userEvent.setup()
  const { client } = mount()
  await screen.findByText('Banana')
  await chooseAssignments()
  fireEvent.change(loaded(), { target: { value: '2.25' } })
  delivery = {
    ...delivery,
    revision: 5,
    plannedItems: delivery.plannedItems.map((line) => ({ ...line, plannedQuantity: '1.00' })),
  }
  act(() => client.setQueryData(['outgoing-deliveries', 'id', 90], structuredClone(delivery)))
  expect(await screen.findByText(/saved shipment plan changed/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Dispatch Shipment' }).hasAttribute('disabled')).toBe(
    true,
  )
  await user.click(screen.getByRole('button', { name: 'Refresh shipment' }))
  await waitFor(() => expect(loaded().disabled).toBe(false))
  expect(loaded().value).toBe('2.25')
  await user.click(screen.getByRole('button', { name: 'Dispatch Shipment' }))
  expect(within(loaded().closest('tr')!).getByText(/exceeds the planned 1 kg/)).toBeTruthy()
  expect(patches()).toHaveLength(0)
})

it('routes the order shortcut through existing saved planning without auto-dispatching an assumed full load', async () => {
  mount(
    <QuickDispatchModal
      open
      onClose={vi.fn()}
      order={order}
      vehicles={[]}
      employees={[]}
      warehouses={[]}
      stockItems={[]}
    />,
  )
  expect(screen.getByRole('heading', { name: 'Schedule Outgoing Delivery' })).toBeTruthy()
  await waitFor(() =>
    expect(requests.some((request) => request.url === '/sales-orders/7')).toBe(true),
  )
  expect(requests.filter((request) => request.method !== 'get')).toHaveLength(0)
  expect(screen.queryByText(/immediately dispatch/)).toBeNull()
})
