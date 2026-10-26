import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { CompleteDeliveryModal } from './shared/CompleteDeliveryModal'
import { DeliveriesHub } from './DeliveriesHub'
import { OrderDetailDrawer } from '@/components/orders/OrderDetailDrawer'
import { OrdersView } from '@/components/orders/OrdersView'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { ReactNode } from 'react'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const dates = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
const products = [
  { id: 1, name: 'Banana', unit: 'kg', unitPrice: '5.00', isActive: true },
  { id: 2, name: 'Mango', unit: 'boxes', unitPrice: '5.00', isActive: true },
]
const warehouse = {
  id: 2,
  name: 'Saved warehouse',
  address: '',
  contactNumber: null,
  isActive: true,
  ...dates,
}
const clientRecord = {
  id: 70,
  name: 'Saved customer',
  address: 'Saved destination',
  contactPerson: null,
  phone: null,
  email: null,
  isActive: true,
  ...dates,
}
let delivery: OutgoingDeliveryRecord
let order: SalesOrderRecord
let writes: { url: string; body: Record<string, unknown> }[]
let failure: number | 'network' | undefined
let gate: Promise<void> | undefined
let unconfirmed: boolean
const original = apiClient.defaults.adapter
const input = (category = 'Delivered', product = 'Banana') =>
  screen.getByRole('textbox', { name: `${category} for ${product}` }) as HTMLInputElement
function mount(ui?: ReactNode) {
  const onClose = vi.fn(),
    client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
  return {
    ...render(
      <QueryClientProvider client={client}>
        {ui ?? <CompleteDeliveryModal deliveryId={90} onClose={onClose} />}
      </QueryClientProvider>,
    ),
    client,
    onClose,
  }
}
beforeEach(() => {
  auth.isAdmin = true
  auth.isStaff = false
  writes = []
  failure = undefined
  gate = undefined
  unconfirmed = false
  const baseLine = {
    salesOrderId: 7,
    lineNumber: 1,
    quantity: '10.00',
    unitPrice: '5.00',
    discountRate: '0.00',
    discountAmount: '0.00',
    taxRate: '0.00',
    taxAmount: '0.00',
    subtotalAmount: '50.00',
    taxableAmount: '50.00',
    totalAmount: '50.00',
    notes: null,
    ...dates,
  }
  order = {
    id: 7,
    revision: 3,
    orderNumber: 'SO-7',
    status: 'CONFIRMED',
    clientId: 70,
    deliveryAddress: 'Saved destination',
    orderedAt: dates.createdAt,
    expectedAt: null,
    confirmedAt: dates.createdAt,
    completedAt: null,
    cancelledAt: null,
    externalReference: null,
    notes: null,
    ...dates,
    items: [
      { ...baseLine, id: 10, inventoryItemId: 1 },
      { ...baseLine, id: 20, inventoryItemId: 2 },
    ],
  }
  delivery = {
    id: 90,
    deliveryNumber: 'OD-90',
    salesOrderId: 7,
    warehouseId: 2,
    revision: 4,
    deliveryVehicleId: 8,
    driverEmployeeId: 9,
    status: 'DISPATCHED',
    scheduledAt: dates.createdAt,
    dispatchedAt: dates.createdAt,
    deliveredAt: null,
    cancelledAt: null,
    notes: null,
    ...dates,
    plannedItems: [
      { id: 501, outgoingDeliveryId: 90, salesOrderItemId: 10, plannedQuantity: '10.00', ...dates },
    ],
    items: [
      {
        id: 901,
        outgoingDeliveryId: 90,
        salesOrderItemId: 10,
        stockItemId: 301,
        quantity: '2.25',
        stockItem: { warehouseId: 2 },
        ...dates,
      },
      {
        id: 902,
        outgoingDeliveryId: 90,
        salesOrderItemId: 20,
        stockItemId: 302,
        quantity: '1.00',
        stockItem: { warehouseId: 2 },
        ...dates,
      },
    ],
  }
  vi.spyOn(toast, 'success').mockReturnValue('success')
  vi.spyOn(toast, 'error').mockReturnValue('error')
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    let data: unknown = []
    if (config.method === 'get')
      data =
        url === '/outgoing-deliveries/90'
          ? delivery
          : url === '/outgoing-deliveries'
            ? [delivery]
            : url === '/sales-orders/7'
              ? order
              : url === '/sales-orders'
                ? [order]
                : url === '/inventory-items'
                  ? products
                  : url === '/warehouses'
                    ? [warehouse]
                    : url === '/clients'
                      ? [clientRecord]
                      : url === '/employees'
                        ? [{ id: 9, firstName: 'Test', lastName: 'Driver', isActive: true }]
                        : url === '/delivery-vehicles'
                          ? [
                              {
                                id: 8,
                                plateNumber: 'ABC-123',
                                vehicleType: 'Truck',
                                isActive: true,
                                status:
                                  delivery.status === 'DELIVERED' ? 'AVAILABLE' : 'IN_DELIVERY',
                              },
                            ]
                          : []
    else if (url === '/outgoing-deliveries/90/complete') {
      const body = JSON.parse(config.data)
      writes.push({ url, body })
      await gate
      if (failure)
        throw {
          isAxiosError: true,
          response:
            failure === 'network'
              ? undefined
              : {
                  status: failure,
                  data: { message: 'Return was already confirmed with different counts' },
                },
        }
      delivery = {
        ...delivery,
        status: 'DELIVERED',
        items: delivery.items.map((item) => ({
          ...item,
          ...body.items.find(
            (line: { outgoingDeliveryItemId: number }) => line.outgoingDeliveryItemId === item.id,
          ),
        })),
      }
      order = { ...order, status: 'PARTIALLY_DELIVERED' }
      data = unconfirmed ? { ...delivery, status: 'DISPATCHED' } : delivery
    }
    return { config, data: structuredClone(data), status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
  vi.restoreAllMocks()
})
async function markAll() {
  await screen.findByText('Banana')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Mark All as Delivered' }))
}

it('loads actual confirmed items instead of planned quantities and waits for explicit reconciliation', async () => {
  mount()
  await screen.findByText('Banana')
  expect(screen.getByText('2.25')).toBeTruthy()
  expect(screen.getByText('1')).toBeTruthy()
  expect(input().value).toBe('')
  expect(input('Returned damaged').value).toBe('')
  expect(screen.getByText('Saved warehouse')).toBeTruthy()
  expect(writes).toHaveLength(0)
})
it('fills Mark All as Delivered without submitting, then sends confirmed loaded-item IDs and refreshes affected caches', async () => {
  const { client, onClose } = mount()
  const keys = [
    ['stock-items'],
    ['quarantine-lots'],
    ['warehouses', 'detail', 2],
    ['delivery-vehicles'],
    ['sales-orders', 'ALL'],
    ['products', 'detail', 1],
  ]
  for (const key of keys) client.setQueryData(key, [])
  await markAll()
  expect(writes).toHaveLength(0)
  expect(input().value).toBe('2.25')
  expect(input('Delivered', 'Mango').value).toBe('1.00')
  await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm Completion' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(writes[0].body).toEqual({
    items: [
      {
        outgoingDeliveryItemId: 901,
        deliveredQuantity: '2.25',
        returnedSellableQuantity: '0.00',
        returnedDamagedQuantity: '0.00',
        missingQuantity: '0.00',
      },
      {
        outgoingDeliveryItemId: 902,
        deliveredQuantity: '1.00',
        returnedSellableQuantity: '0.00',
        returnedDamagedQuantity: '0.00',
        missingQuantity: '0.00',
      },
    ],
  })
  for (const key of keys) expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  expect(
    client.getQueryData<OutgoingDeliveryRecord>(['outgoing-deliveries', 'id', 90])?.status,
  ).toBe('DELIVERED')
})
it('submits delivered, sellable returns, damaged returns and missing goods exactly with a reason', async () => {
  const { onClose } = mount()
  await markAll()
  for (const [field, value] of [
    ['Delivered', '1.00'],
    ['Returned sellable', '0.25'],
    ['Returned damaged', '0.50'],
    ['Missing', '0.50'],
    ['Discrepancy reason', ' Torn bag and missing stock '],
  ])
    fireEvent.change(input(field), { target: { value } })
  await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm Completion' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect((writes[0].body.items as Record<string, string>[])[0]).toEqual({
    outgoingDeliveryItemId: 901,
    deliveredQuantity: '1.00',
    returnedSellableQuantity: '0.25',
    returnedDamagedQuantity: '0.50',
    missingQuantity: '0.50',
    discrepancyReason: 'Torn bag and missing stock',
  })
})
it.each(['-1', 'abc', '1.001', '1e2', '2.24', '2.26'])(
  'rejects invalid quantities or reconciliation totals %s',
  async (value) => {
    mount()
    await markAll()
    fireEvent.change(input(), { target: { value } })
    fireEvent.submit(screen.getByRole('button', { name: 'Confirm Completion' }).closest('form')!)
    expect(within(input().closest('tr')!).getByRole('alert')).toBeTruthy()
    expect(input().value).toBe(value)
    expect(writes).toHaveLength(0)
  },
)
it('requires accounting for every loaded line, even if another line was fully delivered', async () => {
  mount()
  await screen.findByText('Banana')
  fireEvent.change(input(), { target: { value: '2.25' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Confirm Completion' }).closest('form')!)
  expect(within(input('Delivered', 'Mango').closest('tr')!).getByRole('alert')).toBeTruthy()
  expect(writes).toHaveLength(0)
})
it.each(['Returned damaged', 'Missing'])(
  'requires a reason for %s and preserves editable values',
  async (category) => {
    mount()
    await markAll()
    fireEvent.change(input(), { target: { value: '1.25' } })
    fireEvent.change(input(category), { target: { value: '1.00' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Confirm Completion' }).closest('form')!)
    expect(input('Discrepancy reason').getAttribute('aria-invalid')).toBe('true')
    expect(writes).toHaveLength(0)
  },
)
it('blocks completion when actual loaded records are absent rather than constructing them from the plan', async () => {
  delivery.items = []
  mount()
  expect(await screen.findByText(/confirmed loaded items could not be matched/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Confirm Completion' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(writes).toHaveLength(0)
})
it('guards pending confirmation, duplicate clicks and modal dismissal', async () => {
  let release!: () => void
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { onClose } = mount()
  await markAll()
  const form = screen.getByRole('button', { name: 'Confirm Completion' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(input().disabled).toBe(true)
  expect(screen.getByRole('button', { name: 'Close' }).hasAttribute('disabled')).toBe(true)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
  await act(async () => release())
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
})
it.each([400, 403, 404, 409, 'network'] as const)(
  'retains counts after a %s error and requires review before explicit retry',
  async (status) => {
    failure = status
    const user = userEvent.setup()
    const { onClose } = mount()
    await markAll()
    await user.click(screen.getByRole('button', { name: 'Confirm Completion' }))
    await screen.findByRole('alert')
    expect(input().value).toBe('2.25')
    expect(writes).toHaveLength(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: 'Confirm Completion' }).hasAttribute('disabled'),
    ).toBe(true)
    failure = undefined
    await user.click(screen.getByRole('button', { name: 'Refresh shipment' }))
    await waitFor(() => expect(input().disabled).toBe(false))
    await user.click(screen.getByRole('button', { name: 'Confirm Completion' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  },
)
it('does not repeat an uncertain completion after refresh finds it already delivered', async () => {
  failure = 'network'
  const user = userEvent.setup()
  mount()
  await markAll()
  await user.click(screen.getByRole('button', { name: 'Confirm Completion' }))
  await screen.findByRole('alert')
  delivery.status = 'DELIVERED'
  await user.click(screen.getByRole('button', { name: 'Refresh shipment' }))
  expect(await screen.findByText(/Only an in-transit shipment can be completed/)).toBeTruthy()
  expect(writes).toHaveLength(1)
})
it('does not announce success for an incomplete server confirmation', async () => {
  unconfirmed = true
  const { onClose } = mount()
  await markAll()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm Completion' }))
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(onClose).not.toHaveBeenCalled()
  expect(toast.success).not.toHaveBeenCalled()
})
it('preserves existing role restrictions', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  mount()
  expect(await screen.findByText(/do not have permission/)).toBeTruthy()
  expect(input().disabled).toBe(true)
  expect(writes).toHaveLength(0)
})
it('uses the same reconciliation modal from the delivery list', async () => {
  const user = userEvent.setup()
  mount(<DeliveriesHub initialTab="outgoing" />)
  await user.click(await screen.findByRole('button', { name: 'Complete Delivery OD-90' }))
  await markAll()
  await user.click(screen.getByRole('button', { name: 'Confirm Completion' }))
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: 'Complete Outgoing Delivery' })).toBeNull(),
  )
  expect(screen.queryByRole('button', { name: 'Complete Delivery OD-90' })).toBeNull()
})

it('does not offer cancellation for an already dispatched shipment', async () => {
  mount(<DeliveriesHub initialTab="outgoing" />)
  await screen.findByRole('button', { name: 'Complete Delivery OD-90' })
  expect(screen.queryByRole('button', { name: 'Cancel Delivery OD-90' })).toBeNull()
})
it('opens reconciliation from the sales order drawer without an empty-body request', async () => {
  const user = userEvent.setup()
  mount(
    <OrderDetailDrawer
      open
      onClose={vi.fn()}
      order={order}
      clients={[clientRecord]}
      products={products.map((product) => ({
        ...product,
        description: null,
        variety: null,
        ...dates,
      }))}
      warehouses={[warehouse]}
      vehicles={[]}
      employees={[]}
      stockItems={[]}
      outgoingDeliveries={[delivery]}
    />,
  )
  await user.click(screen.getByRole('button', { name: 'Confirm Customer Delivery / Complete' }))
  expect(await screen.findByRole('dialog', { name: 'Complete Outgoing Delivery' })).toBeTruthy()
  expect(writes).toHaveLength(0)
})
it('opens reconciliation from sales order row actions without assuming all goods were delivered', async () => {
  const user = userEvent.setup()
  mount(<OrdersView />)
  const action = await screen.findByRole('button', { name: /Confirm.*arrival|Confirm.*delivery/i })
  await user.click(action)
  expect(await screen.findByRole('dialog', { name: 'Complete Outgoing Delivery' })).toBeTruthy()
  expect(writes).toHaveLength(0)
})
