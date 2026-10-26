import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import { ScheduleDeliveryModal } from './ScheduleDeliveryModal'
import { outgoingPlanningErrors } from '@/features/logistics/outgoing-planning'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type {
  OutgoingDeliveryRecord,
  OutgoingPlanningOption,
} from '@/features/logistics/outgoing-deliveries.types'

const dates = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
function order(id: number, status: SalesOrderRecord['status'] = 'CONFIRMED'): SalesOrderRecord {
  return {
    id,
    revision: 3,
    orderNumber: `SO-${String(id).padStart(4, '0')}`,
    status,
    clientId: 1,
    deliveryAddress: 'Customer address',
    ...dates,
    items: [{ id: id * 10, inventoryItemId: 1, quantity: '100' }],
  } as SalesOrderRecord
}
function shipment(id = 90): OutgoingDeliveryRecord {
  return {
    id,
    revision: 1,
    salesOrderId: 1,
    warehouseId: null,
    status: 'DRAFT',
    deliveryNumber: `OD-${id}`,
    deliveryVehicleId: null,
    driverEmployeeId: null,
    scheduledAt: null,
    dispatchedAt: null,
    deliveredAt: null,
    cancelledAt: null,
    notes: null,
    ...dates,
    items: [],
    plannedItems: [],
  }
}
function option(id = 10, available = '60'): OutgoingPlanningOption {
  return {
    salesOrderItemId: id,
    inventoryItemId: 1,
    orderedQuantity: '100',
    committedQuantity: '10',
    scheduledQuantity: '20',
    availableQuantity: available,
    plannedQuantity: '5',
    maximumPlannableQuantity: available === '60' ? '55' : '2',
  }
}
let orders: SalesOrderRecord[]
let currentOrder: SalesOrderRecord
let deliveries: OutgoingDeliveryRecord[]
let requests: {
  method: string
  url: string
  body: Record<string, unknown>
  params?: Record<string, unknown>
}[]
let options: Record<number, OutgoingPlanningOption[]>
let conflict: { url: string; code?: string; message: string; details?: unknown } | undefined
let planningFailure: boolean
let createFailure: boolean
let uncertainCreate: boolean
let gate: { url: string; wait: Promise<void> } | undefined
const originalAdapter = apiClient.defaults.adapter
beforeEach(() => {
  vi.spyOn(toast, 'success').mockReturnValue('test')
  vi.spyOn(toast, 'error').mockReturnValue('test')
  orders = [order(1), order(2), order(3, 'DRAFT'), order(4, 'CANCELLED')]
  currentOrder = structuredClone(orders[0])
  deliveries = []
  options = { 1: [option()], 2: [option(10, '7')] }
  requests = []
  conflict = undefined
  planningFailure = false
  createFailure = false
  uncertainCreate = false
  gate = undefined
  apiClient.defaults.adapter = async (config) => {
    const url = config.url || ''
    const method = config.method || 'get'
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
    requests.push({ url, method, body, params: config.params })
    if (gate?.url === url) await gate.wait
    if (conflict?.url === url && method !== 'get') {
      const failure = conflict
      conflict = undefined
      throw { isAxiosError: true, response: { status: 409, data: failure } }
    }
    let data: unknown = []
    if (method === 'get') {
      if (url === '/outgoing-deliveries/planning-options') {
        if (planningFailure)
          throw {
            isAxiosError: true,
            response: { status: 503, data: { message: 'Planning unavailable' } },
          }
        data = options[Number(config.params.warehouseId)] ?? []
      } else {
        const collections: Record<string, unknown> = {
          '/sales-orders': orders,
          '/sales-orders/1': currentOrder,
          '/sales-orders/2': orders[1],
          '/outgoing-deliveries': deliveries,
          '/inventory-items': [
            { id: 1, name: 'Rice', variety: 'Premium', unit: 'sacks', isActive: true, ...dates },
          ],
          '/clients': [{ id: 1, name: 'Harbor Hotel', isActive: true, ...dates }],
          '/warehouses': [
            { id: 1, name: 'Store', isActive: true, ...dates },
            { id: 2, name: 'Main Warehouse', isActive: true, ...dates },
            { id: 3, name: 'Inactive', isActive: false, ...dates },
          ],
        }
        data =
          collections[url] ??
          deliveries.find((delivery) => url === `/outgoing-deliveries/${delivery.id}`) ??
          null
      }
    } else if (method === 'post') {
      if (createFailure)
        throw {
          isAxiosError: true,
          response: { status: 409, data: { message: 'Shipment conflict' } },
        }
      data = { ...shipment(), ...body }
      deliveries.push(data as OutgoingDeliveryRecord)
      if (uncertainCreate) throw { isAxiosError: true, message: 'Network Error' }
    } else if (url.endsWith('/draft')) {
      const id = Number(url.split('/')[2])
      const saved = deliveries.find((delivery) => delivery.id === id)!
      expect(body.expectedRevision).toBe(saved.revision)
      data = {
        ...saved,
        ...body,
        revision: saved.revision + 1,
        plannedItems: (
          body.plannedItems as { salesOrderItemId: number; plannedQuantity: string }[]
        ).map((item, index) => ({ ...item, id: index + 1, outgoingDeliveryId: id, ...dates })),
      }
      deliveries = deliveries.map((delivery) =>
        delivery.id === id ? (data as OutgoingDeliveryRecord) : delivery,
      )
    } else if (url.endsWith('/schedule')) {
      const id = Number(url.split('/')[2])
      const saved = deliveries.find((delivery) => delivery.id === id)!
      expect(body).toEqual({ expectedRevision: saved.revision })
      data = { ...saved, status: 'SCHEDULED', revision: saved.revision + 1 }
      deliveries = deliveries.map((delivery) =>
        delivery.id === id ? (data as OutgoingDeliveryRecord) : delivery,
      )
    }
    return { data: structuredClone(data), config, status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})
function mount(
  preselectedOrderId: number | undefined = 1,
  draftId?: number,
  cachedDraft?: OutgoingDeliveryRecord,
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  if (cachedDraft)
    queryClient.setQueryData(['outgoing-deliveries', 'id', cachedDraft.id], cachedDraft)
  const close = vi.fn()
  const view = render(
    <QueryClientProvider client={queryClient}>
      <ScheduleDeliveryModal
        open
        preselectedOrderId={preselectedOrderId}
        draftId={draftId}
        onClose={close}
      />
    </QueryClientProvider>,
  )
  return { ...view, queryClient, close }
}
async function selectWarehouse(user: ReturnType<typeof userEvent.setup>, name = 'Store') {
  await user.click(await screen.findByRole('combobox', { name: /Stock Source \/ Warehouse/ }))
  await user.click(await screen.findByRole('option', { name }))
  await waitFor(() =>
    expect(
      (screen.getByRole('spinbutton', { name: 'Quantity to ship for Rice' }) as HTMLInputElement)
        .disabled,
    ).toBe(false),
  )
}
const quantity = () =>
  screen.getByRole('spinbutton', { name: 'Quantity to ship for Rice' }) as HTMLInputElement
const creates = () => requests.filter((request) => request.method === 'post')
const updates = () =>
  requests.filter((request) => request.method === 'patch' && request.url.endsWith('/draft'))
const schedules = () =>
  requests.filter((request) => request.method === 'patch' && request.url.endsWith('/schedule'))

describe('outgoing delivery warehouse planning', () => {
  it('keeps expanded instructions editable and footer actions usable without changing the saved plan', async () => {
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    await user.type(quantity(), '3')
    const disclosure = screen.getByText('Delivery instructions (Optional)')
    await user.click(disclosure)
    const notes = await screen.findByRole('textbox', { name: 'Delivery Notes / Instructions' })
    await user.type(notes, 'Use the rear loading gate.')
    await user.click(disclosure)
    await user.click(disclosure)
    expect((screen.getByRole('textbox', { name: 'Delivery Notes / Instructions' }) as HTMLInputElement).value).toBe('Use the rear loading gate.')
    expect(creates()).toHaveLength(0)
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByRole('button', { name: 'Schedule Delivery' }) as HTMLButtonElement).disabled).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
    expect(updates()[0].body).toMatchObject({ notes: 'Use the rear loading gate.', plannedItems: [{ salesOrderItemId: 10, plannedQuantity: '3.00' }] })
    expect(schedules()).toHaveLength(0)
  })

  it('does not create another header when the server saved it but the response was lost', async () => {
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    await user.type(quantity(), '3')
    uncertainCreate = true
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText(/The result is uncertain/)).toBeTruthy()
    expect(screen.getByText(/refresh Outgoing Deliveries to find the draft/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(creates()).toHaveLength(1)
    expect(deliveries).toHaveLength(1)
    expect(schedules()).toHaveLength(0)
    expect(quantity().value).toBe('3')
  })

  it('refreshes a cached draft before restoring its saved plan', async () => {
    const cached = { ...shipment(), revision: 2, warehouseId: 1 }
    deliveries = [
      {
        ...cached,
        revision: 7,
        plannedItems: [
          {
            id: 1,
            outgoingDeliveryId: 90,
            salesOrderItemId: 10,
            plannedQuantity: '1.25',
            ...dates,
          },
        ],
      },
    ]
    mount(undefined, 90, cached)
    await waitFor(() => expect(quantity().value).toBe('1.25'))
    expect(screen.getByText(/Revision 7/)).toBeTruthy()
  })

  it('saves only positive lines in a mixed plan and permits an unset draft date', async () => {
    currentOrder.items.push(
      { ...currentOrder.items[0], id: 11 },
      { ...currentOrder.items[0], id: 12 },
    )
    options[1].push(option(11), option(12))
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('combobox', { name: /Stock Source/ }))
    await user.click(screen.getByRole('option', { name: 'Store' }))
    const inputs = await screen.findAllByRole('spinbutton')
    await waitFor(() => expect((inputs[0] as HTMLInputElement).disabled).toBe(false))
    await user.type(inputs[0], '1.25')
    await user.type(inputs[1], '0')
    fireEvent.change(screen.getByLabelText('Scheduled Date & Time'), { target: { value: '' } })
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Enter a valid scheduled date and time.')).toBeTruthy()
    expect(creates()).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
    expect(updates()[0].body).toEqual(
      expect.objectContaining({
        scheduledAt: null,
        plannedItems: [{ salesOrderItemId: 10, plannedQuantity: '1.25' }],
      }),
    )
    expect(schedules()).toHaveLength(0)
  })
  it('uses balanced responsive selectors, one warehouse, current persisted lines, and blank quantity inputs', async () => {
    currentOrder.items[0].id = 11
    options[1] = [option(11)]
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    const sales = screen.getByRole('button', { name: 'Sales Order to Fulfill' })
    const warehouse = screen.getByRole('combobox', { name: /Stock Source \/ Warehouse/ })
    expect(sales.parentElement?.parentElement).toBe(warehouse.parentElement?.parentElement)
    expect(sales.parentElement?.parentElement?.className).toContain('grid-cols-1')
    expect(sales.parentElement?.parentElement?.className).toContain('sm:grid-cols-2')
    expect(quantity().value).toBe('')
    expect(quantity().placeholder).toBe('0')
    expect(quantity().id).toBe('delivery-quantity-11')
    expect(screen.getByText('Customer address')).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Warehouse Available' })).toBeTruthy()
    expect(screen.getByText('70.00')).toBeTruthy()
    expect(screen.queryByText('Add stock source')).toBeNull()
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
    await user.type(quantity(), '21')
    expect(quantity().value).toBe('21')
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Delivery scheduled')).toBeTruthy()
    expect(creates()[0].body).toEqual({ salesOrderId: 1 })
    expect(updates()[0].body).toEqual(
      expect.objectContaining({
        expectedRevision: 1,
        warehouseId: 1,
        plannedItems: [{ salesOrderItemId: 11, plannedQuantity: '21.00' }],
      }),
    )
    expect(schedules()[0].body).toEqual({ expectedRevision: 2 })
    expect(requests.find((request) => request.url.endsWith('/planning-options'))?.params).toEqual({
      salesOrderId: 1,
      warehouseId: 1,
    })
    expect(requests.some((request) => /dispatch|complete|stock-items/.test(request.url))).toBe(
      false,
    )
  })

  it('preserves entered quantities across warehouses and shows the new limit without clamping', async () => {
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    await user.type(quantity(), '21')
    await selectWarehouse(user, 'Main Warehouse')
    expect(quantity().value).toBe('21')
    expect(
      await screen.findByText('Maximum plannable quantity is 2.00. Review this quantity.'),
    ).toBeTruthy()
    expect(screen.getByText('7.00')).toBeTruthy()
    expect(quantity().getAttribute('aria-invalid')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(creates()).toHaveLength(0)
    await user.clear(quantity())
    await user.type(quantity(), '1.25')
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Delivery scheduled')).toBeTruthy()
    expect(updates()[0].body.warehouseId).toBe(2)
  })

  it('does not show availability from a previous warehouse while the next query is loading', async () => {
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    await user.type(quantity(), '4')
    let release!: () => void
    gate = {
      url: '/outgoing-deliveries/planning-options',
      wait: new Promise((resolve) => {
        release = resolve
      }),
    }
    await user.click(screen.getByRole('combobox', { name: /Stock Source/ }))
    await user.click(screen.getByRole('option', { name: 'Main Warehouse' }))
    expect(quantity().value).toBe('4')
    expect(quantity().disabled).toBe(true)
    expect(screen.queryByText('60.00')).toBeNull()
    await act(async () => {
      gate = undefined
      release()
    })
    await waitFor(() => expect(quantity().disabled).toBe(false))
  })

  it('restores saved draft quantities, notes, warehouse and revision and updates the same identity', async () => {
    deliveries = [
      {
        ...shipment(),
        revision: 7,
        warehouseId: 1,
        notes: 'Saved instructions',
        scheduledAt: '2026-11-01T01:00:00Z',
        plannedItems: [
          {
            id: 1,
            outgoingDeliveryId: 90,
            salesOrderItemId: 10,
            plannedQuantity: '1.25',
            ...dates,
          },
        ],
      },
    ]
    const user = userEvent.setup()
    mount(undefined, 90)
    await waitFor(() =>
      expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1.25'),
    )
    await waitFor(() => expect(quantity().disabled).toBe(false))
    expect(screen.getByText('Saved instructions')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Delivery scheduled')).toBeTruthy()
    expect(creates()).toHaveLength(0)
    expect(updates()[0].body.expectedRevision).toBe(7)
    expect(schedules()[0].body.expectedRevision).toBe(8)
  })

  it('omits zero and blank lines, allows an empty draft, and blocks scheduling an empty plan', async () => {
    currentOrder.items.push({ ...currentOrder.items[0], id: 12, inventoryItemId: 2 })
    options[1].push({ ...option(12), inventoryItemId: 2 })
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(
      await screen.findByText(
        'Enter a positive planned quantity for at least one product before scheduling.',
      ),
    ).toBeTruthy()
    expect(creates()).toHaveLength(0)
    await user.type(quantity(), '0')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
    expect(updates()[0].body.plannedItems).toEqual([])
    expect(schedules()).toHaveLength(0)
  })

  it.each(['-1', '1.234', '56'])('rejects an invalid planning quantity %s', async (value) => {
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    fireEvent.change(quantity(), { target: { value } })
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    await waitFor(() => expect(quantity().getAttribute('aria-invalid')).toBe('true'))
    expect(creates()).toHaveLength(0)
  })

  it('preserves input when scheduling fails and retries the same saved draft without another create', async () => {
    conflict = { url: '/outgoing-deliveries/90/schedule', message: 'Schedule unavailable' }
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    await user.type(quantity(), '1.25')
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Schedule unavailable.')).toBeTruthy()
    expect(quantity().value).toBe('1.25')
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Delivery scheduled')).toBeTruthy()
    expect(creates()).toHaveLength(1)
    expect(updates().map((request) => request.body.expectedRevision)).toEqual([1, 2])
    expect(schedules().map((request) => request.body.expectedRevision)).toEqual([2, 3])
  })

  it('keeps a created header after a failed draft update and retries its revision', async () => {
    conflict = { url: '/outgoing-deliveries/90/draft', message: 'Draft save unavailable' }
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    await user.type(quantity(), '3')
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Draft save unavailable.')).toBeTruthy()
    expect(quantity().value).toBe('3')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
    expect(creates()).toHaveLength(1)
    expect(updates().map((request) => request.body.expectedRevision)).toEqual([1, 1])
  })

  it('fetches a stale draft for deliberate review and never automatically retries with its new revision', async () => {
    deliveries = [{ ...shipment(), revision: 7, warehouseId: 1 }]
    const user = userEvent.setup()
    mount(undefined, 90)
    await waitFor(() => expect(quantity().disabled).toBe(false))
    await user.type(quantity(), '3')
    deliveries[0] = {
      ...deliveries[0],
      revision: 8,
      notes: 'Another user note',
      plannedItems: [
        { id: 1, outgoingDeliveryId: 90, salesOrderItemId: 10, plannedQuantity: '1.25', ...dates },
      ],
    }
    conflict = { url: '/outgoing-deliveries/90/draft', code: 'STALE_REVISION', message: 'Changed' }
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText(/Latest saved delivery: revision 8/)).toBeTruthy()
    expect(quantity().value).toBe('3')
    expect(updates()).toHaveLength(1)
    expect(schedules()).toHaveLength(0)
    expect((screen.getByRole('button', { name: 'Save Draft' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    await user.click(screen.getByRole('button', { name: 'Load latest draft' }))
    expect(quantity().value).toBe('1.25')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
    expect(updates()[1].body.expectedRevision).toBe(8)
  })

  it.each(['ORDER_CAPACITY_CHANGED', 'WAREHOUSE_CAPACITY_CHANGED', 'PLAN_LIMIT_EXCEEDED'])(
    'uses the current maximum from %s and keeps unsaved input',
    async (code) => {
      conflict = {
        url: '/outgoing-deliveries/90/schedule',
        code,
        message: 'Capacity changed',
        details: [{ salesOrderItemId: 10, currentMaximumQuantity: '1.00' }],
      }
      const user = userEvent.setup()
      mount()
      await selectWarehouse(user)
      await user.type(quantity(), '3')
      await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
      expect(
        await screen.findByText('Maximum plannable quantity is 1.00. Review this quantity.'),
      ).toBeTruthy()
      expect(quantity().value).toBe('3')
      await user.clear(quantity())
      await user.type(quantity(), '1')
      await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
      expect(await screen.findByText('Delivery scheduled')).toBeTruthy()
      expect(creates()).toHaveLength(1)
    },
  )

  it('requires review after INVALID_DELIVERY_STATE and blocks editing a scheduled record', async () => {
    deliveries = [{ ...shipment(), revision: 7, warehouseId: 1 }]
    const user = userEvent.setup()
    mount(undefined, 90)
    await waitFor(() => expect(quantity().disabled).toBe(false))
    deliveries[0].status = 'SCHEDULED'
    conflict = {
      url: '/outgoing-deliveries/90/draft',
      code: 'INVALID_DELIVERY_STATE',
      message: 'State changed',
    }
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await user.click(await screen.findByRole('button', { name: 'Load latest draft' }))
    expect(
      await screen.findByText('This delivery is scheduled and cannot be edited here.'),
    ).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Schedule Delivery' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(schedules()).toHaveLength(0)
  })

  it('rejects replaced saved Sales Order line references instead of rewriting them', async () => {
    deliveries = [
      {
        ...shipment(),
        warehouseId: 1,
        plannedItems: [
          { id: 1, outgoingDeliveryId: 90, salesOrderItemId: 9, plannedQuantity: '3', ...dates },
        ],
      },
    ]
    const user = userEvent.setup()
    mount(undefined, 90)
    expect(await screen.findByText(/Order line #9: This Sales Order line has changed/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(updates()).toHaveLength(0)
  })

  it('shows planning loading errors and recovers without losing quantities', async () => {
    planningFailure = true
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('combobox', { name: /Stock Source/ }))
    await user.click(screen.getByRole('option', { name: 'Store' }))
    expect(
      await screen.findByText('Order or warehouse planning availability could not be loaded.'),
    ).toBeTruthy()
    expect(quantity().disabled).toBe(true)
    planningFailure = false
    await user.click(screen.getByRole('button', { name: 'Retry loading' }))
    await waitFor(() => expect(quantity().disabled).toBe(false))
    expect(creates()).toHaveLength(0)
  })

  it('supports searchable Sales Order selection and hides inactive warehouses', async () => {
    const user = userEvent.setup()
    mount(0)
    await user.click(await screen.findByRole('button', { name: 'Sales Order to Fulfill' }))
    expect(screen.queryByRole('menuitem', { name: /SO-0003|SO-0004/ })).toBeNull()
    await user.type(screen.getByRole('searchbox', { name: 'Search order or customer...' }), '0002')
    await user.click(screen.getByRole('menuitem', { name: /SO-0002/ }))
    await waitFor(() => expect(screen.getByRole('spinbutton').id).toBe('delivery-quantity-20'))
    await user.click(screen.getByRole('combobox', { name: /Stock Source/ }))
    expect(screen.queryByRole('option', { name: 'Inactive' })).toBeNull()
  })

  it('guards duplicate submissions and dismissal while saving a header', async () => {
    const user = userEvent.setup()
    const { close } = mount()
    await selectWarehouse(user)
    await user.type(quantity(), '3')
    let release!: () => void
    gate = {
      url: '/outgoing-deliveries',
      wait: new Promise((resolve) => {
        release = resolve
      }),
    }
    const submit = screen.getByRole('button', { name: 'Schedule Delivery' })
    fireEvent.click(submit)
    fireEvent.click(submit)
    await waitFor(() => expect(creates()).toHaveLength(1))
    await user.keyboard('{Escape}')
    expect(close).not.toHaveBeenCalled()
    await act(async () => {
      gate = undefined
      release()
    })
    expect(await screen.findByText('Delivery scheduled')).toBeTruthy()
    expect(creates()).toHaveLength(1)
  })

  it('distinguishes unavailable planning data from known zero stock', async () => {
    options[1] = []
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('combobox', { name: /Stock Source/ }))
    await user.click(screen.getByRole('option', { name: 'Store' }))
    expect(
      await screen.findByText('Planning availability is unavailable. Retry loading.'),
    ).toBeTruthy()
    expect(within(screen.getAllByRole('row')[1]).getAllByText('Unavailable')).toHaveLength(2)
  })

  it('validates combined product capacity using backend availability and scheduled plans', () => {
    currentOrder.items.push({ ...currentOrder.items[0], id: 11 })
    const errors = outgoingPlanningErrors(currentOrder, [option(10), option(11)], {
      10: '30',
      11: '30',
    })
    expect(Object.keys(errors)).toEqual(['quantity-10', 'quantity-11'])
    expect(
      outgoingPlanningErrors(
        currentOrder,
        [{ ...option(), maximumPlannableQuantity: '0' }],
        { 10: '1' },
        { 10: '2' },
      )['quantity-10'],
    ).toContain('Maximum plannable quantity is 0.00')
  })
})
