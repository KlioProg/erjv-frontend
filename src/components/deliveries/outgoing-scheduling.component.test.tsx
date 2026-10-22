import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { ScheduleDeliveryModal } from './ScheduleDeliveryModal'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'

const dates = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
function order(id: number, status: SalesOrderRecord['status'] = 'CONFIRMED'): SalesOrderRecord {
  return {
    id,
    orderNumber: `SO-${String(id).padStart(4, '0')}`,
    status,
    clientId: 1,
    deliveryAddress: 'Customer address',
    ...dates,
    items: [
      {
        id: id * 10,
        inventoryItemId: 1,
        quantity: '100',
      },
    ],
  } as SalesOrderRecord
}
function shipment(
  id: number,
  salesOrderId: number,
  status: OutgoingDeliveryRecord['status'],
  sourceCode: number,
  quantity: string,
): OutgoingDeliveryRecord {
  const stockItemId = sourceCode % 10
  return {
    id,
    salesOrderId,
    status,
    deliveryNumber: `OD-${id}`,
    deliveryVehicleId: null,
    driverEmployeeId: null,
    ...dates,
    items: [
      {
        id: id * 10,
        outgoingDeliveryId: id,
        salesOrderItemId: salesOrderId * 10,
        stockItemId,
        quantity,
        ...dates,
      },
    ],
  } as OutgoingDeliveryRecord
}
let orders: SalesOrderRecord[]
let deliveries: OutgoingDeliveryRecord[]
let requests: { method: string; url: string; body: Record<string, unknown> }[]
let scheduleFailures: number
let createFailure: boolean
let stockFailure: boolean
let stocks: {
  id: number
  warehouseId: number
  inventoryItemId: number
  quantity: string
  reservedQuantity: string
}[]
let gate: { url: string; wait: Promise<void> } | undefined
const originalAdapter = apiClient.defaults.adapter

beforeEach(() => {
  vi.spyOn(toast, 'success').mockReturnValue('test')
  vi.spyOn(toast, 'error').mockReturnValue('test')
  orders = [
    order(1),
    order(2),
    order(3, 'DRAFT'),
    order(4, 'CANCELLED'),
    order(5, 'PARTIALLY_DELIVERED'),
  ]
  deliveries = [
    shipment(20, 2, 'DRAFT', 201, '60'),
    shipment(21, 2, 'SCHEDULED', 202, '40'),
    shipment(50, 5, 'DELIVERED', 501, '60'),
  ]
  stocks = [
    { id: 1, warehouseId: 1, inventoryItemId: 1, quantity: '100', reservedQuantity: '40' },
    { id: 2, warehouseId: 2, inventoryItemId: 1, quantity: '100', reservedQuantity: '0' },
  ]
  requests = []
  scheduleFailures = 0
  createFailure = false
  stockFailure = false
  gate = undefined
  // Test-only adapter: all production services/query hooks and controls remain in use.
  apiClient.defaults.adapter = async (config) => {
    const url = config.url || ''
    const method = config.method || 'get'
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
    requests.push({ url, method, body })
    if (gate?.url === url && method !== 'get') await gate.wait
    let data: unknown = []
    if (method === 'get') {
      if (stockFailure && url === '/stock-items')
        throw {
          isAxiosError: true,
          response: { status: 503, data: { message: 'Stock unavailable' } },
        }
      const collections: Record<string, unknown> = {
        '/sales-orders': orders,
        '/outgoing-deliveries': deliveries,
        '/stock-items': stocks,
        '/inventory-items': [
          { id: 1, name: 'Rice', unit: 'sacks', isActive: true, unitPrice: 20, ...dates },
        ],
        '/clients': [{ id: 1, name: 'Harbor Hotel', isActive: true, ...dates }],
        '/warehouses': [
          { id: 1, name: 'Store', isActive: true, ...dates },
          { id: 2, name: 'Main Warehouse', isActive: true, ...dates },
        ],
        '/delivery-vehicles': [
          {
            id: 1,
            plateNumber: 'ABC-123',
            vehicleType: 'Truck',
            status: 'AVAILABLE',
            isActive: true,
            ...dates,
          },
        ],
        '/employees': [{ id: 1, firstName: 'Maria', lastName: 'Driver', isActive: true, ...dates }],
      }
      data = collections[url] ?? []
    } else if (method === 'post') {
      if (createFailure)
        throw {
          isAxiosError: true,
          response: { status: 409, data: { message: 'Shipment conflict' } },
        }
      data = { ...shipment(90, Number(body.salesOrderId), 'DRAFT', 0, '0'), ...body }
      deliveries = [...deliveries, data as OutgoingDeliveryRecord]
    } else if (url.endsWith('/schedule')) {
      if (scheduleFailures > 0) {
        scheduleFailures--
        throw {
          isAxiosError: true,
          response: { status: 409, data: { message: 'Schedule unavailable' } },
        }
      }
      const id = Number(url.split('/')[2])
      deliveries = deliveries.map((delivery) =>
        delivery.id === id ? { ...delivery, status: 'SCHEDULED' } : delivery,
      )
      data = deliveries.find((delivery) => delivery.id === id)
    }
    return { data: structuredClone(data), config, status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})
function mount(preselectedOrderId?: number) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  const close = vi.fn()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ScheduleDeliveryModal open preselectedOrderId={preselectedOrderId} onClose={close} />
    </QueryClientProvider>,
  )
  return { ...view, queryClient, close }
}
async function selectSource(user: ReturnType<typeof userEvent.setup>, name = 'Store') {
  await user.click(await screen.findByRole('combobox', { name: 'Stock source' }))
  await user.click(screen.getByRole('option', { name: new RegExp(name) }))
}
const creates = () => requests.filter((request) => request.method === 'post')
const schedules = () => requests.filter((request) => request.method === 'patch')

describe('outgoing scheduling refinement', () => {
  it('keeps the saved shipment visible when its draft consumes the final balance and scheduling fails', async () => {
    scheduleFailures = 1
    const user = userEvent.setup()
    mount(5)
    await selectSource(user, 'Main Warehouse')
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Schedule unavailable.')).toBeTruthy()
    const quantity = screen.getByRole('spinbutton', {
      name: 'Quantity to ship for Rice',
    }) as HTMLInputElement
    expect(quantity.value).toBe('40.00')
    expect(quantity.disabled).toBe(true)
    expect(quantity.getAttribute('aria-invalid')).toBe('false')
    expect(
      screen.getByRole('combobox', { name: 'Stock source' }).textContent,
    ).toContain('Main Warehouse')
    await user.click(screen.getByRole('button', { name: 'Retry Schedule' }))
    expect(await screen.findByText('Delivery scheduled')).toBeTruthy()
    expect(creates()).toHaveLength(1)
  })

  it('reveals an unavailable optional assignment and focuses its selector instead of hiding the error', async () => {
    const user = userEvent.setup()
    mount(1)
    await selectSource(user)
    await user.click(screen.getByText('Vehicle & Driver (Optional)'))
    await user.click(screen.getByRole('combobox', { name: 'Assign Vehicle (Optional)' }))
    await user.click(screen.getByRole('option', { name: 'ABC-123' }))
    await user.click(screen.getByText('Vehicle & Driver (Optional)'))
    deliveries.push({ ...shipment(80, 99, 'DRAFT', 1, '1'), deliveryVehicleId: 1 })
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(
      await screen.findByText(
        'This vehicle is unavailable. Choose another or assign later at dispatch.',
      ),
    ).toBeTruthy()
    const selector = screen.getByRole('combobox', { name: 'Assign Vehicle (Optional)' })
    expect(selector.getAttribute('aria-invalid')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(selector))
    expect(creates()).toHaveLength(0)
  })

  it('filters fully arranged orders, keeps partial orders and searches the complete result without selecting an arbitrary order', async () => {
    orders.push(...Array.from({ length: 10 }, (_, index) => order(index + 10)))
    const user = userEvent.setup()
    mount()
    await waitFor(() =>
      expect(screen.queryByText('Loading orders and shipment balances...')).toBeNull(),
    )
    expect(screen.queryByRole('combobox', { name: 'Stock source' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Sales Order to Fulfill' }))
    expect(screen.queryByRole('menuitem', { name: /SO-0002/ })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /SO-0003|SO-0004/ })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /SO-0005/ })).toBeTruthy()
    expect(screen.queryByText('Fully Scheduled')).toBeNull()
    await user.type(screen.getByRole('searchbox', { name: 'Search order or customer...' }), '0019')
    const result = screen.getByRole('menuitem', { name: /SO-0019/ })
    result.focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('spinbutton', { name: 'Quantity to ship for Rice' })).toBeTruthy()
    expect(screen.getByRole('combobox', { name: 'Stock source' })).toBeTruthy()
    expect(screen.queryByRole('checkbox')).toBeNull()
    expect(creates()).toHaveLength(0)
  })

  it('saves a draft without scheduling and preserves optional assignments and instructions across collapse', async () => {
    const user = userEvent.setup()
    const { close } = mount(1)
    await selectSource(user)
    const quantity = screen.getByRole('spinbutton', { name: 'Quantity to ship for Rice' })
    expect((quantity as HTMLInputElement).value).toBe('60.00')
    await user.clear(quantity)
    await user.type(quantity, '0.05')
    await user.click(screen.getByText('Vehicle & Driver (Optional)'))
    await user.click(screen.getByRole('combobox', { name: 'Assign Vehicle (Optional)' }))
    await user.click(screen.getByRole('option', { name: 'ABC-123' }))
    await user.click(screen.getByRole('combobox', { name: 'Assign Driver (Optional)' }))
    await user.click(screen.getByRole('option', { name: 'Maria Driver' }))
    await user.click(screen.getByText('Vehicle & Driver (Optional)'))
    expect(screen.getByText('ABC-123 · Maria Driver')).toBeTruthy()
    await user.click(screen.getByText('Delivery instructions (Optional)'))
    await user.type(
      screen.getByRole('textbox', { name: 'Delivery Notes / Instructions' }),
      'Use loading gate',
    )
    await user.click(screen.getByText('Delivery instructions (Optional)'))
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
    expect(schedules()).toHaveLength(0)
    expect(creates()[0].body).toMatchObject({
      salesOrderId: 1,
      deliveryVehicleId: 1,
      driverEmployeeId: 1,
      notes: 'Use loading gate',
      items: [{ salesOrderItemId: 10, stockItemId: 1, quantity: '0.05' }],
    })
    await user.click(screen.getByRole('button', { name: 'Done' }))
    expect(close).toHaveBeenCalledOnce()
  })

  it('creates then schedules exactly the saved ID, refreshes remaining quantities and reopening excludes a fully arranged order', async () => {
    const user = userEvent.setup()
    const view = mount(5)
    await selectSource(user, 'Main Warehouse')
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Delivery scheduled')).toBeTruthy()
    expect(creates()).toHaveLength(1)
    expect(creates()[0].body.items).toEqual([
      { salesOrderItemId: 50, stockItemId: 2, quantity: '40.00' },
    ])
    expect(schedules().map((request) => request.url)).toEqual(['/outgoing-deliveries/90/schedule'])
    expect(orders.find((candidate) => candidate.id === 5)?.status).toBe('PARTIALLY_DELIVERED')
    view.unmount()
    mount()
    await waitFor(() =>
      expect(screen.queryByText('Loading orders and shipment balances...')).toBeNull(),
    )
    await user.click(screen.getByRole('button', { name: 'Sales Order to Fulfill' }))
    expect(screen.queryByRole('menuitem', { name: /SO-0005/ })).toBeNull()
    expect(deliveries.find((delivery) => delivery.id === 90)?.status).toBe('SCHEDULED')
  })

  it('retries only the saved draft after scheduling fails and prevents duplicates during either request', async () => {
    const user = userEvent.setup()
    scheduleFailures = 1
    let release!: () => void
    gate = {
      url: '/outgoing-deliveries',
      wait: new Promise<void>((resolve) => {
        release = resolve
      }),
    }
    mount(1)
    await selectSource(user)
    const form = screen.getByRole('button', { name: 'Schedule Delivery' }).closest('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(creates()).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Saving...' }).hasAttribute('disabled')).toBe(true)
    await act(async () => release())
    expect(await screen.findByText('Schedule unavailable.')).toBeTruthy()
    expect(
      (screen.getByRole('spinbutton', { name: 'Quantity to ship for Rice' }) as HTMLInputElement)
        .disabled,
    ).toBe(true)
    gate = {
      url: '/outgoing-deliveries/90/schedule',
      wait: new Promise<void>((resolve) => {
        release = resolve
      }),
    }
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(schedules()).toHaveLength(2))
    expect(creates()).toHaveLength(1)
    await act(async () => release())
    expect(await screen.findByText('Delivery scheduled')).toBeTruthy()
    expect(creates()).toHaveLength(1)
  })

  it('refreshes a concurrent final scheduling change, blocks stale creation and never switches to another order', async () => {
    const user = userEvent.setup()
    mount(1)
    await selectSource(user)
    deliveries.push(shipment(70, 1, 'DRAFT', 101, '60'), shipment(71, 1, 'SCHEDULED', 102, '40'))
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(
      await screen.findByText(
        'All quantities have already been arranged. Review its deliveries or choose another Sales Order.',
      ),
    ).toBeTruthy()
    expect(creates()).toHaveLength(0)
    expect(screen.queryByRole('spinbutton', { name: 'Quantity to ship for Rice' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Sales Order to Fulfill' }))
    expect(screen.queryByRole('menuitem', { name: /SO-0001/ })).toBeNull()
    expect(screen.getByRole('menuitem', { name: /SO-0005/ })).toBeTruthy()
  })

  it('retains an edited quantity on a partial conflict, shows its updated source limit and allows correction', async () => {
    const user = userEvent.setup()
    mount(1)
    await selectSource(user)
    const quantity = screen.getByRole('spinbutton', { name: 'Quantity to ship for Rice' })
    await user.clear(quantity)
    await user.type(quantity, '30')
    deliveries.push(shipment(70, 1, 'DISPATCHED', 101, '80'))
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(
      await screen.findByText('Shipment quantity exceeds the remaining sales order quantity.'),
    ).toBeTruthy()
    expect((quantity as HTMLInputElement).value).toBe('30')
    expect(creates()).toHaveLength(0)
    await user.clear(quantity)
    await user.type(quantity, '20')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
    expect(creates()[0].body.items).toEqual([
      { salesOrderItemId: 10, stockItemId: 1, quantity: '20.00' },
    ])
  })

  it('releases cancelled shipment balances after refresh and handles fully scheduled preselection with a compact empty state', async () => {
    orders = [order(2)]
    const user = userEvent.setup()
    const { queryClient } = mount(2)
    expect(
      await screen.findByText(/No Sales Orders awaiting scheduling. Confirmed orders/),
    ).toBeTruthy()
    expect(screen.queryByText('Fully Scheduled')).toBeNull()
    deliveries = deliveries.map((delivery) =>
      delivery.salesOrderId === 2 ? { ...delivery, status: 'CANCELLED' } : delivery,
    )
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
    })
    expect(await screen.findByRole('spinbutton', { name: 'Quantity to ship for Rice' })).toBeTruthy()
    await selectSource(user)
    expect(
      (screen.getByRole('spinbutton', { name: 'Quantity to ship for Rice' }) as HTMLInputElement)
        .value,
    ).toBe('60.00')
  })

  it('keeps creation failures editable and retains notes for retry', async () => {
    createFailure = true
    const user = userEvent.setup()
    mount(1)
    await selectSource(user)
    await user.click(screen.getByText('Delivery instructions (Optional)'))
    await user.type(
      screen.getByRole('textbox', { name: 'Delivery Notes / Instructions' }),
      'Keep notes',
    )
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Shipment conflict.')).toBeTruthy()
    expect(
      (screen.getByRole('textbox', { name: 'Delivery Notes / Instructions' }) as HTMLInputElement)
        .value,
    ).toBe('Keep notes')
    expect(schedules()).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'Retry Schedule' })).toBeNull()
    createFailure = false
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
  })

  it('blocks unknown source data and supports query recovery without showing a false empty state', async () => {
    stockFailure = true
    const user = userEvent.setup()
    mount(1)
    expect(
      await screen.findByText('Order quantities or source stock could not be loaded.'),
    ).toBeTruthy()
    expect(screen.queryByText(/No Sales Orders awaiting scheduling. Confirmed/)).toBeNull()
    stockFailure = false
    await user.click(screen.getByRole('button', { name: 'Retry loading' }))
    await selectSource(user)
    expect(creates()).toHaveLength(0)
  })
})
