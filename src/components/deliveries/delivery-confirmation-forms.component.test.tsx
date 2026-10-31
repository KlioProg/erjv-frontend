import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError, getAdapter } from 'axios'
import type { ReactNode } from 'react'
import { apiClient } from '@/lib/api-client'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import { ReceiveProductsModal } from './ReceiveProductsModal'
import { CompleteDeliveryModal } from './shared/CompleteDeliveryModal'
import { DispatchDeliveryModal } from './shared/DispatchDeliveryModal'
import { InventoryHub } from '@/components/inventory/InventoryHub'

const receiptAuth = vi.hoisted(() => ({ isAdmin: true, isManager: false }))
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ user: { id: 1 }, ...receiptAuth }),
}))
const original = apiClient.defaults.adapter
const incoming = {
  id: 1,
  revision: 4,
  purchaseOrderId: 2,
  deliveryNumber: 'IN-1',
  warehouseId: 3,
  status: 'SCHEDULED',
  items: [],
} as unknown as IncomingDeliveryRecord
const outgoing = {
  id: 8,
  salesOrderId: 4,
  deliveryNumber: 'OUT-8',
  warehouseId: 3,
  status: 'SCHEDULED',
  revision: 4,
  runId: 40,
  reconciledAt: null,
  plannedItems: [{ id: 10, salesOrderItemId: 15, plannedQuantity: '2.00' }],
  items: [
    { id: 11, salesOrderItemId: 15, stockItemId: 22, quantity: '2.00', loadedQuantity: '2.00' },
  ],
} as unknown as OutgoingDeliveryRecord
let writes: { url?: string; body: unknown }[]
let fail: boolean
let run: DeliveryRunRecord
beforeEach(() => {
  receiptAuth.isAdmin = true
  receiptAuth.isManager = false
  writes = []
  fail = false
  run = {
    id: 40,
    runNumber: 'RUN-40',
    revision: 2,
    status: 'DISPATCHED',
    warehouseId: 3,
    driverEmployeeId: 7,
    deliveryVehicleId: 6,
    scheduledDepartureAt: '2026-10-20T08:00:00Z',
    dispatchedAt: '2026-10-20T08:00:00Z',
    completedAt: null,
    cancelledAt: null,
    loadedWeightKg: '10.00',
    capacityKgAtDeparture: '100.00',
    departureConfirmedByUserId: 1,
    notes: null,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
    deliveries: [
      {
        id: 8,
        deliveryNumber: 'OUT-8',
        revision: 4,
        status: 'DISPATCHED',
        salesOrderId: 4,
        warehouseId: 3,
      },
    ],
  }
  apiClient.defaults.adapter = async (config) => {
    let data: unknown = []
    if (config.method !== 'get') {
      writes.push({ url: config.url, body: JSON.parse(config.data) })
      if (fail)
        throw new AxiosError('Conflict', undefined, config, undefined, {
          config,
          status: 409,
          statusText: '',
          headers: {},
          data: { message: 'Counts changed. Review the current delivery.' },
        })
      data = { ...incoming, deliveryNumber: 'Confirmed' }
      if (config.url === '/delivery-runs/40/dispatch')
        data = { ...run, status: 'DISPATCHED', revision: run.revision + 1 }
      if (config.url === '/delivery-runs/40/deliveries/8/reconcile')
        data = {
          delivery: {
            ...outgoing,
            status: 'RECONCILED',
            revision: 5,
            reconciledAt: '2026-10-21T08:00:00Z',
          },
          run: { ...run, revision: 3, status: 'COMPLETED' },
        }
      if (config.url === '/incoming-deliveries/1/complete')
        data = { ...incoming, revision: incoming.revision + 1, status: 'COMPLETED' }
    } else if (config.url === '/delivery-runs/40') data = run
    else if (config.url === '/delivery-runs') data = { items: [], nextCursor: null }
    else if (config.url === '/incoming-deliveries/1') data = incoming
    else if (config.url === '/purchase-orders/2')
      data = {
        id: 2,
        orderNumber: 'PO-2',
        supplierId: 4,
        status: 'CONFIRMED',
        items: [
          { id: 25, inventoryItemId: 5, quantity: '100.00' },
          { id: 26, inventoryItemId: 5, quantity: '10.00' },
        ],
      }
    else if (config.url === '/outgoing-deliveries/8') data = { ...outgoing, status: 'DISPATCHED' }
    else if (config.url === '/outgoing-deliveries/9')
      data = { ...outgoing, id: 9, status: 'DISPATCHED', items: [] }
    else if (config.url === '/sales-orders/4')
      data = {
        id: 4,
        clientId: 2,
        status: 'CONFIRMED',
        deliveryAddress: 'Market Street',
        items: [{ id: 15, inventoryItemId: 5, quantity: '3.00' }],
      }
    else if (config.url === '/inventory-items/5') data = { id: 5, name: 'Rice', variety: 'Jasmine', unit: 'kg', isActive: true, unitPrice: '10.00' }
    else if (config.url === '/warehouses/3') data = { id: 3, name: 'Main', isActive: true }
    else if (config.url === '/clients/2') data = { id: 2, name: 'Test Customer' }
    else if (config.url === '/suppliers/4') data = { id: 4, name: 'Test Supplier' }
    else if (config.url === '/suppliers') data = [{ id: 4, name: 'Test Supplier' }]
    else if (config.url === '/clients') data = [{ id: 2, name: 'Test Customer' }]
    else if (config.url === '/warehouses') data = [{ id: 3, name: 'Main' }]
    else if (config.url === '/inventory-items')
      data = [
        { id: 5, name: 'Rice', variety: 'Jasmine', unit: 'kg', isActive: true, unitPrice: '10.00' },
      ]
    else if (config.url === '/stock-items')
      data = [
        {
          id: 21,
          inventoryItemId: 5,
          warehouseId: 99,
          quantity: '100.00',
          inventoryItem: { name: 'Rice' },
          warehouse: { name: 'Wrong warehouse' },
        },
        {
          id: 22,
          inventoryItemId: 5,
          warehouseId: 3,
          quantity: '3.00',
          availableQuantity: '3.00',
          inventoryItem: { name: 'Rice' },
          warehouse: { name: 'Main' },
        },
      ]
    else if (config.url === '/delivery-vehicles')
      data = [
        { id: 6, plateNumber: 'ABC-6', vehicleType: 'TRUCK', isActive: true, status: 'AVAILABLE' },
      ]
    else if (config.url === '/employees')
      data = [{ id: 7, firstName: 'Test', lastName: 'Driver', isActive: true }]
    if (config.method === 'get' && Array.isArray(data)) data = { items: data, nextCursor: null }
    return { config, data, status: 200, statusText: '', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
})
function mount(element: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  for (const key of [
    'stock-items',
    'products',
    'warehouses',
    'quarantine-lots',
    'purchase-orders',
    'sales-orders',
    'incoming-deliveries',
    'outgoing-deliveries',
  ])
    client.setQueryData([key, 'check'], [])
  render(<QueryClientProvider client={client}>{element}</QueryClientProvider>)
  return client
}
async function ready(name: string) {
  const button = await screen.findByRole('button', { name })
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(false))
  return button
}
function value(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}
async function chooseOutcome(all: boolean) {
  const radio = screen.getByRole('radio', {
    name: all ? 'Yes, everything was delivered' : 'No, there were returns or missing goods',
  })
  await waitFor(() => expect(radio.matches(':disabled')).toBe(false))
  fireEvent.click(radio)
}
function overrideGet(url: string, data: unknown | (() => unknown)) {
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = (config) => {
    const productDetail = url === '/inventory-items' && /^\/inventory-items\/\d+$/.test(config.url ?? '')
    if (config.method === 'get' && (config.url === url || productDetail)) {
      const resolved = typeof data === 'function' ? data() : data
      return Promise.resolve({
        config,
        data: productDetail && Array.isArray(resolved)
          ? resolved.find((product) => product.id === Number(config.url!.split('/').pop())) ?? null
          : resolved,
        status: 200,
        statusText: '',
        headers: {},
      })
    }
    return base(config)
  }
}

function reconcile(name: string, delivered: string, sellable = '0', damaged = '0', missing = '0') {
  for (const [label, amount] of [
    ['Delivered', delivered],
    ['Returned sellable', sellable],
    ['Returned damaged', damaged],
    ['Missing', missing],
  ])
    value(`${label} for ${name}`, amount)
}

function setupDispatch() {
  run.status = 'DRAFT'
  run.deliveries[0].status = 'READY'
  overrideGet('/outgoing-deliveries/8', { ...outgoing, status: 'READY', items: [] })
  overrideGet('/warehouses/3', { id: 3, name: 'Main', isActive: true })
  overrideGet('/stock-items/pair/5/3', {
    id: 22,
    inventoryItemId: 5,
    warehouseId: 3,
    quantity: '3.00',
    availableQuantity: '3.00',
  })
  overrideGet('/inventory-items/5', { id: 5, name: 'Rice', variety: 'Jasmine', unit: 'kg' })
  overrideGet('/delivery-vehicles/6', {
    id: 6,
    plateNumber: 'ABC-6',
    isActive: true,
    operationalStatus: 'SERVICEABLE',
    isAvailable: true,
    activeRunId: null,
    capacityKg: '100.00',
  })
  overrideGet('/employees/7', {
    id: 7,
    firstName: 'Test',
    lastName: 'Driver',
    isActive: true,
    canDrive: true,
  })
}
const departure = () => screen.getByRole('button', { name: 'Confirm Run Departure' })
function dispatchValue(valueToLoad: string, kg = '10.00') {
  value('Quantity loaded for Rice on OUT-8', valueToLoad)
  value('Actual total loaded weight (kg)', kg)
}

it('loads current PO lines for an empty scheduled delivery and records a partial receipt with damage', async () => {
  const close = vi.fn()
  const client = mount(<ReceiveProductsModal delivery={incoming} onClose={close} />)
  await chooseReceipt('partial')
  const button = screen.getByRole('button', { name: 'Confirm Receipt' })
  expect((screen.getByLabelText('Received now for Rice (1)') as HTMLInputElement).value).toBe('')
  value('Received now for Rice (1)', '40.5')
  value('Damaged now for Rice (1)', '2')
  fireEvent.click(button)
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toEqual([
    {
      url: '/incoming-deliveries/1/complete',
      body: {
        expectedRevision: 4,
        items: [{ purchaseOrderItemId: 25, receivedQuantity: '40.50', damagedQuantity: '2.00' }],
      },
    },
  ])
  for (const key of [
    'stock-items',
    'products',
    'warehouses',
    'quarantine-lots',
    'purchase-orders',
    'incoming-deliveries',
  ])
    expect(client.getQueryState([key, 'check'])?.isInvalidated).toBe(true)
})

it('requires an explicit no-receipt choice and reason', async () => {
  mount(<ReceiveProductsModal delivery={incoming} onClose={vi.fn()} />)
  expect(screen.getByRole('button', { name: 'Confirm Receipt' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(
    true,
  )
  expect(screen.queryByRole('textbox')).toBeNull()
  await chooseReceipt('none')
  const button = screen.getByRole('button', { name: 'Confirm No Receipt' })
  expect(button.hasAttribute('disabled')).toBe(true)
  value('Reason no goods arrived', 'Supplier did not arrive')
  fireEvent.click(button)
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toEqual({
    expectedRevision: 4,
    items: [],
    noReceiptReason: 'Supplier did not arrive',
  })
})

it('rejects invalid receipt decimals and damaged quantities greater than received', async () => {
  mount(<ReceiveProductsModal delivery={incoming} onClose={vi.fn()} />)
  await chooseReceipt('partial')
  const button = screen.getByRole('button', { name: 'Confirm Receipt' })
  for (const [received, damaged] of [
    ['1.234', '0'],
    ['1', '2'],
    ['-1', '0'],
    ['1', '-0.01'],
    ['1', '0.001'],
    ['abc', '0'],
  ]) {
    value('Received now for Rice (1)', received)
    value('Damaged now for Rice (1)', damaged)
    fireEvent.click(button)
    expect(button.hasAttribute('disabled')).toBe(true)
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
  }
  expect(writes).toHaveLength(0)
})

it('requires all reconciliation categories, matching totals, and reasons for damage or missing goods', async () => {
  const close = vi.fn()
  const client = mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={close} />)
  const button = await screen.findByRole('button', { name: 'Confirm Completion' })
  await chooseOutcome(false)
  await waitFor(() =>
    expect(screen.getByLabelText('Delivered for Rice (1)').hasAttribute('disabled')).toBe(false),
  )
  fireEvent.click(button)
  expect(writes).toHaveLength(0)
  value('Delivered for Rice (1)', '1')
  value('Returned sellable for Rice (1)', '0')
  value('Returned damaged for Rice (1)', '0.5')
  value('Missing for Rice (1)', '0')
  fireEvent.click(button)
  expect(button.hasAttribute('disabled')).toBe(true)
  expect(screen.getByText(/Accounted for:/).textContent).toContain('1.5 / 2')
  value('Missing for Rice (1)', '0.5')
  fireEvent.click(button)
  expect(button.hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('Discrepancy Reason (required)')).toBeTruthy()
  value('Discrepancy Reason for Rice (1)', 'Broken and missing')
  fireEvent.click(button)
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes[0].body).toEqual({
    expectedRevision: 4,
    items: [
      {
        outgoingDeliveryItemId: 11,
        deliveredQuantity: '1.00',
        returnedSellableQuantity: '0.00',
        returnedDamagedQuantity: '0.50',
        missingQuantity: '0.50',
        discrepancyReason: 'Broken and missing',
      },
    ],
  })
  for (const key of ['stock-items', 'sales-orders', 'quarantine-lots'])
    expect(client.getQueryState([key, 'check'])?.isInvalidated).toBe(true)
})

it('rejects completion without persisted loaded lines', async () => {
  mount(<CompleteDeliveryModal runId={40} deliveryId={9} onClose={vi.fn()} />)
  const button = await screen.findByRole('button', { name: 'Confirm Completion' })
  expect(button.hasAttribute('disabled')).toBe(true)
  expect(await screen.findByText(/Loaded products are missing/)).toBeTruthy()
  expect(writes).toHaveLength(0)
})

it('keeps the receipt form open and refreshes state on a 409', async () => {
  fail = true
  const close = vi.fn()
  const client = mount(<ReceiveProductsModal delivery={incoming} onClose={close} />)
  await chooseReceipt('partial')
  value('Received now for Rice (1)', '1')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Counts changed')
  expect(close).not.toHaveBeenCalled()
  expect(client.getQueryState(['incoming-deliveries', 'check'])?.isInvalidated).toBe(true)
})

it('dispatches explicit actual quantities from the run warehouse, not the first matching product', async () => {
  setupDispatch()
  const close = vi.fn()
  mount(<DispatchDeliveryModal runId={40} onClose={close} />)
  await ready('Use Planned Quantities')
  dispatchValue('2.01')
  fireEvent.click(departure())
  expect((await screen.findByRole('alert')).textContent).toMatch(/within the plan/)
  expect(writes).toHaveLength(0)
  dispatchValue('1.5')
  fireEvent.click(departure())
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes[0]).toEqual({
    url: '/delivery-runs/40/dispatch',
    body: {
      expectedRevision: 2,
      loadedWeightKg: '10.00',
      loads: [
        {
          deliveryId: 8,
          expectedRevision: 4,
          items: [{ salesOrderItemId: 15, stockItemId: 22, loadedQuantity: '1.50' }],
        },
      ],
    },
  })
})

it('places the outline report action directly before the primary register action and preserves both dialogs', async () => {
  mount(<InventoryHub />)
  const report = await ready('Report Stock Condition')
  const register = screen.getByRole('button', { name: 'Register Product' })
  expect(report.nextElementSibling).toBe(register)
  expect(report.className).toContain('border-input')
  expect(report.className).not.toContain('bg-primary-contrast')
  expect(register.className).toContain('bg-primary-contrast')
  expect(report.parentElement?.className).toContain('flex-wrap')
  const user = userEvent.setup()
  await user.click(report)
  expect(await screen.findByRole('dialog')).toBeTruthy()
  await user.click(screen.getAllByRole('button', { name: 'Close' })[0])
  await user.click(register)
  expect(await screen.findByRole('dialog')).toBeTruthy()
})

it('respects accepted receipt capacity while allowing physically received damaged replacements', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = (config) =>
    config.url === '/incoming-deliveries' && config.method === 'get'
      ? Promise.resolve({
          config,
          data: {
            items: [
              {
                ...incoming,
                id: 99,
                status: 'COMPLETED',
                items: [{ id: 250, purchaseOrderItemId: 25, acceptedQuantity: '99.00' }],
              },
            ],
            nextCursor: null,
          },
          status: 200,
          statusText: '',
          headers: {},
        })
      : base(config)
  mount(<ReceiveProductsModal delivery={incoming} onClose={vi.fn()} />)
  await chooseReceipt('partial')
  const button = screen.getByRole('button', { name: 'Confirm Receipt' })
  value('Received now for Rice (1)', '2')
  fireEvent.click(button)
  expect((await screen.findByRole('alert')).textContent).toMatch(/remaining purchase order/i)
  expect(writes).toHaveLength(0)
  value('Damaged now for Rice (1)', '1')
  fireEvent.click(button)
  await waitFor(() => expect(writes).toHaveLength(1))
})

it('rejects duplicate member plan lines before dispatch and refreshes conflicts without dropping entries', async () => {
  setupDispatch()
  let duplicate = true
  overrideGet('/outgoing-deliveries/8', () => ({
    ...outgoing,
    status: 'READY',
    items: [],
    plannedItems: duplicate
      ? [...outgoing.plannedItems, { ...outgoing.plannedItems[0], id: 12 }]
      : outgoing.plannedItems,
  }))
  const close = vi.fn()
  const client = mount(<DispatchDeliveryModal runId={40} onClose={close} />)
  await ready('Use Planned Quantities')
  value('Actual total loaded weight (kg)', '10')
  fireEvent.change(screen.getAllByLabelText('Quantity loaded for Rice on OUT-8')[0], {
    target: { value: '1' },
  })
  fireEvent.click(departure())
  expect((await screen.findByRole('alert')).textContent).toMatch(/duplicate/i)
  expect(writes).toHaveLength(0)
  duplicate = false
  fireEvent.click(screen.getByRole('button', { name: 'Refresh run and review current data' }))
  await ready('Use Planned Quantities')
  dispatchValue('1')
  fail = true
  fireEvent.click(departure())
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Counts changed'))
  expect(close).not.toHaveBeenCalled()
  expect(client.getQueryState(['outgoing-deliveries', 'check'])?.isInvalidated).toBe(true)
})

it('uses planned quantities without submitting and keeps recognizable member products editable', async () => {
  setupDispatch()
  mount(<DispatchDeliveryModal runId={40} onClose={vi.fn()} />)
  fireEvent.click(await ready('Use Planned Quantities'))
  expect(
    (screen.getByLabelText('Quantity loaded for Rice on OUT-8') as HTMLInputElement).value,
  ).toBe('2.00')
  expect(screen.getByText('Rice')).toBeTruthy()
  expect(screen.getByText('Main')).toBeTruthy()
  expect(screen.getByRole('dialog').textContent).not.toMatch(/Stock #|Order line #/)
  expect(writes).toHaveLength(0)
  dispatchValue('0.75')
  fireEvent.click(departure())
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toMatchObject({
    loads: [{ deliveryId: 8, items: [{ loadedQuantity: '0.75', stockItemId: 22 }] }],
  })
})

it('rejects the planned shortcut when source availability falls and retains actual input', async () => {
  setupDispatch()
  overrideGet('/stock-items/pair/5/3', {
    id: 22,
    inventoryItemId: 5,
    warehouseId: 3,
    quantity: '1.25',
    availableQuantity: '1.25',
  })
  mount(<DispatchDeliveryModal runId={40} onClose={vi.fn()} />)
  await ready('Use Planned Quantities')
  dispatchValue('1')
  fireEvent.click(screen.getByRole('button', { name: 'Use Planned Quantities' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/exceed/)
  expect(
    (screen.getByLabelText('Quantity loaded for Rice on OUT-8') as HTMLInputElement).value,
  ).toBe('1')
  dispatchValue('1.26')
  fireEvent.click(departure())
  expect(screen.getByRole('alert').textContent).toMatch(/exceed/)
  expect(writes).toHaveLength(0)
})

it('migrates assignment validation to saved draft run assignments and blocks an unavailable vehicle', async () => {
  setupDispatch()
  overrideGet('/delivery-vehicles/6', {
    id: 6,
    plateNumber: 'BUSY-6',
    isActive: true,
    operationalStatus: 'MAINTENANCE',
    isAvailable: false,
    activeRunId: null,
    capacityKg: '100.00',
  })
  mount(<DispatchDeliveryModal runId={40} onClose={vi.fn()} />)
  expect(await screen.findByText(/assigned vehicle is unavailable/)).toBeTruthy()
  expect(screen.queryByRole('combobox')).toBeNull()
  expect(departure().hasAttribute('disabled')).toBe(true)
  expect(writes).toHaveLength(0)
})

it('shows full saved assignment labels and supports keyboard departure without selecting replacement IDs', async () => {
  setupDispatch()
  const driver = 'Alexandria Longlastname Regional Delivery Officer'
  overrideGet('/employees/7', {
    id: 7,
    firstName: 'Alexandria',
    lastName: 'Longlastname Regional Delivery Officer',
    isActive: true,
    canDrive: true,
  })
  mount(<DispatchDeliveryModal runId={40} onClose={vi.fn()} />)
  await ready('Use Planned Quantities')
  expect(screen.getByText(driver)).toBeTruthy()
  expect(screen.getByText('ABC-6')).toBeTruthy()
  dispatchValue('2.00')
  const user = userEvent.setup()
  departure().focus()
  await user.keyboard('{Enter}')
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toMatchObject({
    expectedRevision: 2,
    loads: [{ deliveryId: 8, expectedRevision: 4 }],
  })
  expect(writes[0].body).not.toHaveProperty('driverEmployeeId')
})

it('starts completion with neither outcome selected and sends the explicit all-delivered payload only on confirmation', async () => {
  mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={vi.fn()} />)
  const button = screen.getByRole('button', { name: 'Confirm Completion' })
  expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(
    true,
  )
  expect(button.hasAttribute('disabled')).toBe(true)
  expect(screen.queryByRole('region', { name: 'Product reconciliation' })).toBeNull()
  await chooseOutcome(true)
  expect(screen.getByText('Rice')).toBeTruthy()
  expect(screen.getByText('Jasmine · kg · Main')).toBeTruthy()
  expect(screen.getByText('2 kg loaded')).toBeTruthy()
  expect(screen.getByRole('dialog').textContent).not.toMatch(/Line #|Stock #/)
  expect(writes).toHaveLength(0)
  fireEvent.click(button)
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0]).toEqual({
    url: '/delivery-runs/40/deliveries/8/reconcile',
    body: {
      expectedRevision: 4,
      items: [
        {
          outgoingDeliveryItemId: 11,
          deliveredQuantity: '2.00',
          returnedSellableQuantity: '0.00',
          returnedDamagedQuantity: '0.00',
          missingQuantity: '0.00',
        },
      ],
    },
  })
})

it('balances products separately with different units and requires reasons only for damaged or missing goods', async () => {
  overrideGet('/outgoing-deliveries/8', {
    ...outgoing,
    status: 'DISPATCHED',
    items: [
      ...outgoing.items,
      { id: 12, salesOrderItemId: 16, stockItemId: 23, quantity: '0.30', loadedQuantity: '0.30' },
    ],
  })
  overrideGet('/sales-orders/4', {
    id: 4,
    clientId: 2,
    items: [
      { id: 15, inventoryItemId: 5, quantity: '3.00' },
      { id: 16, inventoryItemId: 6, quantity: '1.00' },
    ],
  })
  overrideGet('/inventory-items', [
    { id: 5, name: 'Rice', unit: 'kg' },
    { id: 6, name: 'Oil', unit: 'L' },
  ])
  mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={vi.fn()} />)
  await chooseOutcome(false)
  reconcile('Rice (1)', '1', '1')
  reconcile('Oil (2)', '0.10', '0', '0', '0.20')
  expect(screen.getByText(/Accounted for: 2 \/ 2 kg/)).toBeTruthy()
  expect(screen.getByText(/Accounted for: 0.3 \/ 0.3 L/)).toBeTruthy()
  expect(screen.queryByLabelText('Discrepancy Reason for Rice (1)')).toBeNull()
  expect(screen.getByRole('button', { name: 'Confirm Completion' }).hasAttribute('disabled')).toBe(
    true,
  )
  value('Discrepancy Reason for Oil (2)', 'Bottle missing')
  fireEvent.click(await ready('Confirm Completion'))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toEqual({
    expectedRevision: 4,
    items: [
      {
        outgoingDeliveryItemId: 11,
        deliveredQuantity: '1.00',
        returnedSellableQuantity: '1.00',
        returnedDamagedQuantity: '0.00',
        missingQuantity: '0.00',
      },
      {
        outgoingDeliveryItemId: 12,
        deliveredQuantity: '0.10',
        returnedSellableQuantity: '0.00',
        returnedDamagedQuantity: '0.00',
        missingQuantity: '0.20',
        discrepancyReason: 'Bottle missing',
      },
    ],
  })
})

it('warns before switching away from exceptions and restores entered quantities and reasons', async () => {
  mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={vi.fn()} />)
  await chooseOutcome(false)
  reconcile('Rice (1)', '1', '0', '1')
  value('Discrepancy Reason for Rice (1)', 'Damaged packaging')
  await chooseOutcome(true)
  expect(screen.getByRole('button', { name: 'Confirm Completion' }).hasAttribute('disabled')).toBe(
    true,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Keep exceptions' }))
  expect((screen.getByLabelText('Returned damaged for Rice (1)') as HTMLInputElement).value).toBe(
    '1',
  )
  await chooseOutcome(true)
  fireEvent.click(screen.getByRole('button', { name: 'Confirm everything delivered' }))
  expect(screen.queryByLabelText('Delivered for Rice (1)')).toBeNull()
  expect(writes).toHaveLength(0)
  await chooseOutcome(false)
  expect((screen.getByLabelText('Returned damaged for Rice (1)') as HTMLInputElement).value).toBe(
    '1',
  )
  expect((screen.getByLabelText('Discrepancy Reason for Rice (1)') as HTMLInputElement).value).toBe(
    'Damaged packaging',
  )
})

it('keeps completion entries after a recoverable conflict and prevents duplicate pending submissions', async () => {
  fail = true
  const close = vi.fn()
  const client = mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={close} />)
  await chooseOutcome(false)
  reconcile('Rice (1)', '1.5', '0.5')
  fireEvent.click(await ready('Confirm Completion'))
  expect(await screen.findByText('Counts changed. Review the current delivery.')).toBeTruthy()
  expect((screen.getByLabelText('Delivered for Rice (1)') as HTMLInputElement).value).toBe('1.5')
  expect(close).not.toHaveBeenCalled()
  expect(client.getQueryState(['outgoing-deliveries', 'check'])?.isInvalidated).toBe(true)
  expect(writes).toHaveLength(1)
  fail = false
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'patch') await pending
    return base(config)
  }
  fireEvent.click(screen.getByRole('button', { name: 'Refresh delivery data' }))
  const button = await ready('Confirm Completion')
  fireEvent.submit(button.closest('form')!)
  fireEvent.submit(button.closest('form')!)
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(true))
  expect(close).not.toHaveBeenCalled()
  release()
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toHaveLength(2)
})

it('requires a new explicit outcome after persisted loaded quantities change during editing', async () => {
  let loaded = '2.00'
  overrideGet('/outgoing-deliveries/8', () => ({
    ...outgoing,
    status: 'DISPATCHED',
    items: [{ ...outgoing.items[0], loadedQuantity: loaded }],
  }))
  const client = mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={vi.fn()} />)
  await chooseOutcome(true)
  loaded = '1.25'
  await client.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
  expect(await screen.findByText(/Loaded quantities changed/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Confirm Completion' }).hasAttribute('disabled')).toBe(
    true,
  )
  await chooseOutcome(true)
  fireEvent.click(await ready('Confirm Completion'))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toMatchObject({ items: [{ deliveredQuantity: '1.25' }] })
})

it('blocks completion when product lookup data is unavailable without fabricating labels', async () => {
  overrideGet('/inventory-items', [])
  mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={vi.fn()} />)
  expect(await screen.findByText('Product unavailable')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Confirm Completion' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(screen.getByRole('dialog').textContent).not.toMatch(/Line #|Stock #/)
  expect(writes).toHaveLength(0)
})

it('retains dispatch input and blocks mutation after current source stock changes', async () => {
  setupDispatch()
  let available = '3.00'
  overrideGet('/stock-items/pair/5/3', () => ({
    id: 22,
    inventoryItemId: 5,
    warehouseId: 3,
    quantity: '3.00',
    availableQuantity: available,
  }))
  mount(<DispatchDeliveryModal runId={40} onClose={vi.fn()} />)
  fireEvent.click(await ready('Use Planned Quantities'))
  value('Actual total loaded weight (kg)', '10')
  available = '1.00'
  fireEvent.click(screen.getByRole('button', { name: 'Refresh run and review current data' }))
  await ready('Confirm Run Departure')
  fireEvent.click(departure())
  expect((await screen.findByRole('alert')).textContent).toMatch(/exceed/)
  expect(
    (screen.getByLabelText('Quantity loaded for Rice on OUT-8') as HTMLInputElement).value,
  ).toBe('2.00')
  expect(writes).toHaveLength(0)
})

it('prevents duplicate run departure while the inventory mutation is pending', async () => {
  setupDispatch()
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'patch') await pending
    return base(config)
  }
  const close = vi.fn()
  mount(<DispatchDeliveryModal runId={40} onClose={close} />)
  fireEvent.click(await ready('Use Planned Quantities'))
  value('Actual total loaded weight (kg)', '10')
  const button = await ready('Confirm Run Departure')
  fireEvent.submit(button.closest('form')!)
  fireEvent.submit(button.closest('form')!)
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(true))
  expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
  release()
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toHaveLength(1)
})

it('rejects invalid reconciliation decimals without silently allocating the difference', async () => {
  mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={vi.fn()} />)
  await chooseOutcome(false)
  reconcile('Rice (1)', '1.5', '0.5')
  for (const invalid of ['-1', '1.234', 'abc']) {
    value('Delivered for Rice (1)', invalid)
    expect(screen.getByLabelText('Delivered for Rice (1)').getAttribute('aria-invalid')).toBe(
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Confirm Completion' }).hasAttribute('disabled'),
    ).toBe(true)
  }
  expect((screen.getByLabelText('Missing for Rice (1)') as HTMLInputElement).value).toBe('0')
  expect(writes).toHaveLength(0)
})

it('supports keyboard outcome selection, traps focus, and closes with Escape without submitting', async () => {
  const close = vi.fn()
  mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={close} />)
  const radio = screen.getByRole('radio', { name: 'Yes, everything was delivered' })
  await waitFor(() => expect(radio.matches(':disabled')).toBe(false))
  const user = userEvent.setup()
  radio.focus()
  await user.keyboard(' ')
  expect((radio as HTMLInputElement).checked).toBe(true)
  const dialog = screen.getByRole('dialog')
  for (let index = 0; index < 8; index++) {
    await user.tab()
    expect(dialog.contains(document.activeElement)).toBe(true)
  }
  expect(writes).toHaveLength(0)
  await user.keyboard('{Escape}')
  expect(close).toHaveBeenCalledOnce()
})

async function chooseReceipt(outcome: 'all' | 'partial' | 'none') {
  const name =
    outcome === 'all'
      ? 'All remaining goods arrived in good condition'
      : outcome === 'partial'
        ? 'Some goods arrived or were damaged'
        : 'No goods arrived'
  const radio = screen.getByRole('radio', { name })
  await waitFor(() => expect(radio.matches(':disabled')).toBe(false))
  fireEvent.click(radio)
}

it('builds the full receipt only after an explicit choice and records exact current outstanding balances', async () => {
  overrideGet('/incoming-deliveries', {
    items: [
      {
        ...incoming,
        id: 99,
        status: 'COMPLETED',
        items: [{ id: 250, purchaseOrderItemId: 25, acceptedQuantity: '99.01' }],
      },
    ],
    nextCursor: null,
  })
  const close = vi.fn()
  mount(<ReceiveProductsModal delivery={incoming} onClose={close} />)
  await chooseReceipt('all')
  const button = await ready('Confirm Receipt')
  expect(writes).toHaveLength(0)
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(screen.getByText('0.99 kg outstanding')).toBeTruthy()
  expect(screen.getByText('PO-2', { exact: false })).toBeTruthy()
  expect(screen.getByText('Test Supplier')).toBeTruthy()
  fireEvent.click(button)
  fireEvent.click(button)
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toEqual([
    {
      url: '/incoming-deliveries/1/complete',
      body: {
        expectedRevision: 4,
        items: [
          { purchaseOrderItemId: 25, receivedQuantity: '0.99', damagedQuantity: '0.00' },
          { purchaseOrderItemId: 26, receivedQuantity: '10.00', damagedQuantity: '0.00' },
        ],
      },
    },
  ])
})

it('retains partial quantities across confirmed switches and submits only the chosen outcome', async () => {
  mount(<ReceiveProductsModal delivery={incoming} onClose={vi.fn()} />)
  await chooseReceipt('partial')
  value('Received now for Rice (1)', '40.50')
  value('Damaged now for Rice (1)', '2.50')
  await chooseReceipt('all')
  expect(
    (screen.getByRole('radio', { name: 'Some goods arrived or were damaged' }) as HTMLInputElement)
      .checked,
  ).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Keep current outcome' }))
  expect((screen.getByLabelText('Received now for Rice (1)') as HTMLInputElement).value).toBe(
    '40.50',
  )
  await chooseReceipt('all')
  fireEvent.click(screen.getByRole('button', { name: 'Use selected outcome' }))
  await ready('Confirm Receipt')
  await chooseReceipt('partial')
  expect((screen.getByLabelText('Damaged now for Rice (1)') as HTMLInputElement).value).toBe('2.50')
  await chooseReceipt('none')
  fireEvent.click(screen.getByRole('button', { name: 'Use selected outcome' }))
  value('Reason no goods arrived', 'No delivery')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm No Receipt' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toEqual({ expectedRevision: 4, items: [], noReceiptReason: 'No delivery' })
})

it('blocks a stale full receipt and allows a fresh review without silently changing the draft', async () => {
  let accepted = '0.00'
  overrideGet('/incoming-deliveries', () => ({
    items: [
      {
        ...incoming,
        id: 99,
        status: 'COMPLETED',
        items: [{ id: 250, purchaseOrderItemId: 25, acceptedQuantity: accepted }],
      },
    ],
    nextCursor: null,
  }))
  mount(<ReceiveProductsModal delivery={incoming} onClose={vi.fn()} />)
  await chooseReceipt('all')
  const button = await ready('Confirm Receipt')
  accepted = '99.99'
  fireEvent.click(button)
  expect((await screen.findByRole('alert')).textContent).toContain('Outstanding quantities changed')
  expect(writes).toHaveLength(0)
  fireEvent.click(await ready('Recheck full receipt'))
  fireEvent.click(await ready('Confirm Receipt'))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(
    (writes[0].body as { items: { receivedQuantity: string }[] }).items[0].receivedQuantity,
  ).toBe('0.01')
})

it.each(['missing', 'duplicate', 'zero'] as const)(
  'blocks unsafe full receiving when balances are %s',
  async (kind) => {
    if (kind === 'duplicate')
      overrideGet('/purchase-orders/2', {
        id: 2,
        status: 'CONFIRMED',
        items: [
          { id: 25, inventoryItemId: 5, quantity: '1.00' },
          { id: 25, inventoryItemId: 5, quantity: '1.00' },
        ],
      })
    else
      overrideGet('/incoming-deliveries', {
        items: [
          {
            ...incoming,
            id: 99,
            status: 'COMPLETED',
            items: [
              {
                id: 250,
                purchaseOrderItemId: 25,
                ...(kind === 'zero' ? { acceptedQuantity: '100.00' } : {}),
              },
              { id: 251, purchaseOrderItemId: 26, acceptedQuantity: '10.00' },
            ],
          },
        ],
        nextCursor: null,
      })
    mount(<ReceiveProductsModal delivery={incoming} onClose={vi.fn()} />)
    if (kind === 'zero') {
      await chooseReceipt('all')
      expect((await screen.findByRole('alert')).textContent).toContain('No positive outstanding')
    } else {
      await waitFor(() =>
        expect(screen.getByRole('radio', { name: 'No goods arrived' }).matches(':disabled')).toBe(
          false,
        ),
      )
      expect(
        screen
          .getByRole('radio', { name: 'All remaining goods arrived in good condition' })
          .matches(':disabled'),
      ).toBe(true)
    }
    expect(screen.getByRole('button', { name: 'Confirm Receipt' }).hasAttribute('disabled')).toBe(
      true,
    )
    expect(writes).toHaveLength(0)
  },
)

it.each(['permission', 'status'] as const)(
  'preserves receiving %s restrictions',
  async (restriction) => {
    if (restriction === 'permission') receiptAuth.isAdmin = false
    else overrideGet('/incoming-deliveries/1', { ...incoming, status: 'COMPLETED' })
    mount(<ReceiveProductsModal delivery={incoming} onClose={vi.fn()} />)
    await screen.findByText('Test Supplier')
    expect(screen.getAllByRole('radio').every((radio) => radio.matches(':disabled'))).toBe(true)
    expect(writes).toHaveLength(0)
  },
)

it('uses scoped green choice styling and keyboard focus for incoming controls', async () => {
  mount(<ReceiveProductsModal delivery={incoming} onClose={vi.fn()} />)
  await chooseReceipt('none')
  const radio = screen.getByRole('radio', { name: 'No goods arrived' })
  expect(radio.className).toContain('appearance-none')
  expect(radio.className).toContain('checked:bg-primary')
  expect(radio.className).toContain('focus-visible:ring-2')
  expect(radio.parentElement?.className).toContain('has-[:checked]:border-primary')
  const user = userEvent.setup()
  radio.focus()
  await user.keyboard('{ArrowUp}')
  expect(
    (screen.getByRole('radio', { name: 'Some goods arrived or were damaged' }) as HTMLInputElement)
      .checked,
  ).toBe(true)
})

it('keeps outgoing choices neutral until selected, with green selection and keyboard focus tokens', async () => {
  mount(<CompleteDeliveryModal runId={40} deliveryId={8} onClose={vi.fn()} />)
  await chooseOutcome(true)
  const selected = screen.getByRole('radio', { name: 'Yes, everything was delivered' })
  const other = screen.getByRole('radio', { name: 'No, there were returns or missing goods' })
  expect((selected as HTMLInputElement).checked).toBe(true)
  expect((other as HTMLInputElement).checked).toBe(false)
  expect(selected.className).toContain('appearance-none')
  expect(selected.className).toContain('checked:bg-primary')
  expect(selected.className).toContain('focus-visible:ring-2')
  expect(other.className).toContain('border-input')
  expect(selected.parentElement?.className).toContain('has-[:checked]:bg-primary/5')
})

it('records independent exact receipt quantities and checks capacity again before partial submission', async () => {
  let accepted = '0.00'
  overrideGet('/incoming-deliveries', () => ({
    items: [
      {
        ...incoming,
        id: 99,
        status: 'COMPLETED',
        items: [{ id: 250, purchaseOrderItemId: 25, acceptedQuantity: accepted }],
      },
    ],
    nextCursor: null,
  }))
  mount(<ReceiveProductsModal delivery={incoming} onClose={vi.fn()} />)
  await chooseReceipt('partial')
  value('Received now for Rice (1)', '1.01')
  value('Damaged now for Rice (1)', '0.01')
  value('Received now for Rice (2)', '2.22')
  value('Damaged now for Rice (2)', '0.22')
  accepted = '99.50'
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
  await screen.findByText(
    'Review the received and damaged quantities against current outstanding goods.',
  )
  expect(writes).toHaveLength(0)
  expect((screen.getByLabelText('Received now for Rice (1)') as HTMLInputElement).value).toBe(
    '1.01',
  )
  value('Received now for Rice (1)', '0.51')
  fireEvent.click(await ready('Confirm Receipt'))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toEqual({
    expectedRevision: 4,
    items: [
      { purchaseOrderItemId: 25, receivedQuantity: '0.51', damagedQuantity: '0.01' },
      { purchaseOrderItemId: 26, receivedQuantity: '2.22', damagedQuantity: '0.22' },
    ],
  })
})
