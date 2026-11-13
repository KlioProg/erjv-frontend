import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { DeliveryRow } from '@/features/logistics/delivery-workflow'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import { DeliveryTimeline } from './shared/DeliveryTimeline'
import { IncomingDeliveryDetailModal } from './shared/IncomingDeliveryDetailModal'
import type { DeliveryDetailModalProps } from './shared/DeliveryDetailModal'

const stamps = { createdAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-01T00:00:00Z' }
const deliveryFixture: OutgoingDeliveryRecord = {
  id: 10,
  deliveryNumber: 'OD-000010',
  salesOrderId: 11,
  warehouseId: 3,
  revision: 1,
  plannedItems: [],
  runId: 12,
  reconciledAt: '2026-10-04T04:15:00Z',
  reconciledByUserId: null,
  fulfillmentOutcome: null,
  hasDamage: false,
  hasMissing: false,
  status: 'DISPATCHED',
  cancelledAt: '2026-10-05T05:00:00Z',
  notes: 'Keep the cargo dry.\nCall before arrival.',
  ...stamps,
  items: [
    {
      id: 100,
      outgoingDeliveryId: 10,
      salesOrderItemId: 80,
      stockItemId: 7,
      quantity: '0.05',
      stockItem: { warehouseId: 3 },
      ...stamps,
    },
  ],
}
const runFixture: DeliveryRunRecord = {
  id: 12, runNumber: 'RUN-000012', revision: 4, status: 'DISPATCHED', warehouseId: 3,
  deliveryVehicleId: 4, driverEmployeeId: 5, scheduledDepartureAt: '2026-10-02T02:30:00Z',
  dispatchedAt: '2026-10-03T03:45:00Z', completedAt: null, cancelledAt: null,
  departureConfirmedByUserId: 1, loadedWeightKg: '0.05', capacityKgAtDeparture: '1500.00', notes: null,
  ...stamps, deliveries: [{ id: 10, deliveryNumber: 'OD-000010', revision: 1, status: 'DISPATCHED', salesOrderId: 11, warehouseId: 3 }],
}
const orderFixture: SalesOrderRecord = {
  id: 11,
  revision: 1,
  orderNumber: 'SO-000011',
  clientId: 6,
  deliveryAddress: 'Receiving entrance, a long customer destination address in Davao City',
  status: 'CONFIRMED',
  orderedAt: stamps.createdAt,
  expectedAt: null,
  confirmedAt: stamps.createdAt,
  completedAt: null,
  cancelledAt: null,
  externalReference: null,
  notes: null,
  ...stamps,
  items: [
    {
      id: 80,
      salesOrderId: 11,
      lineNumber: 1,
      inventoryItemId: 2,
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
    },
  ],
}
const customerName = 'Davao Fresh Produce Cooperative with a long customer name'
const productName = 'Fresh Carabao Mangoes with a long descriptive product name'
const productFixture: InventoryItemResponse = {
  id: 2,
  name: productName,
  variety: 'Carabao',
  unit: 'kg',
  unitPrice: '20.00',
  description: null,
  isActive: false,
  ...stamps,
}
let delivery: OutgoingDeliveryRecord
let records: Record<string, unknown>
let failedUrl: string | undefined
let deliveryGate: Promise<void> | undefined
let requests: { url: string; method: string; params: Record<string, unknown> }[]
const originalAdapter = apiClient.defaults.adapter

function mount(
  onClose = vi.fn(),
  options: Partial<
    Pick<
      DeliveryDetailModalProps,
      'canManage' | 'onNextAction' | 'onViewOrder' | 'onViewTrip'
    >
  > = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <DeliveryDetailModal deliveryId={10} open onClose={onClose} {...options} />
      </QueryClientProvider>,
    ),
  }
}

beforeEach(() => {
  delivery = structuredClone(deliveryFixture)
  failedUrl = undefined
  deliveryGate = undefined
  requests = []
  records = {
    '/delivery-runs/12': structuredClone(runFixture),
    '/sales-orders': [orderFixture],
    '/warehouses': [
      {
        id: 3,
        name: 'Archived Warehouse',
        address: 'Warehouse road, Davao City',
        isActive: false,
        ...stamps,
      },
    ],
    '/delivery-vehicles': [
      {
        id: 4,
        plateNumber: 'ABC-1234',
        vehicleType: 'Truck',
        model: 'Cargo Model',
        capacityKg: '1500.00',
        operationalStatus: 'SERVICEABLE',
        isAvailable: false,
        activeRunId: 12,
        isActive: false,
        ...stamps,
      },
    ],
    '/employees': [
      {
        id: 5,
        firstName: 'Ana',
        lastName: 'Cruz',
        phone: '09123456789',
        email: 'ana@example.test',
        isActive: false,
        ...stamps,
      },
    ],
    '/clients': [
      { id: 6, name: customerName, address: 'Customer office address', isActive: false, ...stamps },
    ],
    '/inventory-items': [
      {
        id: 2,
        name: productName,
        variety: 'Carabao',
        unit: 'kg',
        unitPrice: '20.00',
        isActive: false,
        ...stamps,
      },
    ],
  }
  // Actual API services and query hooks use a test-only HTTP adapter; no hook mocks.
  apiClient.defaults.adapter = async (config) => {
    const url = config.url || ''
    requests.push({ url, method: config.method || 'get', params: config.params || {} })
    if (url === '/outgoing-deliveries/10' && deliveryGate) await deliveryGate
    const base = '/' + url.split('/')[1]
    if (failedUrl === url || failedUrl === base)
      throw {
        isAxiosError: true,
        response: { status: 503, data: { message: 'Delivery lookup unavailable' } },
      }
    const reference = Array.isArray(records[base]) ? records[base].find((record: { id: number }) => record.id === Number(url.split('/')[2])) : undefined
    if (url !== '/outgoing-deliveries/10' && !(url in records) && !Array.isArray(records[base]))
      throw new Error(`Unexpected request ${url}`)
    let data = url === '/outgoing-deliveries/10' ? delivery : records[url] ?? reference ?? null
    if (Array.isArray(data) && config.params?.includeInactive !== 'true') {
      data = data.filter((record) => record.isActive !== false)
    }
    return { data: config.method === 'get' && Array.isArray(data) ? { items: data, nextCursor: null } : data, status: 200, statusText: 'OK', headers: {}, config }
  }
})

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('delivery progress', () => {
  it('keeps draft creation separate from the future schedule and actual lifecycle events in Manila', () => {
    render(<DeliveryTimeline delivery={{ ...deliveryFixture, status: 'RECONCILED', createdAt: '2026-11-06T16:17:00Z', reconciledAt: '2026-11-11T01:40:00Z' }} run={{ ...runFixture, scheduledDepartureAt: '2026-11-10T00:00:00Z', dispatchedAt: '2026-11-10T00:17:00Z' }} />)
    const steps = within(screen.getByRole('list', { name: 'Delivery progress' })).getAllByRole('listitem')
    expect(steps[0].textContent).toContain('Draft Created')
    expect(steps[0].textContent).toContain('Nov 7, 2026')
    expect(steps[0].textContent).toContain('12:17 AM')
    expect(steps[2].textContent).toContain('Nov 10, 2026')
    expect(steps[2].textContent).toContain('8:17 AM')
    expect(steps[3].textContent).toContain('Nov 11, 2026')
    expect(steps[3].textContent).toContain('9:40 AM')
  })
  it.each(['DRAFT', 'READY', 'DISPATCHED', 'RECONCILED'] as const)(
    'marks the current %s step and shows only reached timestamps',
    (status) => {
      render(<DeliveryTimeline delivery={{ ...deliveryFixture, status }} run={runFixture} />)
      const steps = within(screen.getByRole('list', { name: 'Delivery progress' })).getAllByRole(
        'listitem',
      )
      const current = ['DRAFT', 'READY', 'DISPATCHED', 'RECONCILED'].indexOf(status)
      const dates = [
        deliveryFixture.createdAt,
        null,
        runFixture.dispatchedAt,
        deliveryFixture.reconciledAt,
      ]
      expect(steps).toHaveLength(4)
      expect(screen.getByRole('list', { name: 'Delivery progress' }).classList.contains('w-full')).toBe(true)
      steps.forEach((step, index) => {
        const state = index < current || status === 'RECONCILED' ? 'complete' : index === current ? 'current' : 'upcoming'
        expect(step.getAttribute('aria-current')).toBe(state === 'current' ? 'step' : null)
        expect(step.querySelector('[data-slot="lifecycle-segment"]')?.getAttribute('data-state')).toBe(state)
        expect(step.textContent).toContain(
          state === 'current' ? 'Current' : state === 'complete' ? 'Completed' : 'Upcoming',
        )
        if (dates[index]) expect(step.textContent?.includes(DeliveryUtils.formatDateTime(dates[index]))).toBe(index <= current)
      })
    },
  )

  it('shows cancellation and its recorded date without implying delivery progress', () => {
    render(<DeliveryTimeline delivery={{ ...deliveryFixture, status: 'CANCELLED' }} />)
    expect(screen.getByRole('note').textContent).toContain('Shipment cancelled')
    expect(screen.getByRole('note').textContent).toContain(
      DeliveryUtils.formatDateTime(deliveryFixture.cancelledAt),
    )
    expect(screen.getByRole('note').textContent).toContain(
      `Created ${DeliveryUtils.formatDateTime(deliveryFixture.createdAt)}`,
    )
    expect(screen.queryByRole('list')).toBeNull()
  })
})

describe('outgoing delivery details', () => {
  it('preserves historical linked details and exact cargo in the canonical table', async () => {
    const user = userEvent.setup()
    const { onClose } = mount(vi.fn(), { onViewOrder: vi.fn() })
    await screen.findByText(customerName)
    await screen.findByText('Ana Cruz')
    const dialog = screen.getByRole('dialog', { name: 'OD-000010' })
    expect(within(dialog).getByRole('button', { name: 'View sales order SO-000011' })).toBeTruthy()
    expect(within(dialog).getByText(orderFixture.deliveryAddress!)).toBeTruthy()
    expect(within(dialog).getByText('Archived Warehouse')).toBeTruthy()
    expect(within(dialog).getByText('Ana Cruz')).toBeTruthy()
    expect(within(dialog).getByText('+63 912 345 6789')).toBeTruthy()
    expect(within(dialog).getByText('ABC-1234 (Truck)')).toBeTruthy()
    expect(within(dialog).getByText('Cargo Model / Capacity: 1500.00 kg')).toBeTruthy()
    expect(
      within(dialog).getAllByText(DeliveryUtils.formatDateTime(runFixture.scheduledDepartureAt)),
    ).toHaveLength(1)
    const table = within(dialog).getByRole('table')
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Item', 'Loaded Quantity'])
    for (const text of [productName + ' · Carabao', '0.05 kg']) {
      expect(within(table).getByText(text)).toBeTruthy()
    }
    expect(within(dialog).getByText(/Keep the cargo dry/).textContent).toBe(delivery.notes)
    for (const url of ['/warehouses/3', '/delivery-vehicles/4', '/employees/5', '/clients/6', '/inventory-items/2'])
      expect(requests.some(request => request.url === url)).toBe(true)
    expect(requests.some(request => ['/warehouses', '/delivery-vehicles', '/employees', '/clients', '/inventory-items'].includes(request.url))).toBe(false)
    expect(requests.every((request) => request.method === 'get')).toBe(true)
    await user.click(within(dialog).getAllByRole('button', { name: 'Close' })[0])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps missing assignments and references truthful and supports empty cargo', async () => {
    delivery.runId = null
    delivery.warehouseId = null
    delivery.items = []
    delivery.notes = null
    records['/warehouses'] = []
    records['/clients'] = []
    mount()
    await screen.findByText('Customer #6')
    expect(screen.getByText('Source warehouse unavailable')).toBeTruthy()
    expect(screen.getByText('Not assigned')).toBeTruthy()
    expect(screen.getByText('No cargo items recorded.')).toBeTruthy()
    expect(screen.queryByText('Delivery notes')).toBeNull()
  })

  it('retains cargo references if product data is unavailable, then recovers linked details', async () => {
    failedUrl = '/inventory-items'
    const user = userEvent.setup()
    mount()
    await screen.findByText(
      'Some linked details could not be loaded. Saved references remain visible.',
    )
    expect(screen.getByText('Product #2')).toBeTruthy()
    expect(screen.getByText('0.05 Unit unavailable')).toBeTruthy()
    failedUrl = undefined
    await user.click(screen.getByRole('button', { name: 'Retry linked details' }))
    await screen.findByText(productName + ' · Carabao')
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(requests.filter((request) => request.url === '/inventory-items/2')).toHaveLength(2)
    expect(requests.filter((request) => request.url === '/outgoing-deliveries/10')).toHaveLength(1)
  })

  it('shows a meaningful delivery error and retries the same record', async () => {
    failedUrl = '/outgoing-deliveries/10'
    const user = userEvent.setup()
    mount()
    await screen.findByText('Failed to load delivery record.')
    expect(screen.getByRole('alert').textContent).toContain(
      'The service is temporarily offline.',
    )
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2)
    failedUrl = undefined
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByRole('dialog', { name: 'OD-000010' })
    expect(requests.filter((request) => request.url === '/outgoing-deliveries/10')).toHaveLength(2)
  })

  it('keeps Close accessible during loading and closes with Escape after load', async () => {
    let release!: () => void
    deliveryGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const user = userEvent.setup()
    const { onClose } = mount()
    expect(screen.getByRole('status').textContent).toContain('Loading delivery details')
    expect(screen.getAllByRole('button', { name: 'Close' })).toHaveLength(2)
    await act(async () => {
      release()
    })
    await screen.findByRole('dialog', { name: 'OD-000010' })
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
  })

  it.each([
    ['DRAFT', null, true, false],
    ['READY', null, true, true],
    ['READY', 12, false, false],
    ['DISPATCHED', 12, false, false],
    ['RECONCILED', 12, false, false],
    ['CANCELLED', null, false, false],
  ] as const)('keeps secondary operations valid for %s with trip %s', async (status, runId, cancellable, reopenable) => {
    delivery.status = status
    delivery.runId = runId
    const onNextAction = vi.fn()
    mount(vi.fn(), { canManage: true, onNextAction, onViewOrder: vi.fn(), onViewTrip: vi.fn() })
    const dialog = within(await screen.findByRole('dialog', { name: 'OD-000010' }))
    await waitFor(() => expect(dialog.getAllByRole('button', { name: 'Close' }).every((button) => !button.hasAttribute('disabled'))).toBe(true))
    expect(!!dialog.queryByRole('button', { name: 'Cancel Delivery' })).toBe(cancellable)
    expect(!!dialog.queryByRole('button', { name: 'Reopen Draft' })).toBe(reopenable)
    expect(dialog.getByRole('button', { name: 'View sales order SO-000011' })).toBeTruthy()
    expect(!!dialog.queryByRole('button', { name: 'View delivery trip RUN-000012' })).toBe(runId != null)
    expect(dialog.queryByRole('button', { name: 'More Actions' })).toBeNull()
    expect(onNextAction).not.toHaveBeenCalled()
  })

  it('navigates through the order identifier with the keyboard without a mutation', async () => {
    const onNextAction = vi.fn(), onViewOrder = vi.fn()
    mount(vi.fn(), { canManage: true, onNextAction, onViewOrder })
    const details = within(await screen.findByRole('dialog', { name: 'OD-000010' }))
    const link = await details.findByRole('button', { name: 'View sales order SO-000011' })
    link.focus()
    await userEvent.keyboard('{Enter}')
    expect(onViewOrder).toHaveBeenCalledWith(11)
    expect(onNextAction).not.toHaveBeenCalled()
  })

  it('keeps dispatched details informational and links the assigned order and trip', async () => {
    const onNextAction = vi.fn(), onViewOrder = vi.fn(), onViewTrip = vi.fn()
    mount(vi.fn(), { canManage: true, onNextAction, onViewOrder, onViewTrip })
    const dialog = within(await screen.findByRole('dialog', { name: 'OD-000010' }))
    expect(dialog.queryByRole('button', { name: /Record Results/ })).toBeNull()
    await userEvent.click(await dialog.findByRole('button', { name: 'View sales order SO-000011' }))
    await userEvent.click(await dialog.findByRole('button', { name: 'View delivery trip RUN-000012' }))
    expect(onViewOrder).toHaveBeenCalledWith(11)
    expect(onViewTrip).toHaveBeenCalledWith(12)
    expect(onNextAction).not.toHaveBeenCalled()
  })

  it('keeps related trip navigation available to read-only employees', async () => {
    const onViewTrip = vi.fn()
    mount(vi.fn(), { canManage: false, onNextAction: vi.fn(), onViewTrip })
    const dialog = within(await screen.findByRole('dialog', { name: 'OD-000010' }))
    await userEvent.click(await dialog.findByRole('button', { name: 'View delivery trip RUN-000012' }))
    expect(onViewTrip).toHaveBeenCalledWith(12)
    expect(dialog.queryByRole('button', { name: 'Cancel Delivery' })).toBeNull()
  })

  it('shows saved Ready planning quantities before loaded cargo exists', async () => {
    delivery.status = 'READY'
    delivery.items = []
    delivery.runId = null
    delivery.plannedItems = [{ id: 81, outgoingDeliveryId: 10, salesOrderItemId: 80, plannedQuantity: '1.25', ...stamps }]
    mount(vi.fn(), { canManage: true, onNextAction: vi.fn() })
    const dialog = within(await screen.findByRole('dialog', { name: 'OD-000010' }))
    expect(await dialog.findByRole('heading', { name: 'Planned Items (1)' })).toBeTruthy()
    expect(dialog.getByRole('columnheader', { name: 'Planned Quantity' })).toBeTruthy()
    expect(dialog.getByText('1.25 kg')).toBeTruthy()
    expect(dialog.queryByRole('button', { name: /Add to Trip/ })).toBeNull()
    expect(delivery.items).toEqual([])
  })
})

const incomingDeliveryFixture: IncomingDeliveryRecord = {
  id: 20,
  revision: 1,
  deliveryNumber: 'ID-000020',
  purchaseOrderId: 21,
  warehouseId: 3,
  status: 'DRAFT',
  outcome: null,
  noReceiptReason: null,
  confirmedByUserId: null,
  scheduledAt: '2026-10-04T04:15:00Z',
  completedAt: null,
  cancelledAt: null,
  supplierReference: 'SUP-REF-20',
  notes: 'Keep chilled.',
  ...stamps,
  items: [{
    id: 201,
    incomingDeliveryId: 20,
    purchaseOrderItemId: 210,
    receivedQuantity: '1.25',
    acceptedQuantity: '1.00',
    damagedQuantity: '0.25',
    ...stamps,
  }],
}

const purchaseOrderFixture: PurchaseOrderRecord = {
  id: 21,
  revision: 1,
  orderNumber: 'PO-000021',
  status: 'CONFIRMED',
  supplierId: 9,
  orderedAt: stamps.createdAt,
  expectedAt: null,
  confirmedAt: stamps.createdAt,
  completedAt: null,
  cancelledAt: null,
  externalReference: null,
  notes: null,
  ...stamps,
  items: [{
    id: 210,
    purchaseOrderId: 21,
    lineNumber: 1,
    inventoryItemId: 2,
    quantity: '2.00',
    unitPrice: '20.00',
    discountRate: '0.00',
    discountAmount: '0.00',
    taxRate: '0.00',
    taxAmount: '0.00',
    subtotalAmount: '40.00',
    taxableAmount: '40.00',
    totalAmount: '40.00',
    notes: null,
    ...stamps,
  }],
}

function incomingRow(
  record: IncomingDeliveryRecord,
  purchaseOrderStatus: PurchaseOrderRecord['status'] = 'CONFIRMED',
): Extract<DeliveryRow, { type: 'Incoming' }> {
  return {
    key: `incoming-${record.id}`,
    reference: record.deliveryNumber,
    type: 'Incoming',
    record,
    party: 'Supplier #9',
    relatedOrder: purchaseOrderFixture.orderNumber,
    orderId: record.purchaseOrderId,
    purchaseOrderStatus,
    schedulingIssue: null,
    method: 'To Be Confirmed',
    warehouse: 'Receiving Warehouse',
    vehicle: '—',
    driver: '—',
    date: record.scheduledAt,
    status: record.status,
  }
}

describe('incoming delivery details', () => {
  it('shows expected order quantities and continues only eligible scheduling', async () => {
    const user = userEvent.setup()
    const row = incomingRow(structuredClone(incomingDeliveryFixture))
    const onAction = vi.fn()
    const onViewOrder = vi.fn()
    render(
      <IncomingDeliveryDetailModal
        row={row}
        purchaseOrders={[purchaseOrderFixture]}
        products={[productFixture]}
        onClose={vi.fn()}
        canManage
        onAction={onAction}
        onViewOrder={onViewOrder}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'ID-000020' })
    expect(within(dialog).getAllByText('Draft').length).toBeGreaterThan(0)
    expect(within(dialog).getByText('Supplier #9')).toBeTruthy()
    expect(within(dialog).getByText('Receiving Warehouse')).toBeTruthy()
    const table = within(dialog).getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Product',
      'Expected',
    ])
    expect(within(table).getByText('2 kg')).toBeTruthy()
    await user.click(within(dialog).getByRole('button', { name: 'View purchase order PO-000021' }))
    expect(onViewOrder).toHaveBeenCalledWith(row)
    expect(within(dialog).queryByRole('button', { name: /Schedule Arrival/ })).toBeNull()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel Delivery' }))
    expect(onAction).toHaveBeenCalledWith(row, 'cancel')
  })

  it('distinguishes received, accepted, and damaged quantities after confirmed receipt', () => {
    const completed = {
      ...structuredClone(incomingDeliveryFixture),
      status: 'COMPLETED' as const,
      outcome: 'RECEIVED_WITH_DAMAGE' as const,
      completedAt: '2026-10-05T04:15:00Z',
    }
    render(
      <IncomingDeliveryDetailModal
        row={incomingRow(completed)}
        purchaseOrders={[purchaseOrderFixture]}
        products={[productFixture]}
        onClose={vi.fn()}
        canManage
        onAction={vi.fn()}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'ID-000020' })
    const table = within(dialog).getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Product',
      'Expected',
      'Received',
      'Accepted',
      'Damaged',
    ])
    for (const quantity of ['2 kg', '1.25 kg', '1 kg', '0.25 kg']) {
      expect(within(table).getByText(quantity)).toBeTruthy()
    }
    expect(within(dialog).getByText(/Received with damage/)).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Receive Goods ID-000020' })).toBeNull()
  })

  it('does not imply a receipt or allow rescheduling for a no-receipt or fully received order', () => {
    const noReceipt = {
      ...structuredClone(incomingDeliveryFixture),
      status: 'COMPLETED' as const,
      outcome: 'NO_RECEIPT' as const,
      noReceiptReason: 'Supplier could not deliver',
      completedAt: '2026-10-05T04:15:00Z',
      items: [],
    }
    const row = incomingRow(noReceipt, 'RECEIVED')
    render(
      <IncomingDeliveryDetailModal
        row={row}
        purchaseOrders={[purchaseOrderFixture]}
        products={[]}
        onClose={vi.fn()}
        canManage
        onAction={vi.fn()}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'ID-000020' })
    const table = within(dialog).getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Product',
      'Expected',
    ])
    expect(within(dialog).getByText('No goods were received; inventory was not updated.')).toBeTruthy()
    expect(within(dialog).getByText('Reason: Supplier could not deliver')).toBeTruthy()
    expect(within(dialog).getByText('Outcome recorded at')).toBeTruthy()
    expect(within(dialog).queryByText('Received at')).toBeNull()
    expect(within(dialog).queryByText('0.00')).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Schedule Arrival ID-000020' })).toBeNull()
  })

  it('keeps new scheduling unavailable for an ineligible Purchase Order', () => {
    const draft = structuredClone(incomingDeliveryFixture)
    const row = incomingRow(draft, 'RECEIVED')
    render(
      <IncomingDeliveryDetailModal
        row={row}
        purchaseOrders={[{ ...purchaseOrderFixture, status: 'RECEIVED' }]}
        products={[productFixture]}
        onClose={vi.fn()}
        canManage
        onAction={vi.fn()}
      />,
    )
    const dialog = screen.getByRole('dialog', { name: 'ID-000020' })
    expect(within(dialog).getByText('Purchase Order Already Received')).toBeTruthy()
    expect(within(dialog).queryByRole('button', { name: 'Schedule Arrival ID-000020' })).toBeNull()
  })
})

it.each([2, 15])('shows %s incoming receipt products with distinct quantities and units', (count) => {
  const products = Array.from({ length: count }, (_, index) => ({ ...productFixture, id: 100 + index, name: 'Receipt product ' + index, variety: 'Carabao', unit: index % 2 ? 'L' : 'kg' }))
  const order = { ...purchaseOrderFixture, items: products.map((product, index) => ({ ...purchaseOrderFixture.items[0], id: 300 + index, inventoryItemId: product.id, quantity: '7.00' })) }
  const completed: IncomingDeliveryRecord = { ...incomingDeliveryFixture, status: 'COMPLETED', outcome: 'RECEIVED_WITH_DAMAGE', completedAt: '2026-10-05T04:15:00Z',
    items: order.items.map((item, index) => ({ ...incomingDeliveryFixture.items[0], id: 400 + index, purchaseOrderItemId: item.id, receivedQuantity: '5.50', acceptedQuantity: '3.00', damagedQuantity: '2.50' })) }
  const original = JSON.stringify(completed)
  render(<IncomingDeliveryDetailModal row={incomingRow(completed)} purchaseOrders={[order]} products={products} onClose={vi.fn()} />)
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(count + 1)
  const values = within(within(table).getAllByRole('row')[1]).getAllByRole('cell').map((cell) => cell.textContent)
  expect(values).toEqual(['Receipt product 0 · Carabao', '7 kg', '5.5 kg', '3 kg', '2.5 kg'])
  expect(within(table).getAllByText('7 L').length).toBeGreaterThan(0)
  expect(JSON.stringify(completed)).toBe(original)
})

it('shows multiple planned products with their own units before cargo is loaded', async () => {
  delivery.status = 'READY'; delivery.runId = null; delivery.items = []
  delivery.plannedItems = [
    { id: 81, outgoingDeliveryId: 10, salesOrderItemId: 80, plannedQuantity: '1.25', ...stamps },
    { id: 82, outgoingDeliveryId: 10, salesOrderItemId: 81, plannedQuantity: '3.00', ...stamps },
  ]
  records['/sales-orders'] = [{ ...orderFixture, items: [...orderFixture.items, { ...orderFixture.items[0], id: 81, inventoryItemId: 3, quantity: '3.00' }] }]
  const inventory = records['/inventory-items'] as InventoryItemResponse[]
  records['/inventory-items'] = [...inventory, { ...inventory[0], id: 3, name: 'Other product', variety: 'Large', unit: 'pieces' }]
  mount()
  const dialog = within(await screen.findByRole('dialog', { name: 'OD-000010' }))
  expect(await dialog.findByRole('heading', { name: 'Planned Items (2)' })).toBeTruthy()
  expect(await dialog.findByText('3 piece(s)')).toBeTruthy()
  const table = dialog.getByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(3)
  expect(within(table).getByRole('columnheader', { name: 'Product' })).toBeTruthy()
  expect(within(table).getByText('Other product · Large')).toBeTruthy()
  expect(within(table).getByText('1.25 kg')).toBeTruthy()
  expect(delivery.items).toEqual([])
})
