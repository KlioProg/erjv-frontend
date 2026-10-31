import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import { DeliveryTimeline } from './shared/DeliveryTimeline'

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
let delivery: OutgoingDeliveryRecord
let records: Record<string, unknown>
let failedUrl: string | undefined
let deliveryGate: Promise<void> | undefined
let requests: { url: string; method: string; params: Record<string, unknown> }[]
const originalAdapter = apiClient.defaults.adapter

function mount(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return {
    onClose,
    ...render(
      <QueryClientProvider client={queryClient}>
        <DeliveryDetailModal deliveryId={10} open onClose={onClose} />
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
      steps.forEach((step, index) => {
        expect(step.getAttribute('aria-current')).toBe(index === current ? 'step' : null)
        expect(step.textContent).toContain(
          index === current ? 'current step' : index < current ? 'completed' : 'upcoming',
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
    const { onClose } = mount()
    await screen.findByText(customerName)
    await screen.findByText('Ana Cruz')
    const dialog = screen.getByRole('dialog', { name: 'OD-000010' })
    expect(within(dialog).getByText('Sales Order SO-000011')).toBeTruthy()
    expect(within(dialog).getByText(orderFixture.deliveryAddress!)).toBeTruthy()
    expect(within(dialog).getByText('Archived Warehouse')).toBeTruthy()
    expect(within(dialog).getByText('Ana Cruz')).toBeTruthy()
    expect(within(dialog).getByText('09123456789')).toBeTruthy()
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
    for (const text of [productName, 'Carabao', '0.05', 'kg']) {
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
    expect(screen.getByText('No source records')).toBeTruthy()
    expect(screen.getAllByText('Unassigned')).toHaveLength(2)
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
    expect(screen.getByText('0.05')).toBeTruthy()
    expect(screen.getByText('Unit unavailable')).toBeTruthy()
    failedUrl = undefined
    await user.click(screen.getByRole('button', { name: 'Retry linked details' }))
    await screen.findByText(productName)
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
})
