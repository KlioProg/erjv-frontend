import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { OrdersView } from '@/components/orders/OrdersView'
import { PurchasesView } from '@/components/purchases/PurchasesView'
import { MainDashboard } from '@/components/dashboard/MainDashboard'
import { DeliveryNavigation } from '@/components/layout/DeliveryNavigation'
import { DeliveriesHub } from './DeliveriesHub'
import { ScheduleDeliveryModal } from './ScheduleDeliveryModal'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { ReactNode } from 'react'
import { toast } from 'sonner'

const auth = vi.hoisted(() => ({
  isAdmin: true,
  isManager: false,
  isStaff: false,
  user: { fullName: 'Test Employee' },
}))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))

// Test-only HTTP adapter: real services, query hooks, mutations and UI run together.
const stamps = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }
const line = {
  lineNumber: 1,
  inventoryItemId: 1,
  quantity: '1.25',
  unitPrice: '20.00',
  discountRate: '0.00',
  discountAmount: '0.00',
  taxRate: '0.00',
  taxAmount: '0.00',
  subtotalAmount: '25.00',
  taxableAmount: '25.00',
  totalAmount: '25.00',
  notes: null,
  ...stamps,
}
const orderDates = {
  orderedAt: stamps.createdAt,
  expectedAt: '2026-10-11T00:00:00Z',
  confirmedAt: null,
  completedAt: null,
  cancelledAt: null,
  externalReference: null,
  notes: null,
  ...stamps,
}
const salesFixture: SalesOrderRecord = {
  id: 1,
  orderNumber: 'SO-TEST',
  status: 'DRAFT',
  clientId: 1,
  deliveryAddress: 'Test Address',
  ...orderDates,
  items: [
    {
      ...line,
      id: 10,
      salesOrderId: 1,
      allocations: [
        {
          id: 11,
          salesOrderItemId: 10,
          stockItemId: 1,
          quantity: '1.25',
          releasedAt: null,
          ...stamps,
        },
      ],
    },
  ],
}
const purchaseFixture: PurchaseOrderRecord = {
  id: 2,
  orderNumber: 'PO-TEST',
  status: 'DRAFT',
  supplierId: 2,
  ...orderDates,
  items: [{ ...line, id: 20, purchaseOrderId: 2 }],
}
const incomingFixture = (
  id: number,
  status: IncomingDeliveryRecord['status'],
): IncomingDeliveryRecord => ({
  id,
  deliveryNumber: `IN-${id}`,
  purchaseOrderId: 2,
  warehouseId: 1,
  status,
  scheduledAt: '2026-10-11T14:30:00',
  completedAt: null,
  cancelledAt: null,
  supplierReference: null,
  notes: null,
  ...stamps,
  items: [
    {
      id: id * 10,
      incomingDeliveryId: id,
      purchaseOrderItemId: 20,
      receivedQuantity: '0.20',
      ...stamps,
    },
  ],
})
const outgoingFixture = (
  id: number,
  status: OutgoingDeliveryRecord['status'],
): OutgoingDeliveryRecord => ({
  id,
  deliveryNumber: `OUT-${id}`,
  salesOrderId: 1,
  warehouseId: 1,
  status,
  deliveryVehicleId: null,
  driverEmployeeId: null,
  scheduledAt: '2026-10-11T14:30:00',
  dispatchedAt: null,
  deliveredAt: null,
  cancelledAt: null,
  notes: null,
  ...stamps,
  items: [
    {
      id: id * 10,
      outgoingDeliveryId: id,
      salesOrderAllocationId: 11,
      quantity: '0.50',
      salesOrderAllocation: { stockItemId: 1, salesOrderItemId: 10, quantity: '1.25' },
      ...stamps,
    },
  ],
})

let sales: SalesOrderRecord[]
let purchases: PurchaseOrderRecord[]
let incoming: IncomingDeliveryRecord[]
let outgoing: OutgoingDeliveryRecord[]
let failSchedule: boolean
let failConfirmation: boolean
let failCreation: boolean
let failCancellation: boolean
let requestGate: { url: string; wait: Promise<void> } | undefined
let failReceipt: boolean
let requests: { method: string; url: string; body: Record<string, unknown> }[]
const originalAdapter = apiClient.defaults.adapter

function mount(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return {
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
    queryClient,
  }
}

beforeEach(() => {
  vi.spyOn(toast, 'success').mockReturnValue('test-success')
  auth.isAdmin = true
  auth.isStaff = false
  sales = structuredClone([salesFixture])
  purchases = structuredClone([purchaseFixture])
  incoming = [
    incomingFixture(21, 'DRAFT'),
    incomingFixture(22, 'SCHEDULED'),
    incomingFixture(23, 'COMPLETED'),
    incomingFixture(24, 'CANCELLED'),
  ]
  outgoing = [
    outgoingFixture(5, 'DRAFT'),
    outgoingFixture(6, 'SCHEDULED'),
    outgoingFixture(7, 'DELIVERED'),
    outgoingFixture(8, 'CANCELLED'),
  ]
  failSchedule = false
  failConfirmation = false
  failCreation = false
  failCancellation = false
  requestGate = undefined
  failReceipt = false
  requests = []
  apiClient.defaults.adapter = async (config) => {
    const url = config.url || ''
    const method = config.method || 'get'
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data || {}
    requests.push({ method, url, body })
    if (method !== 'get' && requestGate?.url === url) await requestGate.wait
    let data: unknown = []
    if (method === 'get') {
      const collections: Record<string, unknown> = {
        '/sales-orders': sales,
        '/purchase-orders': purchases,
        '/incoming-deliveries': incoming,
        '/outgoing-deliveries': outgoing,
        '/inventory-items': [
          {
            id: 1,
            name: 'Test Mango',
            unit: 'kg',
            variety: 'Carabao',
            description: null,
            unitPrice: 100,
            isActive: true,
            ...stamps,
          },
        ],
        '/warehouses': [
          {
            id: 1,
            name: 'Test Warehouse',
            address: '',
            contactNumber: null,
            isActive: true,
            ...stamps,
          },
        ],
        '/stock-items': [
          {
            id: 1,
            warehouseId: 1,
            inventoryItemId: 1,
            quantity: '20.00',
            reservedQuantity: '1.25',
            ...stamps,
          },
        ],
        '/clients': [
          { id: 1, name: 'Test Customer', address: 'Test Address', isActive: true, ...stamps },
        ],
        '/suppliers': [
          { id: 2, code: 'SUP-TEST', name: 'Test Supplier', isActive: true, ...stamps },
        ],
      }
      data =
        collections[url] ??
        incoming.find((item) => url === `/incoming-deliveries/${item.id}`) ??
        outgoing.find((item) => url === `/outgoing-deliveries/${item.id}`) ??
        []
    } else if (method === 'post' && (url === '/sales-orders' || url === '/purchase-orders')) {
      if (failCreation)
        throw { isAxiosError: true, response: { status: 422, data: { message: 'Create failed' } } }
      if (url === '/sales-orders') {
        const order = {
          ...structuredClone(salesFixture),
          ...body,
          id: 91,
          orderNumber: 'SO-NEW',
          status: 'DRAFT',
        } as SalesOrderRecord
        sales.push(order)
        data = order
      } else {
        const order = {
          ...structuredClone(purchaseFixture),
          ...body,
          id: 92,
          orderNumber: 'PO-NEW',
          status: 'DRAFT',
        } as PurchaseOrderRecord
        purchases.push(order)
        data = order
      }
    } else if (url.endsWith('/confirm')) {
      if (failConfirmation)
        throw { isAxiosError: true, response: { status: 409, data: { message: 'Confirm failed' } } }
      const id = Number(url.split('/')[2])
      if (url.startsWith('/sales-orders')) {
        sales = sales.map((order) => (order.id === id ? { ...order, status: 'CONFIRMED' } : order))
        data = sales.find((order) => order.id === id)
      } else {
        purchases = purchases.map((order) =>
          order.id === id ? { ...order, status: 'CONFIRMED' } : order,
        )
        data = purchases.find((order) => order.id === id)
      }
    } else if (method === 'post' && url === '/outgoing-deliveries') {
      data = { ...outgoingFixture(90, 'DRAFT'), ...body }
      outgoing = [...outgoing, data as OutgoingDeliveryRecord]
    } else if (method === 'post' && url === '/incoming-deliveries') {
      data = { ...incomingFixture(91, 'DRAFT'), ...body }
      incoming = [...incoming, data as IncomingDeliveryRecord]
    } else if (url.endsWith('/schedule')) {
      if (failSchedule) {
        failSchedule = false
        throw {
          isAxiosError: true,
          response: { status: 409, data: { message: 'Schedule retry required' } },
        }
      }
      const id = Number(url.split('/')[2])
      if (url.startsWith('/outgoing')) {
        outgoing = outgoing.map((delivery) =>
          delivery.id === id ? { ...delivery, status: 'SCHEDULED' } : delivery,
        )
        data = outgoing.find((delivery) => delivery.id === id)
      } else {
        incoming = incoming.map((delivery) =>
          delivery.id === id ? { ...delivery, status: 'SCHEDULED' } : delivery,
        )
        data = incoming.find((delivery) => delivery.id === id)
      }
    } else if (url.startsWith('/sales-orders/') && url.endsWith('/cancel')) {
      if (failCancellation)
        throw {
          isAxiosError: true,
          response: { status: 409, data: { message: 'Cancellation failed' } },
        }
      const id = Number(url.split('/')[2])
      sales = sales.map((order) => (order.id === id ? { ...order, status: 'CANCELLED' } : order))
      data = sales.find((order) => order.id === id)
    } else if (url.endsWith('/complete')) {
      if (failReceipt) {
        failReceipt = false
        throw {
          isAxiosError: true,
          response: { status: 409, data: { message: 'Receipt retry required' } },
        }
      }
      incoming = incoming.map((delivery) =>
        delivery.id === 22 ? { ...delivery, status: 'COMPLETED' } : delivery,
      )
      data = incoming.find((delivery) => delivery.id === 22)
    }
    return { data, config, headers: {}, status: 200, statusText: 'OK' }
  }
})
afterEach(() => {
  vi.restoreAllMocks()
  apiClient.defaults.adapter = originalAdapter
})

const mutations = () => requests.filter((request) => request.method !== 'get')

describe.each(['Sales', 'Purchase'])('%s composer confirmation', (kind) => {
  const salesOrder = kind === 'Sales'
  const endpoint = salesOrder ? '/sales-orders' : '/purchase-orders'
  const savedId = salesOrder ? 91 : 92
  const confirmUrl = `${endpoint}/${savedId}/confirm`

  async function fillComposer() {
    const user = userEvent.setup()
    const navigate = vi.fn()
    mount(
      salesOrder ? (
        <OrdersView onNavigateToDeliveries={navigate} />
      ) : (
        <PurchasesView onNavigateToDeliveries={navigate} />
      ),
    )
    await user.click(await screen.findByRole('button', { name: `Create ${kind} Order` }))
    await user.click(
      screen.getByRole('button', {
        name: salesOrder ? 'Search and choose a customer' : 'Search and choose a supplier',
      }),
    )
    await user.click(
      await screen.findByRole('menuitem', {
        name: salesOrder ? 'Test Customer' : 'Test Supplier (SUP-TEST)',
      }),
    )
    await user.click(await screen.findByRole('button', { name: 'Add Test Mango' }))
    if (salesOrder) {
      await user.click(screen.getByRole('button', { name: 'Stock source for Test Mango' }))
      await user.click(screen.getByRole('combobox', { name: 'Warehouse source 1 for Test Mango' }))
      await user.click(screen.getByRole('option', { name: /Test Warehouse/ }))
      await user.click(screen.getByRole('button', { name: 'Done' }))
    } else {
      await user.type(screen.getByRole('textbox', { name: 'Unit cost for Test Mango' }), '12.34')
    }
    await user.click(screen.getByText('Additional details'))
    await user.type(screen.getByLabelText('Notes'), 'Keep these details')
    return { user, navigate }
  }

  it('saves a draft without confirming or preparing a delivery', async () => {
    const { user, navigate } = await fillComposer()
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mutations().map(({ method, url }) => ({ method, url }))).toEqual([
      { method: 'post', url: endpoint },
    ])
    expect((salesOrder ? sales : purchases).find((order) => order.id === savedId)?.status).toBe(
      'DRAFT',
    )
    expect(navigate).not.toHaveBeenCalled()
  })

  it('creates and confirms the saved ID, shows one notification and opens deliveries only on request', async () => {
    const { user, navigate } = await fillComposer()
    await user.click(screen.getByRole('button', { name: 'Confirm Order' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(toast.success).toHaveBeenCalledWith(
      'Order confirmed',
      expect.objectContaining({ description: expect.stringContaining(kind) }),
    )
    expect(mutations().map(({ method, url }) => ({ method, url }))).toEqual([
      { method: 'post', url: endpoint },
      { method: 'patch', url: confirmUrl },
    ])
    expect(screen.queryByRole('button', { name: 'Prepare Later' })).toBeNull()
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(navigate).not.toHaveBeenCalled()
    const deliveries = screen.getByRole('button', {
      name: salesOrder ? 'Outgoing Deliveries' : 'Incoming Deliveries',
    })
    expect(deliveries.className).toContain('bg-primary')
    await user.click(deliveries)
    expect(navigate.mock.calls).toEqual([salesOrder ? ['outgoing', savedId] : [savedId]])
    expect(mutations()).toHaveLength(2)
  })

  it('retains editable data after failed creation and never calls confirm until creation succeeds', async () => {
    const { user } = await fillComposer()
    failCreation = true
    await user.click(screen.getByRole('button', { name: 'Confirm Order' }))
    expect(await screen.findByText('Create failed.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Retry Confirmation' })).toBeNull()
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Keep these details')
    expect(screen.getByLabelText('Notes').matches(':disabled')).toBe(false)
    expect(mutations()).toHaveLength(1)
    failCreation = false
    await user.click(screen.getByRole('button', { name: 'Confirm Order' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(toast.success).toHaveBeenCalledWith(
      'Order confirmed',
      expect.objectContaining({ description: expect.stringContaining(kind) }),
    )
    expect(mutations().filter((request) => request.url === confirmUrl)).toHaveLength(1)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the saved draft and retries confirmation without a second create', async () => {
    const { user, navigate } = await fillComposer()
    failConfirmation = true
    await user.click(screen.getByRole('button', { name: 'Confirm Order' }))
    const retry = await screen.findByRole('button', { name: 'Retry Confirmation' })
    expect(screen.getByRole('alert').textContent).toContain('Confirm failed.')
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Save Draft' })).toBeNull()
    expect((screen.getByLabelText('Notes') as HTMLTextAreaElement).value).toBe('Keep these details')
    expect(screen.getByLabelText('Notes').matches(':disabled')).toBe(true)
    expect(
      screen.getByRole('textbox', { name: 'Quantity for Test Mango' }).matches(':disabled'),
    ).toBe(true)
    expect(navigate).not.toHaveBeenCalled()
    failConfirmation = false
    await user.click(retry)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(toast.success).toHaveBeenCalledWith(
      'Order confirmed',
      expect.objectContaining({ description: expect.stringContaining(kind) }),
    )
    expect(mutations().map((request) => request.url)).toEqual([endpoint, confirmUrl, confirmUrl])
    expect(navigate).not.toHaveBeenCalled()
  })

  it('guards duplicate clicks and dismissal throughout creation and confirmation', async () => {
    const { user } = await fillComposer()
    let finishCreate!: () => void
    let finishConfirm!: () => void
    const confirmationWait = new Promise<void>((resolve) => {
      finishConfirm = resolve
    })
    requestGate = {
      url: endpoint,
      wait: new Promise<void>((resolve) => {
        finishCreate = resolve
      }),
    }
    const confirm = screen.getByRole('button', { name: 'Confirm Order' })
    const form = confirm.closest('form')!
    fireEvent.click(confirm)
    fireEvent.submit(form, { submitter: confirm })
    await waitFor(() => expect(mutations()).toHaveLength(1))
    expect(confirm.matches(':disabled')).toBe(true)
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeTruthy()
    requestGate = { url: confirmUrl, wait: confirmationWait }
    await act(async () => finishCreate())
    await screen.findByRole('button', { name: 'Confirming…' })
    fireEvent.submit(form, { submitter: confirm })
    expect(mutations().map((request) => request.url)).toEqual([endpoint, confirmUrl])
    expect(toast.success).not.toHaveBeenCalled()
    await act(async () => finishConfirm())
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(toast.success).toHaveBeenCalledWith(
      'Order confirmed',
      expect.objectContaining({ description: expect.stringContaining(kind) }),
    )
    expect(mutations()).toHaveLength(2)
  })
})

describe('order to delivery workflow', () => {
  it.each(['list', 'details'] as const)(
    'reviews sales cancellation from %s, supports dismiss and retains errors for retry',
    async (source) => {
      const user = userEvent.setup()
      const nativeConfirm = vi.spyOn(window, 'confirm')
      outgoing = []
      mount(<OrdersView />)
      async function openCancellation() {
        if (source === 'list') {
          await user.click(await screen.findByRole('button', { name: 'More actions for SO-TEST' }))
          await user.click(screen.getByRole('menuitem', { name: 'Cancel Order' }))
        } else {
          if (!screen.queryByRole('dialog')) {
            await user.click(
              await screen.findByRole('button', { name: 'More actions for SO-TEST' }),
            )
            await user.click(screen.getByRole('menuitem', { name: 'View Order' }))
          }
          await user.click(screen.getByRole('button', { name: 'Cancel Order' }))
        }
        return within(await screen.findByRole('dialog', { name: 'Cancel Sales Order' }))
      }
      let modal = await openCancellation()
      expect(modal.getByText('SO-TEST')).toBeTruthy()
      expect(modal.getByText(/Any reserved stock will be released/)).toBeTruthy()
      expect(mutations()).toHaveLength(0)
      await user.click(modal.getByRole('button', { name: 'Keep Order' }))
      expect(screen.queryByRole('dialog', { name: 'Cancel Sales Order' })).toBeNull()
      expect(mutations()).toHaveLength(0)
      modal = await openCancellation()
      failCancellation = true
      await user.click(modal.getByRole('button', { name: 'Cancel Order' }))
      expect(await modal.findByText('Cancellation failed.')).toBeTruthy()
      expect(sales[0].status).toBe('DRAFT')
      failCancellation = false
      let finish!: () => void
      requestGate = {
        url: '/sales-orders/1/cancel',
        wait: new Promise<void>((resolve) => {
          finish = resolve
        }),
      }
      const confirm = modal.getByRole('button', { name: 'Cancel Order' })
      fireEvent.click(confirm)
      fireEvent.click(confirm)
      await waitFor(() => expect(mutations()).toHaveLength(2))
      expect(modal.getByRole('button', { name: 'Processing...' }).matches(':disabled')).toBe(true)
      expect(modal.getByRole('button', { name: 'Keep Order' }).matches(':disabled')).toBe(true)
      await user.keyboard('{Escape}')
      expect(screen.getByRole('dialog', { name: 'Cancel Sales Order' })).toBeTruthy()
      await act(async () => finish())
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: 'Cancel Sales Order' })).toBeNull(),
      )
      expect(sales[0].status).toBe('CANCELLED')
      expect(mutations().map((request) => request.url)).toEqual([
        '/sales-orders/1/cancel',
        '/sales-orders/1/cancel',
      ])
      expect(nativeConfirm).not.toHaveBeenCalled()
      nativeConfirm.mockRestore()
    },
  )

  it('saves unfinished sales drafts without forcing a stock source', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    mount(<OrdersView onNavigateToDeliveries={navigate} />)
    await user.click(await screen.findByRole('button', { name: 'Create Sales Order' }))
    await user.click(screen.getByRole('button', { name: 'Search and choose a customer' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Test Customer' }))
    await user.click(await screen.findByRole('button', { name: 'Add Test Mango' }))
    expect(screen.queryByRole('combobox', { name: /Warehouse source/ })).toBeNull()
    expect(screen.queryByText('Warehouse source required')).toBeNull()
    const confirm = screen.getByRole('button', { name: 'Confirm Order' })
    expect(confirm.matches(':disabled')).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(mutations()).toHaveLength(1)
    expect(mutations()[0]).toMatchObject({
      method: 'post',
      url: '/sales-orders',
      body: {
        clientId: 1,
        deliveryAddress: 'Test Address',
        items: [
          {
            inventoryItemId: 1,
            quantity: '1',
            unitPrice: '100',
            discountRate: '0.00',
            taxRate: '12.00',
          },
        ],
      },
    })
    const item = (mutations()[0].body.items as Record<string, unknown>[])[0]
    expect('allocations' in item).toBe(false)
    expect('stockItemId' in item).toBe(false)
    expect('warehouseId' in item).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('supports keyboard collapse/expand and opens a newly selected sidebar child', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const { rerender } = render(<DeliveryNavigation view="incoming" onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'Incoming' }).getAttribute('aria-current')).toBe(
      'page',
    )
    await user.click(screen.getByRole('button', { name: 'Deliveries' }))
    expect(screen.queryByRole('button', { name: 'Incoming' })).toBeNull()
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('button', { name: 'Outgoing' }))
    expect(onSelect).toHaveBeenCalledWith('outgoing')
    await user.click(screen.getByRole('button', { name: 'Deliveries' }))
    rerender(<DeliveryNavigation view="history" onSelect={onSelect} />)
    expect(screen.getByRole('button', { name: 'History' }).getAttribute('aria-current')).toBe(
      'page',
    )
  })

  it('routes sidebar children to active direction tables and terminal history without page tabs', async () => {
    const user = userEvent.setup()
    mount(<MainDashboard />)
    const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }))
    await user.click(nav.getByRole('button', { name: 'Deliveries' }))
    await user.click(nav.getByRole('button', { name: 'Incoming' }))
    expect(await screen.findByRole('button', { name: 'View delivery IN-21' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'View delivery IN-23' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Type' })).toBeNull()
    expect(screen.queryByRole('tablist')).toBeNull()
    await user.click(nav.getByRole('button', { name: 'Outgoing' }))
    expect(await screen.findByRole('button', { name: 'Dispatch OUT-6' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'View delivery OUT-7' })).toBeNull()
    await user.click(nav.getByRole('button', { name: 'History' }))
    expect(await screen.findByRole('button', { name: 'View delivery IN-23' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View delivery OUT-7' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Cancel Delivery/ })).toBeNull()
    expect(screen.getAllByText('11 Oct 2026').length).toBe(4)
  })

  it('confirms from the sales list with notification only and no automatic delivery', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    mount(<OrdersView onNavigateToDeliveries={navigate} />)
    await user.click(await screen.findByRole('button', { name: 'Confirm' }))
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Order confirmed', expect.anything()),
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
    expect(requests.filter((request) => request.method === 'post')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /Edit Order/ })).toBeNull()
  })

  it('returns from sales details after confirmation and navigates to outgoing on request', async () => {
    outgoing = []
    const user = userEvent.setup()
    const navigate = vi.fn()
    mount(<OrdersView onNavigateToDeliveries={navigate} />)
    await user.click(await screen.findByRole('button', { name: 'More actions for SO-TEST' }))
    await user.click(screen.getByRole('menuitem', { name: 'View Order' }))
    await user.click(screen.getByRole('button', { name: 'Confirm Order & Reserve Stock' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(navigate).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Outgoing Deliveries' }))
    expect(navigate).toHaveBeenCalledWith('outgoing', 1)
    expect(requests.filter((request) => request.method === 'post')).toHaveLength(0)
  })

  it('retains purchase confirmation errors, then returns to the list with incoming navigation', async () => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    mount(<PurchasesView onNavigateToDeliveries={navigate} />)
    await user.click(await screen.findByRole('button', { name: 'View purchase order PO-TEST' }))
    failConfirmation = true
    await user.click(screen.getByRole('button', { name: 'Confirm Purchase Order' }))
    await waitFor(() =>
      expect(requests.some((request) => request.url === '/purchase-orders/2/confirm')).toBe(true),
    )
    expect(toast.success).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
    failConfirmation = false
    await user.click(screen.getByRole('button', { name: 'Confirm Purchase Order' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(navigate).not.toHaveBeenCalled()
    await user.click(await screen.findByRole('button', { name: 'Incoming Deliveries' }))
    expect(navigate).toHaveBeenCalledWith(2)
    expect(requests.filter((request) => request.method === 'post')).toHaveLength(0)
  })

  it.each(['CONFIRMED', 'PARTIALLY_RECEIVED'] as const)(
    'uses the same green incoming action for %s purchases',
    async (status) => {
      purchases[0].status = status
      const user = userEvent.setup()
      const navigate = vi.fn()
      mount(<PurchasesView onNavigateToDeliveries={navigate} />)
      const incomingButton = await screen.findByRole('button', { name: 'Incoming Deliveries' })
      expect(incomingButton.className).toContain('bg-primary')
      expect(incomingButton.className).toContain('h-8')
      expect(screen.queryByRole('button', { name: 'View Incoming' })).toBeNull()
      await user.click(incomingButton)
      expect(navigate).toHaveBeenCalledWith(2)
      expect(mutations()).toHaveLength(0)
      await user.click(screen.getByRole('button', { name: 'View purchase order PO-TEST' }))
      expect(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Incoming Deliveries' })
          .className,
      ).toContain('bg-primary')
    },
  )

  it('saves decimal outgoing quantities and retries the saved draft schedule without duplicate creation', async () => {
    sales[0].status = 'CONFIRMED'
    outgoing = [outgoingFixture(6, 'SCHEDULED'), outgoingFixture(8, 'CANCELLED')]
    failSchedule = true
    const user = userEvent.setup()
    const close = vi.fn()
    mount(<ScheduleDeliveryModal open preselectedOrderId={1} onClose={close} />)
    const quantity = await screen.findByRole('textbox', { name: 'Quantity to ship for Test Mango' })
    expect((quantity as HTMLInputElement).value).toBe('0.75')
    await user.click(screen.getByRole('combobox', { name: /Source Warehouse/ }))
    await user.click(screen.getByRole('option', { name: 'Test Warehouse' }))
    await user.click(screen.getByRole('button', { name: 'Schedule Delivery' }))
    expect(await screen.findByText('Schedule retry required.')).toBeTruthy()
    expect(close).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Retry Schedule' }))
    await user.click(await screen.findByRole('button', { name: 'Done' }))
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    const creates = requests.filter((request) => request.method === 'post')
    expect(creates).toHaveLength(1)
    expect(creates[0].body.items).toEqual([{ salesOrderAllocationId: 11, quantity: '0.75' }])
    expect(
      requests.filter((request) => request.url === '/outgoing-deliveries/90/schedule'),
    ).toHaveLength(2)
  })

  it('opens incoming arrangement with the correct PO and preserves a fractional receiving balance', async () => {
    purchases[0].status = 'CONFIRMED'
    purchases[0].items[0].quantity = '0.25'
    incoming = [incomingFixture(22, 'SCHEDULED'), incomingFixture(24, 'CANCELLED')]
    const user = userEvent.setup()
    mount(<DeliveriesHub initialTab="incoming" purchaseOrderId={2} arrangeOrder />)
    const quantity = await screen.findByRole('textbox', {
      name: 'Quantity to receive for Test Mango',
    })
    expect((quantity as HTMLInputElement).value).toBe('0.05')
    await user.click(screen.getByRole('combobox', { name: /Target Warehouse/ }))
    await user.click(screen.getByRole('option', { name: 'Test Warehouse' }))
    await user.click(screen.getByRole('button', { name: 'Schedule Incoming Delivery' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(requests.find((request) => request.method === 'post')?.body.items).toEqual([
      { purchaseOrderItemId: 20, receivedQuantity: '0.05' },
    ])
    expect(requests.some((request) => request.url.endsWith('/complete'))).toBe(false)
  })

  it('hides fully arranged purchases while retaining partial and cancelled shipment balances', async () => {
    purchases[0].status = 'CONFIRMED'
    purchases[0].items[0].quantity = '0.60'
    const partial = structuredClone(purchases[0])
    partial.id = 3
    partial.orderNumber = 'PO-PARTIAL'
    partial.status = 'PARTIALLY_RECEIVED'
    partial.items = [{ ...partial.items[0], id: 30, purchaseOrderId: 3, quantity: '0.25' }]
    const cancelled = structuredClone(partial)
    cancelled.id = 4
    cancelled.orderNumber = 'PO-CANCELLED-SHIPMENT'
    cancelled.items = [{ ...cancelled.items[0], id: 40, purchaseOrderId: 4, quantity: '0.20' }]
    purchases.push(partial, cancelled, {
      ...structuredClone(purchaseFixture),
      id: 5,
      orderNumber: 'PO-DRAFT',
    })
    incoming.push(
      {
        ...incomingFixture(25, 'SCHEDULED'),
        purchaseOrderId: 3,
        items: [{ ...incomingFixture(25, 'SCHEDULED').items[0], purchaseOrderItemId: 30 }],
      },
      {
        ...incomingFixture(26, 'CANCELLED'),
        purchaseOrderId: 4,
        items: [{ ...incomingFixture(26, 'CANCELLED').items[0], purchaseOrderItemId: 40 }],
      },
    )
    const user = userEvent.setup()
    mount(<DeliveriesHub initialTab="incoming" purchaseOrderId={2} arrangeOrder />)
    await screen.findByText(
      'This purchase order is no longer available to arrange. Choose another purchase order.',
    )
    expect(screen.getByRole('combobox', { name: /Purchase Order/ }).textContent).toContain(
      'Select purchase order',
    )
    expect(
      (screen.getByRole('button', { name: 'Schedule Incoming Delivery' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    await user.click(screen.getByRole('combobox', { name: /Purchase Order/ }))
    expect(screen.queryByRole('option', { name: /PO-TEST/ })).toBeNull()
    expect(screen.queryByRole('option', { name: /PO-DRAFT/ })).toBeNull()
    expect(
      screen.getByRole('option', { name: /PO-CANCELLED-SHIPMENT.*0.20 remaining/ }),
    ).toBeTruthy()
    await user.click(screen.getByRole('option', { name: /PO-PARTIAL.*0.05 remaining/ }))
    expect(
      (
        screen.getByRole('textbox', {
          name: 'Quantity to receive for Test Mango',
        }) as HTMLInputElement
      ).value,
    ).toBe('0.05')
    await user.click(screen.getByRole('combobox', { name: /Target Warehouse/ }))
    await user.click(screen.getByRole('option', { name: 'Test Warehouse' }))
    await user.click(screen.getByRole('button', { name: 'Schedule Incoming Delivery' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(requests.find((request) => request.method === 'post')?.body).toMatchObject({
      purchaseOrderId: 3,
      items: [{ purchaseOrderItemId: 30, receivedQuantity: '0.05' }],
    })
  })

  it('shows an empty picker when every purchase is already arranged and prevents scheduling', async () => {
    purchases[0].status = 'CONFIRMED'
    purchases[0].items[0].quantity = '0.60'
    mount(<DeliveriesHub initialTab="incoming" purchaseOrderId={2} arrangeOrder />)
    await screen.findByText(
      'No purchase orders have remaining quantities to arrange. Review existing Incoming Deliveries.',
    )
    expect(
      (screen.getByRole('combobox', { name: /Purchase Order/ }) as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(
      (screen.getByRole('button', { name: 'Schedule Incoming Delivery' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    fireEvent.submit(
      screen.getByRole('button', { name: 'Schedule Incoming Delivery' }).closest('form')!,
    )
    expect(requests.filter((request) => request.method !== 'get')).toHaveLength(0)
  })

  it('clears a newly exhausted purchase after a delivery refresh without selecting another order', async () => {
    purchases[0].status = 'CONFIRMED'
    purchases.push({
      ...structuredClone(purchases[0]),
      id: 3,
      orderNumber: 'PO-OTHER',
      items: [{ ...purchases[0].items[0], id: 30, purchaseOrderId: 3 }],
    })
    const { queryClient } = mount(
      <DeliveriesHub initialTab="incoming" purchaseOrderId={2} arrangeOrder />,
    )
    await screen.findByRole('textbox', { name: 'Quantity to receive for Test Mango' })
    const added = incomingFixture(25, 'DRAFT')
    added.items[0].receivedQuantity = '0.65'
    incoming = [...incoming, added]
    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['incoming-deliveries'] })
    })
    await screen.findByText(
      'This purchase order is no longer available to arrange. Choose another purchase order.',
    )
    expect(screen.getByRole('combobox', { name: /Purchase Order/ }).textContent).toContain(
      'Select purchase order',
    )
    expect(screen.queryByRole('textbox', { name: 'Quantity to receive for Test Mango' })).toBeNull()
    expect(
      (screen.getByRole('button', { name: 'Schedule Incoming Delivery' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(requests.filter((request) => request.method !== 'get')).toHaveLength(0)
  })

  it('requires confirmation for receipt, keeps failed confirmation open, and filters the completed row into history', async () => {
    const user = userEvent.setup()
    failReceipt = true
    mount(<DeliveriesHub initialTab="incoming" />)
    await user.click(await screen.findByRole('button', { name: 'Receive Goods IN-22' }))
    expect(screen.getByText(/Receiving adds the recorded quantities/)).toBeTruthy()
    expect(requests.some((request) => request.url.endsWith('/complete'))).toBe(false)
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Receive Goods',
      }),
    )
    expect(await screen.findByText('Receipt retry required.')).toBeTruthy()
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Receive Goods',
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('button', { name: 'View delivery IN-22' })).toBeNull()
  })

  it('keeps staff delivery access read-only with accessible detail references', async () => {
    auth.isAdmin = false
    auth.isStaff = true
    const user = userEvent.setup()
    mount(<DeliveriesHub initialTab="incoming" />)
    const reference = await screen.findByRole('button', { name: 'View delivery IN-21' })
    expect(screen.queryByRole('button', { name: 'Schedule Incoming' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Receive Goods IN-22' })).toBeNull()
    reference.focus()
    await user.keyboard('{Enter}')
    expect(within(screen.getByRole('dialog')).getByText('IN-21')).toBeTruthy()
    expect(requests.filter((request) => request.method !== 'get')).toHaveLength(0)
  })
})
