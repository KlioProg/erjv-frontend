import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient, getErrorMessage } from '@/lib/api-client'
import { getAdapter } from 'axios'
import { CompleteDeliveryModal } from './shared/CompleteDeliveryModal'
import { DeliveryRunsHub } from './DeliveryRunsHub'
import { MemoryRouter } from 'react-router'
import { toast } from 'sonner'
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
async function reasonInput(product = 'Banana') {
  const reasonToggle = await screen.findByRole('button', { name: `Reason for ${product}` })
  if (reasonToggle.getAttribute('aria-expanded') === 'false') {
    reasonToggle.focus()
    await userEvent.keyboard('{Enter}')
  }
  expect(reasonToggle.getAttribute('aria-expanded')).toBe('true')
  return screen.getByLabelText(
    `Reason for Difference for ${product} (${product === 'Banana' ? 1 : 2})`,
  ) as HTMLInputElement
}
const button = () => screen.getByRole('button', { name: /Review Results|Save Results|Saving/ })
function mount() {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      <CompleteDeliveryModal runId={40} deliveryId={90} onClose={onClose} onSaved={onSaved} />
    </QueryClientProvider>,
  )
  return { client, onClose, onSaved }
}
async function choose(all = true) {
  const radio = screen.getByRole('radio', {
    name: all ? 'All items delivered' : 'Some items were returned or missing',
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
    for (const category of ['Delivered', 'Returned in good condition', 'Returned damaged', 'Missing'])
      fireEvent.change(input(category, product), {
        target: { value: category === 'Delivered' ? quantity : '0' },
      })
}
function submit() {
  fireEvent.submit(button().closest('form')!)
  if (screen.queryByRole('button', { name: 'Save Results' }))
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
    ['Returned in good condition', '0.25'],
    ['Returned damaged', '0.50'],
    ['Missing', '0.50'],
    ['Reason for Difference', ' Torn bag and missing stock '],
  ]) {
    const field = category === 'Reason for Difference' ? await reasonInput() : input(category)
    fireEvent.change(field, { target: { value } })
  }
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
    expect((await reasonInput()).required).toBe(true)
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
  expect(await screen.findByText(/no longer marked as dispatched/)).toBeTruthy()
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
    expect(await screen.findByText(/Trip membership, revision, or status changed/)).toBeTruthy()
    expect(button().hasAttribute('disabled')).toBe(true)
    expect(writes).toHaveLength(0)
  },
)
it('retains unsent exceptions when switching to full delivery requires confirmation', async () => {
  mount()
  await fill()
  fireEvent.change(input(), { target: { value: '1.25' } })
  fireEvent.change(input('Returned damaged'), { target: { value: '1.00' } })
  fireEvent.change(await reasonInput(), { target: { value: 'Damaged packaging' } })
  await choose()
  expect(screen.getByRole('button', { name: 'Keep exceptions' })).toBeTruthy()
  expect(writes).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Confirm everything delivered' }))
  await choose(false)
  expect(input('Returned damaged').value).toBe('1.00')
  expect((await reasonInput()).value).toBe('Damaged packaging')
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
  const radio = screen.getByRole('radio', { name: 'All items delivered' })
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


it('shows one exact loaded-quantity review and saves only after explicit confirmation', async () => {
  const { onSaved } = mount()
  await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Review Results' }))
  const review = within(screen.getByRole('region', { name: 'Review delivery results' }))
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  expect(screen.getByRole('dialog').textContent).toContain('Saved customer')
  const rows = review.getAllByRole('row').slice(1)
  expect(within(rows[0]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Banana (kg)', '2.25', '2.25', '0', '0', '0'])
  expect(within(rows[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Mango (boxes)', '1', '1', '0', '0', '0'])
  expect(writes).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Save Results' }))
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ delivery: expect.objectContaining({ id: 90, status: 'RECONCILED' }), run: expect.objectContaining({ id: 40, status: 'COMPLETED' }) }))
})

it('carries explicit all-delivered quantities into individual corrections and keeps them through review', async () => {
  mount()
  await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Edit Quantities' }))
  expect(input().value).toBe('2.25')
  expect(input('Delivered', 'Mango').value).toBe('1.00')
  expect(input('Missing').value).toBe('0.00')
  fireEvent.change(input(), { target: { value: '1.75' } })
  fireEvent.change(input('Returned in good condition'), { target: { value: '0.50' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review Results' }))
  expect(writes).toHaveLength(0)
  const review = within(screen.getByRole('region', { name: 'Review delivery results' }))
  expect(within(review.getAllByRole('row')[1]).getAllByRole('cell').map((cell) => cell.textContent)).toEqual(['Banana (kg)', '2.25', '1.75', '0.5', '0', '0'])
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(input().value).toBe('1.75')
  expect(input('Returned in good condition').value).toBe('0.50')
  submit()
  await waitFor(() => expect(writes).toHaveLength(1))
  expect((writes[0].body.items as Record<string, unknown>[])[0]).toMatchObject({ deliveredQuantity: '1.75', returnedSellableQuantity: '0.50', returnedDamagedQuantity: '0.00', missingQuantity: '0.00' })
})

it('invalidates a reviewed result when the loaded revision changes and makes no automatic request', async () => {
  const { client } = mount()
  await choose()
  fireEvent.click(screen.getByRole('button', { name: 'Review Results' }))
  expect(screen.getByRole('button', { name: 'Save Results' })).toBeTruthy()
  delivery = { ...delivery, revision: 5 }
  run = { ...run, revision: 3, deliveries: run.deliveries.map((member) => ({ ...member, revision: 5 })) }
  await act(async () => {
    await client.invalidateQueries({ queryKey: ['outgoing-deliveries'] })
    await client.invalidateQueries({ queryKey: ['delivery-runs'] })
  })
  await screen.findByText(/Loaded quantities changed/)
  expect(screen.queryByRole('button', { name: 'Save Results' })).toBeNull()
  expect(screen.getByRole('button', { name: 'Review Results' }).hasAttribute('disabled')).toBe(true)
  expect(writes).toHaveLength(0)
})

it('rejects an inconsistent member confirmation without reporting success or advancing the trip', async () => {
  const success = vi.spyOn(toast, 'success')
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    const response = await base(config)
    if (config.method === 'patch') return { ...response, data: { ...response.data, run: { ...response.data.run, deliveries: [] } } }
    return response
  }
  const { onSaved, onClose } = mount()
  await choose()
  submit()
  await screen.findByText(/Delivery results were not confirmed/)
  expect(onSaved).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
  expect(success).not.toHaveBeenCalled()
  expect(writes).toHaveLength(1)
})

it.each([true, false])('records trip members independently and uses backend completion=%s', async (completes) => {
  run = { ...run, driverEmployeeId: null, deliveryVehicleId: null,
    deliveries: [...run.deliveries, { ...run.deliveries[0], id: 91, deliveryNumber: 'OD-91' }] }
  const memberDeliveries = [structuredClone(delivery), { ...structuredClone(delivery), id: 91, deliveryNumber: 'OD-91', items: delivery.items.map((item) => ({ ...item, id: item.id + 100, outgoingDeliveryId: 91 })) }]
  const base = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    let data: unknown
    if (config.method === 'get' && url === '/delivery-runs') data = { items: [run], nextCursor: null }
    else if (config.method === 'get' && /^\/outgoing-deliveries\/9[01]$/.test(url)) data = memberDeliveries.find((member) => url.endsWith(`/${member.id}`))
    else if (config.method === 'patch' && url.endsWith('/reconcile')) {
      const member = memberDeliveries.find((entry) => url.includes(`/deliveries/${entry.id}/`))!
      writes.push({ url, body: JSON.parse(config.data) })
      member.status = 'RECONCILED'
      member.revision++
      member.reconciledAt = '2026-11-05T08:00:00Z'
      run = { ...run, revision: run.revision + 1, deliveries: run.deliveries.map((entry) => entry.id === member.id ? { ...entry, revision: member.revision, status: 'RECONCILED' } : entry) }
      if (completes && run.deliveries.every((entry) => entry.status === 'RECONCILED')) run.status = 'COMPLETED'
      data = { delivery: member, run }
    } else return base(config)
    return { config, data: structuredClone(data), status: 200, statusText: '', headers: {} }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/deliveries/runs?run=40']}><DeliveryRunsHub /></MemoryRouter></QueryClientProvider>)
  const user = userEvent.setup()
  const trip = within(await screen.findByRole('dialog', { name: 'Delivery Trip RUN-40' }))
  await trip.findByText('0 of 2 deliveries recorded')
  await user.click(trip.getByRole('radio', { name: 'Select OD-90 for results' }))
  await user.click(within(trip.getByRole('group', { name: 'Trip actions' })).getByRole('button', { name: 'Record Results' }))
  expect(screen.queryByRole('dialog', { name: 'Delivery Trip RUN-40' })).toBeNull()
  expect(screen.getAllByRole('dialog')).toHaveLength(1)
  await choose()
  submit()
  const afterFirst = within(await screen.findByRole('dialog', { name: 'Delivery Trip RUN-40' }))
  await afterFirst.findByText('1 of 2 deliveries recorded')
  expect(afterFirst.getByText('Results saved for OD-90. 1 delivery still needs results.')).toBeTruthy()
  expect(memberDeliveries[1].status).toBe('DISPATCHED')
  expect(writes).toHaveLength(1)
  expect(afterFirst.getAllByRole('button', { name: 'Record Results' })).toHaveLength(1)
  expect(afterFirst.queryByRole('radio')).toBeNull()
  expect(afterFirst.getByText('Delivery: OD-91')).toBeTruthy()
  await user.click(within(afterFirst.getByRole('group', { name: 'Trip actions' })).getByRole('button', { name: 'Record Results' }))
  await screen.findByRole('dialog', { name: 'Record Delivery Results' })
  expect(screen.getByRole('dialog').textContent).toContain('OD-91')
  expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)
  await choose()
  submit()
  const afterBoth = within(await screen.findByRole('dialog', { name: 'Delivery Trip RUN-40' }))
  await afterBoth.findByText('2 of 2 deliveries recorded')
  expect(afterBoth.queryByRole('button', { name: 'Record Next' })).toBeNull()
  expect(afterBoth.queryByRole('button', { name: 'Record Results' })).toBeNull()
  expect(afterBoth.queryByRole('group', { name: 'Trip actions' })).toBeNull()
  expect(run.status).toBe(completes ? 'COMPLETED' : 'DISPATCHED')
  expect(within(afterBoth.getByRole('heading', { name: 'Delivery Trip RUN-40' }).parentElement!).queryByText('Completed') !== null).toBe(completes)
  expect(writes.map((entry) => entry.url)).toEqual(['/delivery-runs/40/deliveries/90/reconcile', '/delivery-runs/40/deliveries/91/reconcile'])
  client.clear()
})
