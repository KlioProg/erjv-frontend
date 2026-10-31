import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { MemoryRouter } from 'react-router'
import { apiClient } from '@/lib/api-client'
import { getAdapter } from 'axios'
import { DeliveriesHub } from './DeliveriesHub'
import { ScheduleDeliveryModal } from './ScheduleDeliveryModal'
import { outgoingPlanningErrors } from '@/features/logistics/outgoing-planning'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type {
  OutgoingDeliveryRecord,
  OutgoingPlanningOption,
} from '@/features/logistics/outgoing-deliveries.types'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 }, isAdmin: true, isManager: false, isStaff: false }),
}))

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
    runId: null,
    reconciledAt: null,
    reconciledByUserId: null,
    fulfillmentOutcome: null,
    hasDamage: false,
    hasMissing: false,
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
    readyQuantity: '20',
    availableQuantity: available,
    remainingToPlanQuantity: available === '60' ? '70' : '2',
    shortfallQuantity: '0',
    plannedQuantity: '5',
    maximumPlannableQuantity: available === '60' ? '70' : '2',
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
let failOutgoingList: boolean
let failListAfterSchedule: boolean
let refreshGate: Promise<void> | undefined
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
  failOutgoingList = false
  failListAfterSchedule = false
  refreshGate = undefined
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
      if (url === '/outgoing-deliveries' && deliveries.some((d) => d.status === 'READY'))
        await refreshGate
      if (url === '/outgoing-deliveries' && failOutgoingList)
        throw {
          isAxiosError: true,
          response: { status: 503, data: { message: 'Outgoing list unavailable' } },
        }
      if (url === '/outgoing-deliveries/planning-options') {
        if (planningFailure)
          throw {
            isAxiosError: true,
            response: { status: 503, data: { message: 'Planning unavailable' } },
          }
        data = options[Number(config.params.warehouseId)] ?? []
      } else {
        const collections: Record<string, unknown> = {
          '/incoming-deliveries': [],
          '/purchase-orders': [],
          '/suppliers': [],
          '/delivery-vehicles': [],
          '/employees': [],
          '/stock-items': [],
          '/sales-orders': orders,
          '/sales-orders/1': currentOrder,
          '/sales-orders/2': orders[1],
          '/outgoing-deliveries': deliveries,
          '/inventory-items': [
            { id: 1, name: 'Rice', variety: 'Premium', unit: 'sacks', isActive: true, ...dates },
            { id: 2, name: 'Banana', unit: 'kg', isActive: true, ...dates },
          ],
          '/clients': [{ id: 1, name: 'Harbor Hotel', isActive: true, ...dates }],
          '/warehouses/1': { id: 1, name: 'Store', isActive: true, ...dates },
          '/warehouses/2': { id: 2, name: 'Main Warehouse', isActive: true, ...dates },
          '/inventory-items/1': { id: 1, name: 'Rice', variety: 'Premium', unit: 'sacks', isActive: true, ...dates },
          '/inventory-items/2': { id: 2, name: 'Banana', unit: 'kg', isActive: true, ...dates },
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
    } else if (url.endsWith('/ready')) {
      const id = Number(url.split('/')[2])
      const saved = deliveries.find((delivery) => delivery.id === id)!
      expect(body).toEqual({ expectedRevision: saved.revision })
      data = { ...saved, status: 'READY', revision: saved.revision + 1 }
      if (failListAfterSchedule) failOutgoingList = true
      deliveries = deliveries.map((delivery) =>
        delivery.id === id ? (data as OutgoingDeliveryRecord) : delivery,
      )
    }
    if (method === 'get' && url === '/outgoing-deliveries' && config.params?.q === 'unmatched query') data = []
    if (method === 'get' && url === '/outgoing-deliveries' && config.params?.warehouseId) data = (data as OutgoingDeliveryRecord[]).filter(delivery => delivery.warehouseId === config.params.warehouseId)
    if (
      method === 'get' &&
      Array.isArray(data)
    )
      data = { items: data, nextCursor: null }
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
  await user.click(await screen.findByRole('button', { name: /Stock Source \/ Warehouse/ }))
  await user.click(await screen.findByRole('menuitem', { name }))
  await waitFor(() =>
    expect(
      (screen.getByRole('textbox', { name: 'Quantity to ship for Rice' }) as HTMLInputElement)
        .disabled,
    ).toBe(false),
  )
}
const quantity = () =>
  screen.getByRole('textbox', { name: 'Quantity to ship for Rice' }) as HTMLInputElement
const creates = () => requests.filter((request) => request.method === 'post')
const updates = () =>
  requests.filter((request) => request.method === 'patch' && request.url.endsWith('/draft'))
const schedules = () =>
  requests.filter((request) => request.method === 'patch' && request.url.endsWith('/ready'))

it('continues to explicit dispatch only after the user finishes scheduling', async () => {
  const onScheduled = vi.fn()
  const close = vi.fn()
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ScheduleDeliveryModal
        open
        preselectedOrderId={1}
        onClose={close}
        onScheduled={onScheduled}
      />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await selectWarehouse(user)
  await user.type(quantity(), '1')
  await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
  await screen.findByText('Delivery ready for a run')
  expect(onScheduled).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: 'Continue to Delivery Runs' }))
  expect(onScheduled).toHaveBeenCalledWith(expect.objectContaining({ id: 90 }))
  expect(close).not.toHaveBeenCalled()
  expect(requests.some((request) => request.url.endsWith('/dispatch'))).toBe(false)
})

describe('outgoing delivery warehouse planning', () => {
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

  it('saves only positive lines in a mixed draft without a departure date', async () => {
    currentOrder.items.push({ ...currentOrder.items[0], id: 11 }, { ...currentOrder.items[0], id: 12 })
    options[1].push(option(11), option(12))
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: /Stock Source/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Store' }))
    const inputs = await screen.findAllByRole('textbox')
    await waitFor(() => expect((inputs[0] as HTMLInputElement).disabled).toBe(false))
    await user.type(inputs[0], '1.25')
    await user.type(inputs[1], '0')
    expect(screen.queryByLabelText('Scheduled Date & Time')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
    expect(updates()[0].body).toEqual({ expectedRevision: 1, warehouseId: 1, notes: null, plannedItems: [{ salesOrderItemId: 10, plannedQuantity: '1.25' }] })
    expect(schedules()).toHaveLength(0)
  })
  it('uses balanced responsive selectors, one warehouse, current persisted lines, and blank quantity inputs', async () => {
    currentOrder.items[0].id = 11
    options[1] = [option(11)]
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    const sales = screen.getByRole('button', { name: 'Sales Order to Fulfill' })
    const warehouse = screen.getByRole('button', { name: /Stock Source \/ Warehouse/ })
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
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(screen.getByRole('button', { name: 'Stock Source / Warehouse' })).toBeTruthy()
    await user.type(quantity(), '21')
    expect(quantity().value).toBe('21')
    await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
    expect(await screen.findByText('Delivery ready for a run')).toBeTruthy()
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
    expect(await screen.findByText('Max 2 sacks')).toBeTruthy()
    expect(screen.getByText('2.00')).toBeTruthy()
    expect(quantity().getAttribute('aria-invalid')).toBe('true')
    await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
    expect(creates()).toHaveLength(0)
    await user.clear(quantity())
    await user.type(quantity(), '1.25')
    await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
    expect(await screen.findByText('Delivery ready for a run')).toBeTruthy()
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
    await user.click(screen.getByRole('button', { name: /Stock Source/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Main Warehouse' }))
    expect(screen.queryByRole('textbox', { name: 'Quantity to ship for Rice' })).toBeNull()
    expect(screen.queryByText('60.00')).toBeNull()
    await act(async () => {
      gate = undefined
      release()
    })
    await waitFor(() => expect(quantity().disabled).toBe(false))
    expect(quantity().value).toBe('4')
  })

  it('restores saved draft quantities, notes, warehouse and revision and updates the same identity', async () => {
    deliveries = [
      {
        ...shipment(),
        revision: 7,
        warehouseId: 1,
        notes: 'Saved instructions',
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
    await waitFor(() => expect(quantity().value).toBe('1.25'))
    await waitFor(() => expect(quantity().disabled).toBe(false))
    expect(screen.getByText('Saved instructions')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
    expect(await screen.findByText('Delivery ready for a run')).toBeTruthy()
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
    await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
    expect(
      await screen.findByText(
        'Enter a positive planned quantity for at least one product before marking ready.',
      ),
    ).toBeTruthy()
    expect(creates()).toHaveLength(0)
    await user.type(quantity(), '0')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Delivery draft saved')).toBeTruthy()
    expect(updates()[0].body.plannedItems).toEqual([])
    expect(schedules()).toHaveLength(0)
  })

  it.each(['-1', '1.234', 'abc', '71'])(
    'rejects an invalid planning quantity %s',
    async (value) => {
      const user = userEvent.setup()
      mount()
      await selectWarehouse(user)
      fireEvent.change(quantity(), { target: { value } })
      await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
      await waitFor(() => expect(quantity().getAttribute('aria-invalid')).toBe('true'))
      expect(quantity().value).toBe(value)
      expect(creates()).toHaveLength(0)
    },
  )

  it('keeps valid planning rows compact and clears conditional maximum feedback after correction', async () => {
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    const input = quantity()
    const hint = document.getElementById(input.getAttribute('aria-describedby')!)!
    expect(hint.className).toBe('sr-only')
    expect(input.title).toMatch(/Maximum planned quantity:/)
    fireEvent.change(input, { target: { value: '999' } })
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(document.getElementById('delivery-quantity-10-error')?.textContent).toMatch(/^Max /)
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(updates()).toHaveLength(0)
    fireEvent.change(input, { target: { value: '1.25' } })
    expect(input.getAttribute('aria-invalid')).toBe('false')
    expect(document.getElementById('delivery-quantity-10-error')).toBeNull()
    expect(input.value).toBe('1.25')
  })

  it('disables an empty planning line with no backend capacity and retains its accessible explanation', async () => {
    options[1][0].maximumPlannableQuantity = '0.00'
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: /Stock Source/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Store' }))
    await waitFor(() => expect(quantity().title).toBe('No planning capacity in this warehouse.'))
    expect(quantity().disabled).toBe(true)
    expect(quantity().title).toBe('No planning capacity in this warehouse.')
    expect(screen.getByRole('button', { name: 'Mark Ready' }).hasAttribute('disabled')).toBe(
      true,
    )
    expect(creates()).toHaveLength(0)
  })

  it('preserves input when scheduling fails and retries the same saved draft without another create', async () => {
    conflict = { url: '/outgoing-deliveries/90/ready', message: 'Schedule unavailable' }
    const user = userEvent.setup()
    mount()
    await selectWarehouse(user)
    await user.type(quantity(), '1.25')
    await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
    expect(await screen.findByText('Schedule unavailable.')).toBeTruthy()
    expect(quantity().value).toBe('1.25')
    await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
    expect(await screen.findByText('Delivery ready for a run')).toBeTruthy()
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
    await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
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

  it.each(['ORDER_CAPACITY_CHANGED', 'PLAN_LIMIT_EXCEEDED'])(
    'uses the current maximum from %s and keeps unsaved input',
    async (code) => {
      conflict = {
        url: '/outgoing-deliveries/90/ready',
        code,
        message: 'Capacity changed',
        details: [{ salesOrderItemId: 10, currentMaximumQuantity: '1.00' }],
      }
      const user = userEvent.setup()
      mount()
      await selectWarehouse(user)
      await user.type(quantity(), '3')
      await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
      expect(await screen.findByText('Max 1 sacks')).toBeTruthy()
      expect(quantity().value).toBe('3')
      await user.clear(quantity())
      await user.type(quantity(), '1')
      await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
      expect(await screen.findByText('Delivery ready for a run')).toBeTruthy()
      expect(creates()).toHaveLength(1)
    },
  )

  it('requires review after INVALID_DELIVERY_STATE and blocks editing a scheduled record', async () => {
    deliveries = [{ ...shipment(), revision: 7, warehouseId: 1 }]
    const user = userEvent.setup()
    mount(undefined, 90)
    await waitFor(() => expect(quantity().disabled).toBe(false))
    deliveries[0].status = 'READY'
    conflict = {
      url: '/outgoing-deliveries/90/draft',
      code: 'INVALID_DELIVERY_STATE',
      message: 'State changed',
    }
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await user.click(await screen.findByRole('button', { name: 'Load latest draft' }))
    expect(
      await screen.findByText('This delivery is ready and cannot be edited here.'),
    ).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Mark Ready' }) as HTMLButtonElement).disabled,
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
    await user.click(await screen.findByRole('button', { name: /Stock Source/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Store' }))
    expect(
      await screen.findByText('Order or warehouse planning availability could not be loaded.'),
    ).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Quantity to ship for Rice' })).toBeNull()
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
    expect(screen.queryByRole('textbox')).toBeNull()
    await user.click(screen.getByRole('button', { name: /Stock Source/ }))
    expect(screen.queryByRole('menuitem', { name: 'Inactive' })).toBeNull()
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
    const submit = screen.getByRole('button', { name: 'Mark Ready' })
    fireEvent.click(submit)
    fireEvent.click(submit)
    await waitFor(() => expect(creates()).toHaveLength(1))
    await user.keyboard('{Escape}')
    expect(close).not.toHaveBeenCalled()
    await act(async () => {
      gate = undefined
      release()
    })
    expect(await screen.findByText('Delivery ready for a run')).toBeTruthy()
    expect(creates()).toHaveLength(1)
  })

  it('distinguishes unavailable planning data from known zero stock', async () => {
    options[1] = []
    const user = userEvent.setup()
    mount()
    await user.click(await screen.findByRole('button', { name: /Stock Source/ }))
    await user.click(screen.getByRole('menuitem', { name: 'Store' }))
    expect(
      await screen.findByText(
        'Some planning quantities are unavailable. Reload availability before planning those products.',
      ),
    ).toBeTruthy()
    expect(screen.queryByRole('textbox', { name: 'Quantity to ship for Rice' })).toBeNull()
    expect(
      screen.queryByText('All quantities for this Sales Order are already planned.'),
    ).toBeNull()
  })

  it('allows READY stock shortfalls while still enforcing each backend order maximum', () => {
    currentOrder.items.push({ ...currentOrder.items[0], id: 11 })
    const errors = outgoingPlanningErrors(currentOrder, [option(10), option(11)], { 10: '60', 11: '60' })
    expect(errors).toEqual({})
    expect(outgoingPlanningErrors(currentOrder, [{ ...option(), maximumPlannableQuantity: '0' }], { 10: '1' }, { 10: '2' })['quantity-10']).toContain('Maximum plannable quantity is 0.00')
  })
})

it('hides only known exhausted lines in a new plan while preserving positive quantities and units', async () => {
  currentOrder.items.push({ ...currentOrder.items[0], id: 12, inventoryItemId: 2 })
  options[1] = [
    {
      ...option(),
      committedQuantity: '80',
      readyQuantity: '20',
      maximumPlannableQuantity: '0',
      remainingToPlanQuantity: '0',
    },
    {
      ...option(12),
      inventoryItemId: 2,
      committedQuantity: '99.99',
      readyQuantity: '0',
      maximumPlannableQuantity: '0.01',
      remainingToPlanQuantity: '0.01',
    },
  ]
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /Stock Source/ }))
  await user.click(screen.getByRole('menuitem', { name: 'Store' }))
  const input = await screen.findByRole('textbox', { name: 'Quantity to ship for Banana' })
  expect(screen.queryByRole('textbox', { name: 'Quantity to ship for Rice' })).toBeNull()
  await user.type(input, '0.01')
  await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
  await screen.findByText('Delivery ready for a run')
  expect(updates()[0].body.plannedItems).toEqual([
    { salesOrderItemId: 12, plannedQuantity: '0.01' },
  ])
})

it('explains a fully planned order, retains its selection, and creates no empty draft', async () => {
  options[1] = [
    {
      ...option(),
      committedQuantity: '80',
      readyQuantity: '20',
      maximumPlannableQuantity: '0',
      remainingToPlanQuantity: '0',
    },
  ]
  mount()
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: /Stock Source/ }))
  await user.click(screen.getByRole('menuitem', { name: 'Store' }))
  await screen.findByText('All quantities for this Sales Order are already planned.')
  expect(screen.getByRole('button', { name: 'Sales Order to Fulfill' }).textContent).toContain(
    'SO-0001',
  )
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByRole('button', { name: 'Save Draft' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Mark Ready' }).hasAttribute('disabled')).toBe(
    true,
  )
  fireEvent.submit(screen.getByRole('button', { name: 'Mark Ready' }).closest('form')!)
  await waitFor(() =>
    expect(requests.filter((r) => r.url.endsWith('planning-options')).length).toBeGreaterThan(1),
  )
  expect(creates()).toHaveLength(0)
})

it('retains saved draft lines and values even when additional order planning capacity is zero', async () => {
  options[1] = [
    {
      ...option(),
      committedQuantity: '80',
      readyQuantity: '20',
      maximumPlannableQuantity: '0',
      remainingToPlanQuantity: '0',
    },
  ]
  deliveries = [
    {
      ...shipment(),
      warehouseId: 1,
      notes: 'Keep this draft',
      plannedItems: [
        { id: 1, outgoingDeliveryId: 90, salesOrderItemId: 10, plannedQuantity: '1.25', ...dates },
      ],
    },
  ]
  mount(undefined, 90)
  await waitFor(() => expect(quantity().value).toBe('1.25'))
  expect(screen.queryByText('All quantities for this Sales Order are already planned.')).toBeNull()
  expect(screen.getByText('Keep this draft')).toBeTruthy()
  expect(creates()).toHaveLength(0)
})

function mountHub(salesOrderId?: number) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter><DeliveriesHub initialTab="outgoing" salesOrderId={salesOrderId} /></MemoryRouter>
    </QueryClientProvider>,
  )
  return client
}
async function scheduleFromHub(user: ReturnType<typeof userEvent.setup>) {
  const open = await screen.findByRole('button', { name: 'Plan Outgoing' })
  await waitFor(() => expect(open.hasAttribute('disabled')).toBe(false))
  await user.click(open)
  return screen.findByRole('button', { name: 'Sales Order to Fulfill' })
}
async function finishHubSchedule(user: ReturnType<typeof userEvent.setup>) {
  await selectWarehouse(user)
  await user.type(quantity(), '1.25')
  await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
  await screen.findByText('Delivery ready for a run')
  await user.click(screen.getByRole('button', { name: 'Done' }))
}

it('refreshes the active list, seeds the scheduled detail, and changes a conflicting old order scope to the actual saved order', async () => {
  options[1] = [option(20)]
  const client = mountHub(1)
  const user = userEvent.setup()
  const selector = await scheduleFromHub(user)
  await user.click(selector)
  await user.click(screen.getByRole('menuitem', { name: /SO-0002/ }))
  await finishHubSchedule(user)
  expect(await screen.findByRole('button', { name: 'View delivery OD-90' })).toBeTruthy()
  expect(screen.getByText(/Outgoing deliveries for SO-0002/)).toBeTruthy()
  expect(client.getQueryData(['outgoing-deliveries', 'id', 90])).toMatchObject({
    id: 90,
    salesOrderId: 2,
    status: 'READY',
  })
  expect(schedules()).toHaveLength(1)
  expect(screen.getAllByRole('button', { name: 'View delivery OD-90' })).toHaveLength(1)
})

it('explains a saved delivery hidden by search and exposes its details without rescheduling', async () => {
  mountHub()
  const user = userEvent.setup()
  const search = await screen.findByRole('textbox', { name: 'Search deliveries' })
  await user.type(search, 'unmatched query')
  const selector = await scheduleFromHub(user)
  await user.click(selector)
  await user.click(screen.getByRole('menuitem', { name: /SO-0001/ }))
  await finishHubSchedule(user)
  expect(screen.getByText(/Current filters hide this delivery/)).toBeTruthy()
  expect(screen.getByText('No deliveries match the current filters.')).toBeTruthy()
  expect((search as HTMLInputElement).value).toBe('unmatched query')
  await user.click(screen.getByRole('button', { name: 'View New Delivery' }))
  expect(await screen.findByRole('heading', { name: 'OD-90' })).toBeTruthy()
  expect(creates()).toHaveLength(1)
  expect(schedules()).toHaveLength(1)
})

it('keeps confirmed scheduling success separate from a list refresh failure and recovers without duplicate writes', async () => {
  failListAfterSchedule = true
  mountHub(1)
  const user = userEvent.setup()
  await scheduleFromHub(user)
  await finishHubSchedule(user)
  expect(screen.getByText(/The list could not be refreshed. Do not schedule it again/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'View New Delivery' })).toBeTruthy()
  failOutgoingList = false
  await user.click(screen.getByRole('button', { name: 'Retry' }))
  expect(await screen.findByRole('button', { name: 'View delivery OD-90' })).toBeTruthy()
  expect(creates()).toHaveLength(1)
  expect(schedules()).toHaveLength(1)
})

it.each(['status', 'warehouse', 'date'])(
  'preserves a conflicting %s filter until Show in List is requested',
  async (filter) => {
    mountHub(1)
    const user = userEvent.setup()
    await screen.findByRole('button', { name: 'Plan Outgoing' })
    if (filter === 'status') {
      await user.click(screen.getByRole('combobox', { name: 'Status' }))
      await user.click(screen.getByRole('option', { name: 'Draft' }))
    } else if (filter === 'warehouse') {
      await user.click(screen.getByRole('combobox', { name: 'Warehouse' }))
      await user.click(screen.getByRole('option', { name: 'Main Warehouse' }))
    } else fireEvent.change(screen.getByLabelText('To Date'), { target: { value: '2020-01-01' } })
    await scheduleFromHub(user)
    await finishHubSchedule(user)
    expect(screen.getByText(/Current filters hide this delivery/)).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Show in List' }))
    expect(await screen.findByRole('button', { name: 'View delivery OD-90' })).toBeTruthy()
    expect(schedules()).toHaveLength(1)
  },
)

it('waits for the active outgoing list refresh while preventing another schedule submission', async () => {
  mountHub(1)
  const user = userEvent.setup()
  await scheduleFromHub(user)
  await selectWarehouse(user)
  await user.type(quantity(), '1.25')
  let release!: () => void
  refreshGate = new Promise<void>((resolve) => {
    release = resolve
  })
  await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
  await waitFor(() => expect(schedules()).toHaveLength(1))
  expect(screen.queryByText('Delivery ready for a run')).toBeNull()
  const busy = screen.getByRole('button', { name: 'Marking ready...' })
  expect(busy.hasAttribute('disabled')).toBe(true)
  fireEvent.submit(busy.closest('form')!)
  await act(async () => {
    refreshGate = undefined
    release()
  })
  await screen.findByText('Delivery ready for a run')
  await user.click(screen.getByRole('button', { name: 'Done' }))
  expect(await screen.findByRole('button', { name: 'View delivery OD-90' })).toBeTruthy()
  expect(schedules()).toHaveLength(1)
})

it('retains unsaved counts until explicitly clearing a line that became fully planned', async () => {
  currentOrder.items.push({ ...currentOrder.items[0], id: 12, inventoryItemId: 2 })
  options[1].push({ ...option(12), inventoryItemId: 2 })
  const { queryClient } = mount()
  const user = userEvent.setup()
  await selectWarehouse(user)
  await user.type(quantity(), '1')
  await user.type(screen.getByRole('textbox', { name: 'Quantity to ship for Banana' }), '1.25')
  options[1][0] = {
    ...option(),
    committedQuantity: '80',
    readyQuantity: '20',
    maximumPlannableQuantity: '0',
      remainingToPlanQuantity: '0',
  }
  await act(async () => {
    await queryClient.invalidateQueries({ queryKey: ['outgoing-deliveries', 'planning-options'] })
  })
  await waitFor(() =>
    expect(screen.queryByRole('textbox', { name: 'Quantity to ship for Rice' })).toBeNull(),
  )
  expect(screen.getByText(/Some entered quantities are no longer available/)).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Clear quantities no longer available' }))
  await user.click(screen.getByRole('button', { name: 'Mark Ready' }))
  await screen.findByText('Delivery ready for a run')
  expect(updates()[0].body.plannedItems).toEqual([
    { salesOrderItemId: 12, plannedQuantity: '1.25' },
  ])
})

it('loads later order and warehouse pages, searches on the server, and validates the saved selection by ID', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  const lookupReads: { url: string; params: Record<string, unknown> }[] = []
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'get' && ['/sales-orders', '/warehouses'].includes(config.url ?? '')) {
      const url = config.url!
      const params = config.params ?? {}
      lookupReads.push({ url, params })
      const data = url === '/sales-orders'
        ? params.q ? { items: [order(2)], nextCursor: null }
          : params.cursor ? { items: [order(1)], nextCursor: null } : { items: [order(2)], nextCursor: 'orders-next' }
        : params.cursor ? { items: [{ id: 1, name: 'Store', isActive: true }], nextCursor: null }
          : { items: [{ id: 2, name: 'Main Warehouse', isActive: true }], nextCursor: 'warehouses-next' }
      return { config, data, status: 200, statusText: 'OK', headers: {} }
    }
    return adapter(config)
  }
  const user = userEvent.setup()
  mount(0)
  await user.click(screen.getByRole('button', { name: 'Sales Order to Fulfill' }))
  await user.click(await screen.findByRole('button', { name: 'Load more results' }))
  await user.click(await screen.findByRole('menuitem', { name: /SO-0001/ }))
  await user.click(screen.getByRole('button', { name: 'Sales Order to Fulfill' }))
  await user.type(screen.getByRole('searchbox', { name: 'Search order or customer...' }), '0002')
  await screen.findByRole('menuitem', { name: /SO-0002/ })
  await user.keyboard('{Escape}')
  expect(screen.getByRole('button', { name: 'Sales Order to Fulfill' }).textContent).toContain('SO-0001')
  await user.click(screen.getByRole('button', { name: 'Stock Source / Warehouse' }))
  await user.click(await screen.findByRole('button', { name: 'Load more results' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Store' }))
  await waitFor(() => expect(quantity().disabled).toBe(false))
  await user.type(quantity(), '1.25')
  await user.click(screen.getByRole('button', { name: 'Save Draft' }))
  await screen.findByText('Delivery draft saved')
  expect(updates()[0].body.warehouseId).toBe(1)
  expect(lookupReads.some(({ url, params }) => url === '/sales-orders' && params.cursor === 'orders-next')).toBe(true)
  expect(lookupReads.some(({ url, params }) => url === '/sales-orders' && params.q === '0002')).toBe(true)
  expect(lookupReads.filter(({ url }) => url === '/sales-orders').every(({ params }) => JSON.stringify(params.statuses) === JSON.stringify(['CONFIRMED', 'PARTIALLY_DELIVERED']))).toBe(true)
  expect(lookupReads.filter(({ url }) => url === '/warehouses').every(({ params }) => params.includeInactive === 'false')).toBe(true)
})
