import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient, getErrorMessage } from '@/lib/api-client'
import { getAdapter } from 'axios'
import { CompleteDeliveryModal } from './shared/CompleteDeliveryModal'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const original = apiClient.defaults.adapter
let delivery: OutgoingDeliveryRecord
let run: DeliveryRunRecord
let writes: { url: string; body: Record<string, unknown> }[]
let failure: number | 'network' | undefined
let gate: Promise<void> | undefined
let unconfirmed: boolean
let missingProduct: boolean
const dates = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
const input = (category = 'Delivered', product = 'Banana') =>
  screen.getByLabelText(
    `${category} for ${product} (${product === 'Banana' ? 1 : 2})`,
  ) as HTMLInputElement
const button = () => screen.getByRole('button', { name: /Confirm Completion|Completing/ })
function mount() {
  const onClose = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CompleteDeliveryModal runId={40} deliveryId={90} onClose={onClose} />
    </QueryClientProvider>,
  )
  return { client, onClose }
}
async function choose(all = true) {
  const radio = screen.getByRole('radio', {
    name: all ? 'Yes, everything was delivered' : 'No, there were returns or missing goods',
  })
  await waitFor(() => expect(radio.matches(':disabled')).toBe(false))
  fireEvent.click(radio)
}
async function fill() {
  await choose(false)
  for (const [product, quantity] of [
    ['Banana', '2.25'],
    ['Mango', '1.00'],
  ])
    for (const category of ['Delivered', 'Returned sellable', 'Returned damaged', 'Missing'])
      fireEvent.change(input(category, product), {
        target: { value: category === 'Delivered' ? quantity : '0' },
      })
}
function submit() {
  fireEvent.submit(button().closest('form')!)
}
beforeEach(() => {
  auth.isAdmin = true
  auth.isManager = false
  auth.isStaff = false
  writes = []
  failure = undefined
  gate = undefined
  unconfirmed = false
  missingProduct = false
  delivery = {
    id: 90,
    deliveryNumber: 'OD-90',
    salesOrderId: 7,
    warehouseId: 2,
    revision: 4,
    runId: 40,
    reconciledAt: null,
    reconciledByUserId: null,
    fulfillmentOutcome: null,
    hasDamage: false,
    hasMissing: false,
    status: 'DISPATCHED',
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
  run = {
    id: 40,
    runNumber: 'RUN-40',
    revision: 2,
    status: 'DISPATCHED',
    warehouseId: 2,
    driverEmployeeId: 9,
    deliveryVehicleId: 8,
    scheduledDepartureAt: dates.createdAt,
    dispatchedAt: dates.createdAt,
    completedAt: null,
    cancelledAt: null,
    departureConfirmedByUserId: 1,
    loadedWeightKg: '50.00',
    capacityKgAtDeparture: '100.00',
    notes: null,
    ...dates,
    deliveries: [
      {
        id: 90,
        deliveryNumber: 'OD-90',
        revision: 4,
        status: 'DISPATCHED',
        salesOrderId: 7,
        warehouseId: 2,
      },
    ],
  }
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    let data: unknown
    if (config.method === 'get') {
      if (url === '/delivery-runs/40') data = run
      else if (url === '/outgoing-deliveries/90') data = delivery
      else if (url === '/sales-orders/7')
        data = {
          id: 7,
          clientId: 70,
          items: [
            { id: 10, inventoryItemId: 1 },
            { id: 20, inventoryItemId: 2 },
          ],
        }
      else if (url === '/inventory-items' || /^\/inventory-items\/\d+$/.test(url))
        data = missingProduct
          ? []
          : [
              { id: 1, name: 'Banana', unit: 'kg' },
              { id: 2, name: 'Mango', unit: 'boxes' },
            ]
      else if (url === '/warehouses/2') data = { id: 2, name: 'Saved warehouse', isActive: true }
      else if (url === '/warehouses') data = [{ id: 2, name: 'Saved warehouse', isActive: true }]
      else if (url === '/clients/70') data = { id: 70, name: 'Saved customer' }
      else if (url === '/clients') data = [{ id: 70, name: 'Saved customer' }]
      else throw new Error(`Unexpected request ${url}`)
    } else {
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
      const confirmed = {
        ...delivery,
        revision: delivery.revision + 1,
        status: unconfirmed ? 'DISPATCHED' : 'RECONCILED',
        reconciledAt: unconfirmed ? null : '2026-10-21T08:00:00Z',
      }
      delivery = confirmed as OutgoingDeliveryRecord
      run = {
        ...run,
        revision: run.revision + 1,
        status: 'COMPLETED',
        deliveries: run.deliveries.map((member) => ({
          ...member,
          revision: 5,
          status: 'RECONCILED',
        })),
      }
      data = { delivery, run }
    }
    if (/^\/inventory-items\/\d+$/.test(url) && Array.isArray(data)) data = data.find((item) => item.id === Number(url.split('/').pop())) ?? null
    return { config, data: structuredClone(data), status: 200, statusText: '', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = original
  vi.restoreAllMocks()
})

it('loads actual persisted quantities instead of plans and waits for an explicit outcome', async () => {
  mount()
  await screen.findByText('Banana')
  expect(screen.getByText('2.25 kg loaded')).toBeTruthy()
  expect(screen.getByText('1 boxes loaded')).toBeTruthy()
  expect(screen.getByRole('dialog').textContent).toContain('Saved warehouse')
  expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(
    true,
  )
  expect(writes).toHaveLength(0)
  expect(screen.queryByRole('textbox')).toBeNull()
})
it('records explicit all-delivered counts with member revision and updates both detail caches', async () => {
  const { client, onClose } = mount()
  const keys = [
    'stock-items',
    'quarantine-lots',
    'delivery-vehicles',
    'sales-orders',
    'staffing',
    'products',
    'warehouses',
  ]
  keys.forEach((key) => client.setQueryData([key, 'check'], []))
  await choose()
  expect(writes).toHaveLength(0)
  submit()
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(writes).toEqual([
    {
      url: '/delivery-runs/40/deliveries/90/reconcile',
      body: {
        expectedRevision: 4,
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
      },
    },
  ])
  expect(
    client.getQueryData<OutgoingDeliveryRecord>(['outgoing-deliveries', 'id', 90])?.status,
  ).toBe('RECONCILED')
  expect(client.getQueryData<DeliveryRunRecord>(['delivery-runs', 'id', 40])?.status).toBe(
    'COMPLETED',
  )
  keys.forEach((key) => expect(client.getQueryState([key, 'check'])?.isInvalidated).toBe(true))
})
it('sends delivered, sellable, damaged and missing categories exactly with a trimmed reason', async () => {
  const { onClose } = mount()
  await fill()
  for (const [category, value] of [
    ['Delivered', '1.00'],
    ['Returned sellable', '0.25'],
    ['Returned damaged', '0.50'],
    ['Missing', '0.50'],
    ['Discrepancy Reason', ' Torn bag and missing stock '],
  ])
    fireEvent.change(input(category), { target: { value } })
  submit()
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect((writes[0].body.items as unknown[])[0]).toEqual({
    outgoingDeliveryItemId: 901,
    deliveredQuantity: '1.00',
    returnedSellableQuantity: '0.25',
    returnedDamagedQuantity: '0.50',
    missingQuantity: '0.50',
    discrepancyReason: 'Torn bag and missing stock',
  })
})
it.each(['-1', 'abc', '1.001', '1e2', '2.24', '2.26'])(
  'rejects invalid quantities or unbalanced totals %s',
  async (value) => {
    mount()
    await fill()
    fireEvent.change(input(), { target: { value } })
    submit()
    expect(button().hasAttribute('disabled')).toBe(true)
    expect(input().value).toBe(value)
    expect(writes).toHaveLength(0)
    expect(screen.getByText(/Accounted for:.*2.25 kg/).textContent).toMatch(
      /Enter all four|equal the loaded/,
    )
  },
)
it('requires accounting for every loaded product independently', async () => {
  mount()
  await choose(false)
  fireEvent.change(input(), { target: { value: '2.25' } })
  submit()
  expect(button().hasAttribute('disabled')).toBe(true)
  expect(input('Delivered', 'Mango').value).toBe('')
  expect(writes).toHaveLength(0)
})
it.each(['Returned damaged', 'Missing'])(
  'requires a reason for %s and preserves entered counts',
  async (category) => {
    mount()
    await fill()
    fireEvent.change(input(), { target: { value: '1.25' } })
    fireEvent.change(input(category), { target: { value: '1' } })
    submit()
    expect(input('Discrepancy Reason').required).toBe(true)
    expect(button().hasAttribute('disabled')).toBe(true)
    expect(input(category).value).toBe('1')
    expect(writes).toHaveLength(0)
  },
)
it.each(['absent', 'duplicate', 'invalid'] as const)(
  'blocks unsafe persisted loaded lines: %s',
  async (kind) => {
    if (kind === 'absent') delivery.items = []
    if (kind === 'duplicate') delivery.items.push({ ...delivery.items[0] })
    if (kind === 'invalid') delivery.items[0].quantity = 'abc'
    mount()
    expect(await screen.findByText(/Loaded products are missing, repeated/)).toBeTruthy()
    expect(button().hasAttribute('disabled')).toBe(true)
    expect(writes).toHaveLength(0)
  },
)
it('prevents duplicate pending submissions, edits and modal dismissal', async () => {
  let release!: () => void
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { onClose } = mount()
  await fill()
  submit()
  submit()
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(input().matches(':disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Close' }).hasAttribute('disabled')).toBe(true)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => release())
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
})
it.each([400, 403, 404, 409, 'network'] as const)(
  'retains counts after %s and requires explicit refreshed review before retry',
  async (status) => {
    failure = status
    const { onClose } = mount()
    await fill()
    submit()
    const expectedError = getErrorMessage({
      isAxiosError: true,
      response:
        status === 'network'
          ? undefined
          : { status, data: { message: 'Return was already confirmed with different counts' } },
    })
    await screen.findByText(expectedError)
    expect(input().value).toBe('2.25')
    expect(writes).toHaveLength(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(button().hasAttribute('disabled')).toBe(true)
    failure = undefined
    fireEvent.click(screen.getByRole('button', { name: 'Refresh delivery data' }))
    await waitFor(() => expect(button().hasAttribute('disabled')).toBe(false))
    submit()
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(writes).toHaveLength(2)
  },
)
it('does not repeat uncertain reconciliation after refreshed member is already reconciled', async () => {
  failure = 'network'
  mount()
  await fill()
  submit()
  await waitFor(() => expect(button().hasAttribute('disabled')).toBe(true))
  delivery = { ...delivery, status: 'RECONCILED', reconciledAt: '2026-10-21T08:00:00Z' }
  fireEvent.click(screen.getByRole('button', { name: 'Refresh delivery data' }))
  expect(await screen.findByText(/no longer in transit/)).toBeTruthy()
  expect(writes).toHaveLength(1)
})
it('does not close on an incomplete reconciliation confirmation', async () => {
  unconfirmed = true
  const { onClose } = mount()
  await choose()
  submit()
  await waitFor(() =>
    expect(
      screen
        .getAllByRole('alert')
        .some((alert) => /confirm|review|Refresh/.test(alert.textContent ?? '')),
    ).toBe(true),
  )
  expect(onClose).not.toHaveBeenCalled()
  expect(writes).toHaveLength(1)
})
it('preserves role restrictions without selecting an outcome or writing', async () => {
  auth.isAdmin = false
  auth.isStaff = false
  mount()
  expect(await screen.findByText(/do not have permission/)).toBeTruthy()
  expect(screen.getAllByRole('radio').every((radio) => radio.matches(':disabled'))).toBe(true)
  expect(writes).toHaveLength(0)
})
it.each(['run status', 'member revision', 'member removed', 'different run'] as const)(
  'blocks reconciliation after %s changes',
  async (kind) => {
    if (kind === 'run status') run.status = 'COMPLETED'
    if (kind === 'member revision') run.deliveries[0].revision++
    if (kind === 'member removed') run.deliveries = []
    if (kind === 'different run') delivery.runId = 99
    mount()
    expect(await screen.findByText(/run membership, revision, or status changed/)).toBeTruthy()
    expect(button().hasAttribute('disabled')).toBe(true)
    expect(writes).toHaveLength(0)
  },
)
it('retains unsent exceptions when switching to full delivery requires confirmation', async () => {
  mount()
  await fill()
  fireEvent.change(input(), { target: { value: '1.25' } })
  fireEvent.change(input('Returned damaged'), { target: { value: '1.00' } })
  fireEvent.change(input('Discrepancy Reason'), { target: { value: 'Damaged packaging' } })
  await choose()
  expect(screen.getByRole('button', { name: 'Keep exceptions' })).toBeTruthy()
  expect(writes).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Confirm everything delivered' }))
  await choose(false)
  expect(input('Returned damaged').value).toBe('1.00')
  expect(input('Discrepancy Reason').value).toBe('Damaged packaging')
})
it('requires an explicit new outcome after the loaded member revision changes', async () => {
  const { client } = mount()
  await choose()
  delivery = {
    ...delivery,
    revision: 5,
    items: delivery.items.map((line) => ({ ...line, quantity: '1.00' })),
  }
  run.deliveries[0].revision = 5
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
    await client.invalidateQueries({ queryKey: ['delivery-runs'] })
  })
  expect(await screen.findByText(/Loaded quantities changed/)).toBeTruthy()
  expect(button().hasAttribute('disabled')).toBe(true)
  expect(writes).toHaveLength(0)
})
it('does not fabricate product labels when required lookups are absent', async () => {
  missingProduct = true
  mount()
  expect(await screen.findAllByText('Product unavailable')).toHaveLength(2)
  expect(button().hasAttribute('disabled')).toBe(true)
  expect(writes).toHaveLength(0)
})
it('supports keyboard outcome selection, focus trapping and safe Escape dismissal', async () => {
  const { onClose } = mount()
  const radio = screen.getByRole('radio', { name: 'Yes, everything was delivered' })
  await waitFor(() => expect(radio.matches(':disabled')).toBe(false))
  const user = userEvent.setup()
  radio.focus()
  await user.keyboard(' ')
  expect((radio as HTMLInputElement).checked).toBe(true)
  for (let index = 0; index < 8; index++) {
    await user.tab()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  }
  await user.keyboard('{Escape}')
  expect(onClose).toHaveBeenCalledOnce()
  expect(writes).toHaveLength(0)
})

it('allows staff to reconcile an authorized dispatched member delivery', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  const { onClose } = mount()
  await choose()
  submit()
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(writes).toHaveLength(1)
  expect(writes[0].url).toBe('/delivery-runs/40/deliveries/90/reconcile')
})

it('resolves reconciliation metadata by ID when all first-page lists omit the loaded products', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  const reads: string[] = []
  apiClient.defaults.adapter = async (config) => {
    reads.push(config.url ?? '')
    if (['/inventory-items', '/warehouses', '/clients'].includes(config.url ?? ''))
      return { config, data: { items: [], nextCursor: null }, status: 200, statusText: 'OK', headers: {} }
    return adapter(config)
  }
  const { onClose } = mount()
  await choose()
  expect(screen.getByText('Banana')).toBeTruthy()
  expect(screen.getByText('Mango')).toBeTruthy()
  submit()
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
  expect(reads).toContain('/inventory-items/1')
  expect(reads).toContain('/inventory-items/2')
  expect(reads).toContain('/warehouses/2')
  expect(reads.some((url) => ['/inventory-items', '/warehouses', '/clients'].includes(url))).toBe(false)
})

it('binds reconciliation item validation to its original loaded row', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'patch') throw { isAxiosError: true, response: { status: 400, data: { detail: 'Review member reconciliation.', issues: [
      { path: 'items.1.deliveredQuantity', code: 'INVALID', message: 'Review Mango delivery count.' },
    ] } } }
    return base(config)
  }
  const { onClose } = mount()
  await fill()
  submit()
  await waitFor(() => expect(input('Delivered', 'Mango').getAttribute('aria-invalid')).toBe('true'))
  expect(input().getAttribute('aria-invalid')).toBe('false')
  expect(document.getElementById('completion-902-deliveredQuantity-error')?.textContent).toBe('Review Mango delivery count.')
  expect(input('Delivered', 'Mango').value).toBe('1.00')
  expect(onClose).not.toHaveBeenCalled()
})
