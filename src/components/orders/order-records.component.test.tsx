import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { OrdersView } from './OrdersView'
import { PurchasesView } from '../purchases/PurchasesView'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, user: { fullName: 'Employee' } }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const stamp = '2026-11-11T00:00:00Z'
const line = {
  id: 11,
  lineNumber: 1,
  inventoryItemId: 1,
  quantity: '10',
  unitPrice: '20',
  totalAmount: '200',
  subtotalAmount: '200',
  taxableAmount: '200',
  discountRate: '0',
  discountAmount: '0',
  taxRate: '0',
  taxAmount: '0',
  notes: null,
  createdAt: stamp,
  updatedAt: stamp,
}
const saved = {
  id: 1,
  revision: 3,
  status: 'CONFIRMED',
  orderedAt: stamp,
  expectedAt: stamp,
  confirmedAt: stamp,
  cancelledAt: null,
  completedAt: null,
  externalReference: 'REF-1',
  notes: null,
  createdAt: stamp,
  updatedAt: stamp,
}
let sales: Record<string, unknown>
let purchase: Record<string, unknown>
let outgoing: Record<string, unknown>[]
let incoming: Record<string, unknown>[]
let productName: string
let partyName: string | undefined
const original = apiClient.defaults.adapter
const writes = vi.fn()
beforeEach(() => {
  auth.isAdmin = true
  auth.isManager = false
  writes.mockReset()
  productName = 'Mango'
  partyName = undefined
  sales = {
    ...saved,
    orderNumber: 'SO-1',
    clientId: 1,
    deliveryAddress: 'Davao',
    items: [{ ...line, salesOrderId: 1 }],
  }
  purchase = {
    ...saved,
    orderNumber: 'PO-1',
    supplierId: 1,
    items: [{ ...line, purchaseOrderId: 1 }],
  }
  outgoing = []
  incoming = []
  apiClient.defaults.adapter = async (config) => {
    const url = config.url!.split('?')[0]
    let data: unknown = []
    if (config.method !== 'get') {
      writes(config)
      data = { ...purchase, status: 'CANCELLED', revision: 4 }
    } else if (url === '/sales-orders') data = { items: [sales], nextCursor: null }
    else if (url === '/purchase-orders') data = { items: [purchase], nextCursor: null }
    else if (url === '/sales-orders/1') data = sales
    else if (url === '/purchase-orders/1') data = purchase
    else if (url === '/outgoing-deliveries') data = { items: outgoing, nextCursor: null }
    else if (url === '/incoming-deliveries') data = { items: incoming, nextCursor: null }
    else if (url === '/clients/1') data = { id: 1, name: partyName ?? 'Customer One' }
    else if (url === '/suppliers/1') data = { id: 1, name: partyName ?? 'Supplier One' }
    else if (url === '/inventory-items/1') data = { id: 1, name: productName, unit: 'kg' }
    else if (url === '/warehouses/1') data = { id: 1, name: 'Main Warehouse' }
    else if (url === '/stock-items') data = { items: [], nextCursor: null }
    return { config, status: 200, statusText: 'OK', headers: {}, data }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount(child: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(<QueryClientProvider client={client}>{child}</QueryClientProvider>)
}

it.each(['sales', 'purchase'])(
  'opens %s records by keyboard and preserves contextual scheduling outside the five-column table',
  async (kind) => {
    const user = userEvent.setup()
    const navigate = vi.fn()
    const salesOrder = kind === 'sales'
    mount(
      salesOrder ? (
        <OrdersView onNavigateToDeliveries={navigate} />
      ) : (
        <PurchasesView onNavigateToDeliveries={navigate} />
      ),
    )
    const identifier = await screen.findByRole('button', { name: salesOrder ? 'SO-1' : 'PO-1' })
    const table = identifier.closest('table')!
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((heading) => heading.textContent),
    ).toEqual(['Order', salesOrder ? 'Customer' : 'Supplier', 'Items', 'Total', 'Progress'])
    const headings = within(table).getAllByRole('columnheader')
    headings.forEach((heading, index) =>
      expect(heading.classList.contains(index < 3 ? 'text-left' : 'text-right')).toBe(true),
    )
    const cells = within(identifier.closest('tr')!).getAllByRole('cell')
    expect(cells[3].classList.contains('text-right')).toBe(true)
    expect(cells[3].classList.contains('tabular-nums')).toBe(true)
    expect(cells[4].classList.contains('text-right')).toBe(true)
    expect(
      within(table).queryByRole('button', {
        name: /Plan Delivery|Schedule Arrival|More [Aa]ctions/,
      }),
    ).toBeNull()
    identifier.focus()
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: salesOrder ? /SO-1/ : /PO-1/ })
    expect(within(dialog).getAllByText(/Mango/).length).toBeGreaterThan(0)
    await user.click(
      within(dialog).getByRole('button', {
        name: salesOrder ? 'Arrange Delivery' : 'Schedule Arrival',
      }),
    )
    expect(navigate).toHaveBeenCalledWith(...(salesOrder ? ['outgoing', 1, true] : [1, true]))
    expect(writes).not.toHaveBeenCalled()
  },
)

it('retains purchase draft editing and revision-checked cancellation in details', async () => {
  purchase.status = 'DRAFT'
  const user = userEvent.setup()
  mount(<PurchasesView />)
  await user.click(await screen.findByRole('button', { name: 'PO-1' }))
  const dialog = await screen.findByRole('dialog', { name: /PO-1/ })
  expect(within(dialog).queryByRole('button', { name: 'Edit Draft' })).toBeNull()
  expect(within(dialog).getByRole('button', { name: 'Confirm Purchase Order' })).toBeTruthy()
  await user.click(within(dialog).getByRole('button', { name: 'More Actions' }))
  expect(screen.getByRole('menuitem', { name: 'Edit Draft' })).toBeTruthy()
  await user.click(screen.getByRole('menuitem', { name: 'Cancel Order' }))
  expect(writes).not.toHaveBeenCalled()
  const confirm = screen.getByRole('dialog', { name: /Cancel Purchase Order/ })
  await user.click(within(confirm).getByRole('button', { name: 'Cancel Order' }))
  await waitFor(() => expect(writes).toHaveBeenCalledTimes(1))
  expect(JSON.parse(writes.mock.calls[0][0].data)).toEqual({ expectedRevision: 3 })
})

it('keeps purchase delivery navigation available to readers without offering arrival scheduling', async () => {
  auth.isAdmin = false
  const navigate = vi.fn()
  mount(<PurchasesView onNavigateToDeliveries={navigate} />)
  await userEvent.click(await screen.findByRole('button', { name: 'PO-1' }))
  const dialog = await screen.findByRole('dialog', { name: /PO-1/ })
  expect(within(dialog).queryByRole('button', { name: 'Schedule Arrival' })).toBeNull()
  await userEvent.click(within(dialog).getByRole('button', { name: 'More Actions' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'View Incoming Deliveries' }))
  expect(navigate).toHaveBeenCalledWith(1)
  expect(writes).not.toHaveBeenCalled()
})

it('shows purchase partial receipt and damaged quantities without claiming complete fulfillment', async () => {
  purchase.status = 'PARTIALLY_RECEIVED'
  incoming = [
    {
      id: 7,
      deliveryNumber: 'IN-7',
      purchaseOrderId: 1,
      warehouseId: 1,
      status: 'COMPLETED',
      items: [
        {
          id: 70,
          purchaseOrderItemId: 11,
          receivedQuantity: '5',
          acceptedQuantity: '3',
          damagedQuantity: '2',
        },
      ],
    },
  ]
  mount(<PurchasesView onNavigateToDeliveries={vi.fn()} />)
  const identifier = await screen.findByRole('button', { name: 'PO-1' })
  expect(within(identifier.closest('tr')!).getByText('Partially Received')).toBeTruthy()
  await userEvent.click(identifier)
  const dialog = await screen.findByRole('dialog', { name: /PO-1/ })
  expect(within(dialog).getByText('Partially Received')).toBeTruthy()
  await userEvent.click(await within(dialog).findByText('Accepted and damaged quantities'))
  expect(await within(dialog).findByRole('columnheader', { name: 'Damaged' })).toBeTruthy()
  expect(within(dialog).getByRole('cell', { name: '2' })).toBeTruthy()
  expect(within(dialog).getByRole('cell', { name: '3' })).toBeTruthy()
  expect(within(dialog).getByRole('cell', { name: '7' })).toBeTruthy()
})

it('keeps partial sales progress authoritative even with another delivery in transit', async () => {
  sales.status = 'PARTIALLY_DELIVERED'
  outgoing = [
    { id: 4, salesOrderId: 1, status: 'DISPATCHED', plannedItems: [], items: [], runId: 2 },
  ]
  mount(<OrdersView />)
  const identifier = await screen.findByRole('button', { name: 'SO-1' })
  expect(within(identifier.closest('tr')!).getByText('Partially Delivered')).toBeTruthy()
  await userEvent.click(identifier.closest('tr')!)
  expect(await screen.findByRole('dialog', { name: /SO-1/ })).toBeTruthy()
  expect(screen.queryByText('What just happened?')).toBeNull()
})

it.each(['sales', 'purchase'])('opens %s details from a mouse row click', async (kind) => {
  mount(kind === 'sales' ? <OrdersView /> : <PurchasesView />)
  const identifier = await screen.findByRole('button', { name: kind === 'sales' ? 'SO-1' : 'PO-1' })
  await userEvent.click(
    within(identifier.closest('tr')!).getByRole('cell', {
      name: kind === 'sales' ? /Customer One/ : /Supplier One/,
    }),
  )
  expect(
    await screen.findByRole('dialog', { name: kind === 'sales' ? /SO-1/ : /PO-1/ }),
  ).toBeTruthy()
  expect(writes).not.toHaveBeenCalled()
})

it.each(['sales', 'purchase'])(
  'returns focus to the %s identifier and refreshes saved data when reopened',
  async (kind) => {
    const user = userEvent.setup()
    const record = kind === 'sales' ? sales : purchase
    mount(kind === 'sales' ? <OrdersView /> : <PurchasesView />)
    const identifier = await screen.findByRole('button', { name: kind === 'sales' ? 'SO-1' : 'PO-1' })
    identifier.focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(identifier))
    expect(writes).not.toHaveBeenCalled()

    record.notes = 'Saved by another employee'
    record.revision = 4
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Saved by another employee')).toBeTruthy()
    await user.click(within(screen.getByRole('group', { name: /order actions/ })).getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(document.activeElement).toBe(identifier))
    expect(writes).not.toHaveBeenCalled()
  },
)

it.each(['sales', 'purchase'])(
  'keeps %s draft mutation actions hidden for readers',
  async (kind) => {
    auth.isAdmin = false
    sales.status = 'DRAFT'
    purchase.status = 'DRAFT'
    mount(kind === 'sales' ? <OrdersView /> : <PurchasesView />)
    await userEvent.click(
      await screen.findByRole('button', { name: kind === 'sales' ? 'SO-1' : 'PO-1' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).queryByRole('button', {
        name: /Edit Draft|Cancel Order|Confirm Order|Confirm Purchase Order/,
      }),
    ).toBeNull()
    expect(writes).not.toHaveBeenCalled()
  },
)

it('keeps manager purchase draft editing and cancellation without granting admin confirmation', async () => {
  auth.isAdmin = false
  auth.isManager = true
  purchase.status = 'DRAFT'
  mount(<PurchasesView />)
  await userEvent.click(await screen.findByRole('button', { name: 'PO-1' }))
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).queryByRole('button', { name: 'Edit Draft' })).toBeNull()
  await userEvent.click(within(dialog).getByRole('button', { name: 'More Actions' }))
  expect(screen.getByRole('menuitem', { name: 'Edit Draft' })).toBeTruthy()
  expect(screen.getByRole('menuitem', { name: 'Cancel Order' })).toBeTruthy()
  expect(within(dialog).queryByRole('button', { name: 'Confirm Purchase Order' })).toBeNull()
})

it.each(['sales', 'purchase'])(
  'summarizes a single %s item and formats the stored total',
  async (kind) => {
    const record = kind === 'sales' ? sales : purchase
    record.items = [{ ...line, quantity: '7.25', totalAmount: '1234.50' }]
    mount(kind === 'sales' ? <OrdersView /> : <PurchasesView />)
    const identifier = await screen.findByRole('button', {
      name: kind === 'sales' ? 'SO-1' : 'PO-1',
    })
    const row = within(identifier.closest('tr')!)
    expect(await row.findByText('Mango (7.25)')).toBeTruthy()
    expect(row.getByRole('cell', { name: '₱1,234.50' })).toBeTruthy()
    expect(row.queryByRole('progressbar')).toBeNull()
  },
)

it.each(['sales', 'purchase'])(
  'uses a compact count for multiple %s items and retains details',
  async (kind) => {
    const record = kind === 'sales' ? sales : purchase
    record.items = [{ ...line }, { ...line, id: 12, lineNumber: 2 }]
    mount(kind === 'sales' ? <OrdersView /> : <PurchasesView />)
    const identifier = await screen.findByRole('button', {
      name: kind === 'sales' ? 'SO-1' : 'PO-1',
    })
    const row = within(identifier.closest('tr')!)
    const items = row.getByRole('cell', { name: '2 items' })
    expect(row.queryByText(/Mango/)).toBeNull()
    await userEvent.click(items)
    const dialog = await screen.findByRole('dialog')
    expect((await within(dialog).findAllByText(/Mango/)).length).toBeGreaterThanOrEqual(2)
    expect(writes).not.toHaveBeenCalled()
  },
)

it.each(['sales', 'purchase'])(
  'keeps %s progress specific to saved shipment state',
  async (kind) => {
    outgoing = [
      { id: 4, salesOrderId: 1, status: 'READY', plannedItems: [], items: [], runId: null },
      { id: 5, salesOrderId: 1, status: 'DISPATCHED', plannedItems: [], items: [], runId: 2 },
    ]
    incoming = [{ id: 7, purchaseOrderId: 1, status: 'SCHEDULED', items: [] }]
    mount(kind === 'sales' ? <OrdersView /> : <PurchasesView />)
    const identifier = await screen.findByRole('button', {
      name: kind === 'sales' ? 'SO-1' : 'PO-1',
    })
    const row = within(identifier.closest('tr')!)
    expect(await row.findByText(kind === 'sales' ? 'In Transit' : 'Arrival Scheduled')).toBeTruthy()
    expect(row.queryByText(/Completed|Received/)).toBeNull()
    expect(writes).not.toHaveBeenCalled()
  },
)

it.each(['sales', 'purchase'])(
  'retains full long names in compact %s table values',
  async (kind) => {
    productName = 'Carabao Mango selected export grade from the northern orchard'
    partyName = 'Harbor Wholesale and Agricultural Supply Corporation'
    mount(kind === 'sales' ? <OrdersView /> : <PurchasesView />)
    const identifier = await screen.findByRole('button', {
      name: kind === 'sales' ? 'SO-1' : 'PO-1',
    })
    const row = within(identifier.closest('tr')!)
    expect(await row.findByText(productName + ' (10)')).toBeTruthy()
    expect(await row.findByText(partyName)).toBeTruthy()
    expect(row.getAllByRole('cell')).toHaveLength(5)
    expect(writes).not.toHaveBeenCalled()
  },
)

it.each(['sales', 'purchase'])(
  'does not invent item information for an empty %s record',
  async (kind) => {
    const record = kind === 'sales' ? sales : purchase
    record.items = []
    record.expectedAt = null
    mount(kind === 'sales' ? <OrdersView /> : <PurchasesView />)
    const identifier = await screen.findByRole('button', {
      name: kind === 'sales' ? 'SO-1' : 'PO-1',
    })
    const row = within(identifier.closest('tr')!)
    expect(row.getByRole('cell', { name: 'No items listed' })).toBeTruthy()
    expect(row.getByRole('cell', { name: '₱0.00' })).toBeTruthy()
    expect(row.queryByText(/Invalid Date|NaN/)).toBeNull()
  },
)
