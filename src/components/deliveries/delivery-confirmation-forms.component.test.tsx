import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError, getAdapter } from 'axios'
import type { ReactNode } from 'react'
import { apiClient } from '@/lib/api-client'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
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
  deliveryVehicleId: 6,
  driverEmployeeId: 7,
  plannedItems: [{ id: 10, salesOrderItemId: 15, plannedQuantity: '2.00' }],
  items: [
    { id: 11, salesOrderItemId: 15, stockItemId: 22, quantity: '2.00', loadedQuantity: '2.00' },
  ],
} as unknown as OutgoingDeliveryRecord
let writes: { url?: string; body: unknown }[]
let fail: boolean
beforeEach(() => {
  receiptAuth.isAdmin = true
  receiptAuth.isManager = false
  writes = []
  fail = false
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
    } else if (config.url === '/incoming-deliveries/1') data = incoming
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
        deliveryAddress: 'Market Street',
        items: [{ id: 15, inventoryItemId: 5, quantity: '3.00' }],
      }
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
    if (
      config.method === 'get' &&
      [
        '/incoming-deliveries',
        '/outgoing-deliveries',
        '/sales-orders',
        '/purchase-orders',
      ].includes(config.url ?? '')
    )
      data = { items: data, nextCursor: null }
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
  apiClient.defaults.adapter = (config) =>
    config.method === 'get' && config.url === url
      ? Promise.resolve({
          config,
          data: typeof data === 'function' ? data() : data,
          status: 200,
          statusText: '',
          headers: {},
        })
      : base(config)
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
  expect(writes[0].body).toEqual({ items: [], noReceiptReason: 'Supplier did not arrive' })
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
  const client = mount(<CompleteDeliveryModal deliveryId={8} onClose={close} />)
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
  mount(<CompleteDeliveryModal deliveryId={9} onClose={vi.fn()} />)
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

it('dispatches explicit actual quantities from the scheduled warehouse, not the first matching product', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = (config) =>
    config.url === '/outgoing-deliveries/8' && config.method === 'get'
      ? Promise.resolve({
          config,
          data: { ...outgoing, items: [] },
          status: 200,
          statusText: '',
          headers: {},
        })
      : base(config)
  const close = vi.fn()
  mount(<DispatchDeliveryModal delivery={outgoing} open onClose={close} />)
  await ready('Use Planned Quantities')
  const button = screen.getByRole('button', { name: 'Confirm Dispatch' })
  expect(button.hasAttribute('disabled')).toBe(true)
  value('Actually loaded for Rice', '2.01')
  fireEvent.click(button)
  expect(writes).toHaveLength(0)
  value('Actually loaded for Rice', '1.5')
  fireEvent.click(button)
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes[0].body).toEqual({
    deliveryVehicleId: 6,
    driverEmployeeId: 7,
    items: [{ salesOrderItemId: 15, stockItemId: 22, loadedQuantity: '1.50' }],
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

it('rejects duplicate scheduled lines before dispatch and refreshes dispatch conflicts', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  let duplicate = true
  apiClient.defaults.adapter = (config) =>
    config.url === '/outgoing-deliveries/8' && config.method === 'get'
      ? Promise.resolve({
          config,
          data: {
            ...outgoing,
            items: [],
            plannedItems: duplicate
              ? [...outgoing.plannedItems, { ...outgoing.plannedItems[0], id: 12 }]
              : outgoing.plannedItems,
          },
          status: 200,
          statusText: '',
          headers: {},
        })
      : base(config)
  const close = vi.fn()
  const client = mount(<DispatchDeliveryModal delivery={outgoing} open onClose={close} />)
  await ready('Use Planned Quantities')
  fireEvent.change(screen.getAllByLabelText('Actually loaded for Rice')[0], {
    target: { value: '1' },
  })
  fireEvent.click(await ready('Confirm Dispatch'))
  expect((await screen.findByRole('alert')).textContent).toMatch(/duplicated/i)
  expect(writes).toHaveLength(0)
  duplicate = false
  await client.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
  await ready('Use Planned Quantities')
  value('Actually loaded for Rice', '1')
  fail = true
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Dispatch' }))
  expect((await screen.findByRole('alert')).textContent).toContain('Counts changed')
  expect(close).not.toHaveBeenCalled()
  expect(client.getQueryState(['outgoing-deliveries', 'check'])?.isInvalidated).toBe(true)
})

it('uses planned quantities without submitting, keeps them editable, and shows recognizable products', async () => {
  overrideGet('/outgoing-deliveries/8', { ...outgoing, items: [] })
  mount(<DispatchDeliveryModal delivery={outgoing} open onClose={vi.fn()} />)
  fireEvent.click(await ready('Use Planned Quantities'))
  expect((screen.getByLabelText('Actually loaded for Rice') as HTMLInputElement).value).toBe('2.00')
  expect(screen.getByText('Main · Jasmine · kg')).toBeTruthy()
  expect(screen.getByText('Market Street')).toBeTruthy()
  expect(screen.getByText('Main')).toBeTruthy()
  expect(screen.getByRole('dialog').textContent).not.toMatch(/Stock #|Order line #|\?/)
  expect(writes).toHaveLength(0)
  value('Actually loaded for Rice', '0.75')
  fireEvent.click(await ready('Confirm Dispatch'))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toMatchObject({ items: [{ loadedQuantity: '0.75', stockItemId: 22 }] })
})

it('rejects the planned shortcut when capacity falls and preserves actual input instead of clamping', async () => {
  overrideGet('/outgoing-deliveries/8', { ...outgoing, items: [] })
  overrideGet('/stock-items', [
    {
      id: 22,
      inventoryItemId: 5,
      warehouseId: 3,
      quantity: '1.25',
      availableQuantity: '1.25',
      inventoryItem: { name: 'Rice' },
      warehouse: { name: 'Main' },
    },
  ])
  mount(<DispatchDeliveryModal delivery={outgoing} open onClose={vi.fn()} />)
  await ready('Use Planned Quantities')
  value('Actually loaded for Rice', '1')
  fireEvent.click(screen.getByRole('button', { name: 'Use Planned Quantities' }))
  expect((await screen.findByRole('alert')).textContent).toMatch(/planned quantities exceed/)
  expect((screen.getByLabelText('Actually loaded for Rice') as HTMLInputElement).value).toBe('1')
  value('Actually loaded for Rice', '1.26')
  expect(screen.getByText(/Loading limit: 1.25 kg/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Confirm Dispatch' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(writes).toHaveLength(0)
})

it('requires available vehicle and driver selections and preserves their dispatch IDs', async () => {
  const scheduled = { ...outgoing, items: [], deliveryVehicleId: null, driverEmployeeId: null }
  overrideGet('/outgoing-deliveries/8', scheduled)
  overrideGet('/delivery-vehicles', [
    {
      id: 6,
      plateNumber: 'ABC-6',
      model: 'Toyota Hiace',
      vehicleType: 'VAN',
      isActive: true,
      status: 'AVAILABLE',
    },
    { id: 9, plateNumber: 'BUSY-9', vehicleType: 'TRUCK', isActive: true, status: 'MAINTENANCE' },
  ])
  mount(<DispatchDeliveryModal delivery={scheduled} open onClose={vi.fn()} />)
  fireEvent.click(await ready('Use Planned Quantities'))
  const button = screen.getByRole('button', { name: 'Confirm Dispatch' })
  expect(button.hasAttribute('disabled')).toBe(true)
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Vehicle' }))
  expect(screen.getByRole('option', { name: /BUSY-9/ }).getAttribute('aria-disabled')).toBe('true')
  await user.click(screen.getByRole('option', { name: /ABC-6/ }))
  expect(button.hasAttribute('disabled')).toBe(true)
  await user.click(screen.getByRole('combobox', { name: 'Driver' }))
  await user.click(screen.getByRole('option', { name: /Test Driver/ }))
  await user.click(button)
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toMatchObject({ deliveryVehicleId: 6, driverEmployeeId: 7 })
})

it('keeps long assignment labels available on hover and supports keyboard selection and dispatch', async () => {
  const scheduled = { ...outgoing, items: [], deliveryVehicleId: null, driverEmployeeId: null }
  const model = 'Toyota Hiace refrigerated delivery vehicle for regional distribution'
  const driver = 'Alexandria Longlastname Regional Delivery Officer'
  overrideGet('/outgoing-deliveries/8', scheduled)
  overrideGet('/delivery-vehicles', [
    { id: 9, plateNumber: 'BUSY-9', vehicleType: 'TRUCK', isActive: true, status: 'MAINTENANCE' },
    { id: 6, plateNumber: 'ABC-6', model, vehicleType: 'VAN', isActive: true, status: 'AVAILABLE' },
  ])
  overrideGet('/employees', [
    { id: 9, firstName: 'Inactive', lastName: 'Driver', isActive: false },
    {
      id: 7,
      firstName: 'Alexandria',
      lastName: 'Longlastname Regional Delivery Officer',
      isActive: true,
    },
  ])
  mount(<DispatchDeliveryModal delivery={scheduled} open onClose={vi.fn()} />)
  fireEvent.click(await ready('Use Planned Quantities'))
  const user = userEvent.setup()
  const vehicleTrigger = screen.getByRole('combobox', { name: 'Vehicle' })
  vehicleTrigger.focus()
  await user.keyboard('{Enter}')
  expect(screen.getByRole('option', { name: /BUSY-9/ }).getAttribute('aria-disabled')).toBe('true')
  await user.keyboard('{Home}{Enter}')
  expect(vehicleTrigger.textContent).toContain(model)
  expect(vehicleTrigger.querySelector('[title]')?.getAttribute('title')).toBe(`ABC-6 · ${model}`)
  const driverTrigger = screen.getByRole('combobox', { name: 'Driver' })
  driverTrigger.focus()
  await user.keyboard('{Enter}')
  expect(
    screen.getByRole('option', { name: /Inactive Driver/ }).getAttribute('aria-disabled'),
  ).toBe('true')
  await user.keyboard('{Home}{Enter}')
  expect(driverTrigger.textContent).toContain(driver)
  expect(driverTrigger.querySelector('[title]')?.getAttribute('title')).toBe(driver)
  fireEvent.click(await ready('Confirm Dispatch'))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0]).toEqual({
    url: '/outgoing-deliveries/8/dispatch',
    body: {
      deliveryVehicleId: 6,
      driverEmployeeId: 7,
      items: [{ salesOrderItemId: 15, stockItemId: 22, loadedQuantity: '2.00' }],
    },
  })
})

it('starts completion with neither outcome selected and sends the explicit all-delivered payload only on confirmation', async () => {
  mount(<CompleteDeliveryModal deliveryId={8} onClose={vi.fn()} />)
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
    url: '/outgoing-deliveries/8/complete',
    body: {
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
  mount(<CompleteDeliveryModal deliveryId={8} onClose={vi.fn()} />)
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
  mount(<CompleteDeliveryModal deliveryId={8} onClose={vi.fn()} />)
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
  const client = mount(<CompleteDeliveryModal deliveryId={8} onClose={close} />)
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
  const client = mount(<CompleteDeliveryModal deliveryId={8} onClose={vi.fn()} />)
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
  mount(<CompleteDeliveryModal deliveryId={8} onClose={vi.fn()} />)
  expect(await screen.findByText('Product unavailable')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Confirm Completion' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(screen.getByRole('dialog').textContent).not.toMatch(/Line #|Stock #/)
  expect(writes).toHaveLength(0)
})

it('keeps dispatch input and blocks confirmation when current stock changes during editing', async () => {
  overrideGet('/outgoing-deliveries/8', { ...outgoing, items: [] })
  let available = '3.00'
  overrideGet('/stock-items', () => [
    {
      id: 22,
      inventoryItemId: 5,
      warehouseId: 3,
      quantity: '3.00',
      availableQuantity: available,
      inventoryItem: { name: 'Rice' },
      warehouse: { name: 'Main' },
    },
  ])
  const client = mount(<DispatchDeliveryModal delivery={outgoing} open onClose={vi.fn()} />)
  fireEvent.click(await ready('Use Planned Quantities'))
  await ready('Confirm Dispatch')
  available = '1.00'
  await client.invalidateQueries({ queryKey: ['stock-items'] })
  expect(await screen.findByText(/Loading limit: 1 kg/)).toBeTruthy()
  expect((screen.getByLabelText('Actually loaded for Rice') as HTMLInputElement).value).toBe('2.00')
  expect(screen.getByRole('button', { name: 'Confirm Dispatch' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(writes).toHaveLength(0)
})

it('prevents duplicate dispatch while the inventory mutation is pending', async () => {
  overrideGet('/outgoing-deliveries/8', { ...outgoing, items: [] })
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
  mount(<DispatchDeliveryModal delivery={outgoing} open onClose={close} />)
  fireEvent.click(await ready('Use Planned Quantities'))
  const button = await ready('Confirm Dispatch')
  fireEvent.submit(button.closest('form')!)
  fireEvent.submit(button.closest('form')!)
  await waitFor(() => expect(button.hasAttribute('disabled')).toBe(true))
  expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
  release()
  await waitFor(() => expect(close).toHaveBeenCalledOnce())
  expect(writes).toHaveLength(1)
})

it('rejects invalid reconciliation decimals without silently allocating the difference', async () => {
  mount(<CompleteDeliveryModal deliveryId={8} onClose={vi.fn()} />)
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
  mount(<CompleteDeliveryModal deliveryId={8} onClose={close} />)
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
  expect(writes[0].body).toEqual({ items: [], noReceiptReason: 'No delivery' })
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
  mount(<CompleteDeliveryModal deliveryId={8} onClose={vi.fn()} />)
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
    items: [
      { purchaseOrderItemId: 25, receivedQuantity: '0.51', damagedQuantity: '0.01' },
      { purchaseOrderItemId: 26, receivedQuantity: '2.22', damagedQuantity: '0.22' },
    ],
  })
})
