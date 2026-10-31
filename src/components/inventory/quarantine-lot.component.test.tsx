import { parseStockCents } from '@/features/logistics/stock-display'
import { decimalString } from '@/features/logistics/purchase-pricing'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AxiosError, getAdapter } from 'axios'
import { apiClient } from '@/lib/api-client'
import type { QuarantineLot, StockItemWithRelations } from '@/features/logistics/stock-items.types'
import { QuarantineLotDialog } from './QuarantineLotDialog'
import { QuarantinedStock } from './QuarantinedStock'

const auth = vi.hoisted(() => ({ isAdmin: false, isManager: true }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const initialLot: QuarantineLot & {
  conditionChanges: import('@/features/logistics/quarantine.types').QuarantineConditionChange[]
  resolutions: import('@/features/logistics/quarantine.types').QuarantineResolution[]
} = {
  revision: 1,
  id: 8,
  stockItemId: 4,
  condition: 'DAMAGED' as const,
  reportedCondition: 'DAMAGED' as const,
  remainingQuantity: '2.00',
  initialQuantity: '3.00',
  sourceKind: 'MANUAL' as const,
  incomingDeliveryItemId: null,
  outgoingDeliveryItemId: null,
  tagReason: 'Shelf damage',
  taggedByUserId: 12,
  requestId: null,
  createdAt: '2026-10-26T08:00:00Z',
  conditionChanges:
    [] as import('@/features/logistics/quarantine.types').QuarantineConditionChange[],
  resolutions: [] as import('@/features/logistics/quarantine.types').QuarantineResolution[],
}
const stock = {
  id: 4,
  inventoryItemId: 1,
  warehouseId: 2,
  onHandQuantity: '10.00',
  revision: 1,
  inTransitQuantity: '0.00',
  reservedQuantity: '0.00',
  quarantinedQuantity: '0.00',
  conditionQuantities: { DAMAGED: '0.00', SPOILED: '0.00' },
  reorderThreshold: null,
  stockStatus: 'NORMAL',
  createdAt: '',
  updatedAt: '',
  availableQuantity: '8.00',
  inventoryItem: { id: 1, name: 'Rice', unit: 'kg' },
  warehouse: { id: 2, name: 'Main Warehouse' },
} as StockItemWithRelations
const originalAdapter = apiClient.defaults.adapter
let lot: typeof initialLot
let writes: { method?: string; url?: string; body: unknown }[]
beforeEach(() => {
  lot = structuredClone(initialLot)
  writes = []
  auth.isAdmin = false
  auth.isManager = true
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'get') {
      const data = config.url?.endsWith('/condition-changes')
        ? { items: lot.conditionChanges, nextCursor: null }
        : config.url?.endsWith('/resolutions')
          ? { items: lot.resolutions, nextCursor: null }
          : config.url?.endsWith('/8')
            ? lot
            : { items: [lot], nextCursor: null }
      return { config, data, status: 200, statusText: '', headers: {} }
    }
    const body = JSON.parse(config.data)
    writes.push({ method: config.method, url: config.url, body })
    if (config.url?.endsWith('/condition'))
      lot = {
        ...lot,
        revision: lot.revision + 1,
        condition: body.condition,
        conditionChanges: [
          ...lot.conditionChanges,
          {
            id: 1,
            lotId: lot.id,
            requestId: body.requestId,
            expectedRevision: body.expectedRevision,
            beforeRevision: lot.revision,
            afterRevision: lot.revision + 1,
            fromCondition: lot.condition,
            toCondition: body.condition,
            reason: body.reason,
            actorUserId: 12,
            createdAt: lot.createdAt,
          },
        ],
      }
    else
      lot = {
        ...lot,
        revision: lot.revision + 1,
        remainingQuantity: decimalString(
          parseStockCents(lot.remainingQuantity)! - parseStockCents(body.quantity)!,
        ),
        resolutions: [{ ...body, id: 1, lotId: lot.id, actorUserId: 12, createdAt: lot.createdAt }],
      }
    return { config, data: lot, status: 200, statusText: '', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})
function mount(stockRecord: StockItemWithRelations | null = stock) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: 3 } },
  })
  for (const key of [
    'stock-items',
    'products',
    'warehouses',
    'outgoing-deliveries',
    'purchase-orders',
  ])
    client.setQueryData([key], [])
  const close = vi.fn()
  return {
    client,
    close,
    ...render(
      <QueryClientProvider client={client}>
        <QuarantineLotDialog selectedLot={initialLot} stock={stockRecord ?? undefined} onClose={close} />
      </QueryClientProvider>,
    ),
  }
}
async function chooseAction(action: 'CLEAR' | 'REMOVE' | 'CORRECT') {
  const label =
    action === 'CLEAR'
      ? /^Release to Available Stock/
      : action === 'REMOVE'
        ? /^Remove from Inventory/
        : /^Correct Condition/
  const button = await screen.findByRole('button', { name: label })
  await waitFor(() => expect(button.matches(':disabled')).toBe(false))
  fireEvent.click(button)
}
function reason(value = 'Inspected') {
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value } })
}
function quantity(value = '1.00', action: 'CLEAR' | 'REMOVE' = 'CLEAR') {
  fireEvent.change(
    screen.getByLabelText(action === 'CLEAR' ? 'Quantity to release' : 'Quantity to remove'),
    { target: { value } },
  )
}
function inspect() {
  fireEvent.click(
    screen.getByLabelText(
      'I confirm these goods have been inspected and are safe to return to available stock.',
    ),
  )
}
async function correction() {
  await chooseAction('CORRECT')
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Corrected condition' }))
  await user.click(screen.getByRole('option', { name: 'Spoiled' }))
  reason()
}

it('starts with explicit choices and hides all action forms until selected', async () => {
  mount()
  await screen.findByText('2.00 kg')
  expect(screen.getByRole('heading', { name: 'Review Quarantined Stock' })).toBeTruthy()
  expect(screen.getByText('Rice')).toBeTruthy()
  expect(screen.getByText('Main Warehouse')).toBeTruthy()
  for (const label of [
    /^Release to Available Stock/,
    /^Remove from Inventory/,
    /^Correct Condition/,
  ])
    expect(screen.getByRole('button', { name: label }).getAttribute('aria-pressed')).toBe('false')
  expect(screen.queryByRole('textbox')).toBeNull()
  expect(writes).toHaveLength(0)
})

it('corrects only to a different condition with a reason and refreshes the authoritative lot', async () => {
  mount()
  await chooseAction('CORRECT')
  reason()
  expect(
    screen.getByRole('button', { name: 'Confirm Condition Correction' }).hasAttribute('disabled'),
  ).toBe(true)
  expect(screen.queryByLabelText('Quantity to release')).toBeNull()
  const user = userEvent.setup()
  await user.click(screen.getByRole('combobox', { name: 'Corrected condition' }))
  await user.click(screen.getByRole('option', { name: 'Spoiled' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Condition Correction' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0]).toEqual({
    method: 'patch',
    url: '/stock-items/quarantine-lots/8/condition',
    body: {
      condition: 'SPOILED',
      reason: 'Inspected',
      expectedRevision: 1,
      requestId: expect.any(String),
    },
  })
  await waitFor(() => expect(screen.queryByLabelText('Reason')).toBeNull())
  expect(screen.getByText('SPOILED')).toBeTruthy()
  expect(screen.getByText('2.00 kg')).toBeTruthy()
  fireEvent.click(screen.getByText('Audit history'))
  expect(screen.getByText(/DAMAGED to SPOILED: Inspected/)).toBeTruthy()
})

it.each(['CLEAR', 'REMOVE'] as const)(
  'preserves partial %s resolution with explicit confirmation and refreshes balances',
  async (action) => {
    const { client } = mount()
    await chooseAction(action)
    quantity('1.00', action)
    reason()
    if (action === 'CLEAR') {
      expect(screen.getByRole('button', { name: 'Confirm Release' }).hasAttribute('disabled')).toBe(
        true,
      )
      inspect()
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Review Removal' }))
      await screen.findByRole('button', { name: 'Confirm Removal' })
      expect(writes).toHaveLength(0)
      expect(screen.getByText(/This decreases physical inventory/)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Removal' }))
    }
    await waitFor(() => expect(writes).toHaveLength(1))
    expect(writes[0]).toEqual({
      method: 'post',
      url: '/stock-items/quarantine-lots/8/resolutions',
      body: {
        action,
        quantity: '1.00',
        reason: 'Inspected',
        expectedRevision: 1,
        requestId: expect.any(String),
      },
    })
    await screen.findByText('1.00 kg')
    for (const key of [
      'stock-items',
      'products',
      'warehouses',
      'outgoing-deliveries',
      'purchase-orders',
    ])
      expect(client.getQueryState([key])?.isInvalidated).toBe(true)
    expect(screen.getByText('Audit history')).toBeTruthy()
  },
)

it('does not expose condition changes or resolutions to staff', async () => {
  auth.isManager = false
  mount()
  await screen.findByText('2.00 kg')
  expect(screen.queryByRole('button', { name: /^Release to/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Correct Condition/ })).toBeNull()
  expect(screen.getByText('Audit history')).toBeTruthy()
})

it('keeps closed lots and their history reviewable without mutation controls', async () => {
  lot.remainingQuantity = '0.00'
  mount()
  await screen.findByText(/This lot is closed/)
  expect(screen.queryByRole('button', { name: /^Release to/ })).toBeNull()
  expect(screen.queryByRole('button', { name: /^Correct Condition/ })).toBeNull()
  expect(screen.getByText('Audit history')).toBeTruthy()
})

it('requires a nonblank correction reason', async () => {
  mount()
  await correction()
  reason('  ')
  expect(
    screen.getByRole('button', { name: 'Confirm Condition Correction' }).hasAttribute('disabled'),
  ).toBe(true)
  fireEvent.submit(screen.getByRole('form', { name: 'Quarantine action' }))
  expect(writes).toHaveLength(0)
})

it('sends stock, condition, and open/all filters from the quarantine view', async () => {
  const filters: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    let data: unknown = []
    if (config.url === '/stock-items') data = [stock]
    if (config.url === '/stock-items/quarantine-lots') {
      filters.push(config.params)
      data = [lot]
    }
    return {
      config,
      data: config.url?.endsWith('/8')
        ? lot
        : {
            items:
              config.url?.endsWith('/condition-changes') || config.url?.endsWith('/resolutions')
                ? []
                : data,
            nextCursor: null,
          },
      status: 200,
      statusText: '',
      headers: {},
    }
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <QuarantinedStock />
    </QueryClientProvider>,
  )
  const user = userEvent.setup()
  await screen.findByRole('button', { name: 'Review & Resolve' })
  expect(filters[0]).toEqual({ openOnly: true, limit: 50 })
  await user.click(screen.getByRole('combobox', { name: 'Condition' }))
  await user.click(screen.getByRole('option', { name: 'Spoiled' }))
  await user.click(screen.getByRole('combobox', { name: 'Lot status' }))
  await user.click(screen.getByRole('option', { name: 'All lots' }))
  await user.click(screen.getByRole('button', { name: 'Filter quarantine by stock record' }))
  await user.click(screen.getByRole('menuitem', { name: 'Rice — Main Warehouse' }))
  await waitFor(() =>
    expect(filters).toContainEqual({
      stockItemId: 4,
      condition: 'SPOILED',
      openOnly: false,
      limit: 50,
    }),
  )
  expect(screen.getByText('MANUAL')).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Review & Resolve' }))
  expect(await screen.findByRole('heading', { name: 'Review Quarantined Stock' })).toBeTruthy()
  expect(await screen.findByText('2.00 kg')).toBeTruthy()
})

it('refreshes a conflicting correction and never automatically retries it', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  let attempts = 0
  apiClient.defaults.adapter = async (config) => {
    if (config.method !== 'get') {
      attempts++
      lot = { ...lot, condition: 'SPOILED' }
      const error = new AxiosError('Conflict')
      error.response = {
        config,
        data: { message: 'Quarantine lot changed during correction' },
        status: 409,
        statusText: '',
        headers: {},
      }
      throw error
    }
    return adapter(config)
  }
  mount()
  await correction()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Condition Correction' }))
  await screen.findByRole('alert')
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Confirm Condition Correction' }).hasAttribute('disabled'),
    ).toBe(true),
  )
  expect(attempts).toBe(1)
})

it('shows the proper empty quarantine state after a successful empty response', async () => {
  apiClient.defaults.adapter = async (config) => ({
    config,
    data: { items: [], nextCursor: null },
    status: 200,
    statusText: '',
    headers: {},
  })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <QuarantinedStock />
    </QueryClientProvider>,
  )
  expect(await screen.findByText('No quarantine lots match these filters.')).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it.each(['0', '-1', 'abc', '0.001', '2.01'])(
  'shows immediate inline validation for invalid resolution quantity %s',
  async (value) => {
    mount()
    await chooseAction('CLEAR')
    quantity(value)
    reason()
    inspect()
    const input = screen.getByLabelText('Quantity to release')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toContain('quarantine-quantity-error')
    expect(screen.getByRole('button', { name: 'Confirm Release' }).hasAttribute('disabled')).toBe(
      true,
    )
    if (value === '2.01')
      expect(screen.getByText('Quantity cannot exceed remaining quarantined stock.')).toBeTruthy()
    fireEvent.submit(screen.getByRole('form', { name: 'Quarantine action' }))
    expect(writes).toHaveLength(0)
  },
)

it('preserves action-specific inputs without reusing release reasons or safety confirmation for removal', async () => {
  mount()
  await chooseAction('CLEAR')
  quantity('0.25')
  reason('Inspected and safe')
  inspect()
  await chooseAction('REMOVE')
  expect((screen.getByLabelText('Reason') as HTMLInputElement).value).toBe('')
  expect((screen.getByLabelText('Quantity to remove') as HTMLInputElement).value).toBe('')
  quantity('0.50', 'REMOVE')
  reason('Unusable')
  await chooseAction('CLEAR')
  expect((screen.getByLabelText('Reason') as HTMLInputElement).value).toBe('Inspected and safe')
  expect((screen.getByLabelText('Quantity to release') as HTMLInputElement).value).toBe('0.25')
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  inspect()
  quantity('0.50')
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  expect(writes).toHaveLength(0)
})

it('allows cancelling destructive confirmation without losing the removal inputs', async () => {
  mount()
  await chooseAction('REMOVE')
  quantity('0.25', 'REMOVE')
  reason('Unusable')
  fireEvent.click(screen.getByRole('button', { name: 'Review Removal' }))
  await screen.findByRole('button', { name: 'Confirm Removal' })
  expect(screen.getByText('Main Warehouse / DAMAGED / 0.25 kg')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm Removal' })).toBeNull())
  expect((screen.getByLabelText('Quantity to remove') as HTMLInputElement).value).toBe('0.25')
  expect(writes).toHaveLength(0)
})

it('rechecks remaining quantities before release and requires renewed inspection confirmation after a change', async () => {
  mount()
  await chooseAction('CLEAR')
  quantity()
  reason()
  inspect()
  lot = { ...lot, remainingQuantity: '0.50' }
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
  await screen.findByText(/This quarantine lot changed/)
  expect(writes).toHaveLength(0)
  expect((screen.getByLabelText('Quantity to release') as HTMLInputElement).value).toBe('1.00')
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false)
  expect(screen.getByText('Quantity cannot exceed remaining quarantined stock.')).toBeTruthy()
  quantity('0.25')
  inspect()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toEqual({
    action: 'CLEAR',
    quantity: '0.25',
    reason: 'Inspected',
    expectedRevision: 1,
    requestId: expect.any(String),
  })
  expect(await screen.findByText('0.25 kg')).toBeTruthy()
})

it('rechecks the lot again at final destructive confirmation', async () => {
  mount()
  await chooseAction('REMOVE')
  quantity('1.00', 'REMOVE')
  reason()
  fireEvent.click(screen.getByRole('button', { name: 'Review Removal' }))
  await screen.findByRole('button', { name: 'Confirm Removal' })
  lot = { ...lot, remainingQuantity: '0.50' }
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Removal' }))
  await screen.findByText(/This quarantine lot changed/)
  expect(writes).toHaveLength(0)
  expect(screen.queryByRole('button', { name: 'Confirm Removal' })).toBeNull()
  expect((screen.getByLabelText('Quantity to remove') as HTMLInputElement).value).toBe('1.00')
})

it.each(['bad', undefined])(
  'blocks missing or invalid remaining balance (%s) instead of treating it as zero',
  async (remainingQuantity) => {
    lot = { ...lot, remainingQuantity: remainingQuantity as unknown as string }
    mount()
    await screen.findByText(
      'Remaining quarantined quantity is unavailable. Reload the lot before making changes.',
    )
    expect(screen.queryByText(/This lot is closed/)).toBeNull()
    expect(screen.queryByRole('button', { name: /^Release to/ })).toBeNull()
    expect(writes).toHaveLength(0)
  },
)

it('allows Admin access and preserves keyboard action selection and dialog dismissal', async () => {
  auth.isManager = false
  auth.isAdmin = true
  const { close } = mount()
  const button = await screen.findByRole('button', { name: /^Release to Available Stock/ })
  await waitFor(() => expect(button.matches(':disabled')).toBe(false))
  button.focus()
  const user = userEvent.setup()
  await user.keyboard('{Enter}')
  expect(screen.getByLabelText('Quantity to release')).toBeTruthy()
  expect(writes).toHaveLength(0)
  await user.keyboard('{Escape}')
  expect(close).toHaveBeenCalledOnce()
})

it('prevents duplicate release submissions while checking the lot', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  let delayed = false
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'get' && delayed) await gate
    return base(config)
  }
  mount()
  await chooseAction('CLEAR')
  quantity()
  reason()
  inspect()
  delayed = true
  const button = screen.getByRole('button', { name: 'Confirm Release' })
  fireEvent.click(button)
  fireEvent.submit(screen.getByRole('form', { name: 'Quarantine action' }))
  expect(writes).toHaveLength(0)
  release()
  await waitFor(() => expect(writes).toHaveLength(1))
})

it('retries an uncertain outcome with the identical revision, UUID, decimal and reason', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  const attempts: unknown[] = []
  apiClient.defaults.adapter = (config) => {
    if (config.method !== 'get') {
      attempts.push(JSON.parse(config.data))
      if (attempts.length === 1) return Promise.reject(new AxiosError('Network Error'))
    }
    return base(config)
  }
  mount()
  await chooseAction('CLEAR')
  quantity('0.25')
  reason()
  inspect()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
  await screen.findByText(/The outcome is uncertain/)
  expect(attempts).toHaveLength(1)
  fireEvent.submit(screen.getByRole('form', { name: 'Quarantine action' }))
  expect(attempts).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Retry same request' }))
  await screen.findByText('1.75 kg')
  expect(attempts).toHaveLength(2)
  expect(attempts[1]).toEqual(attempts[0])
  expect(attempts[0]).toEqual({
    action: 'CLEAR',
    quantity: '0.25',
    reason: 'Inspected',
    expectedRevision: 1,
    requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
  })
})

it('removes a fractional quantity only after final confirmation and retains its resolution history', async () => {
  mount()
  await chooseAction('REMOVE')
  quantity('0.25', 'REMOVE')
  reason('Unusable after inspection')
  fireEvent.click(screen.getByRole('button', { name: 'Review Removal' }))
  const confirm = await screen.findByRole('button', { name: 'Confirm Removal' })
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  await screen.findByText('1.75 kg')
  expect(writes).toHaveLength(1)
  expect(writes[0].body).toEqual({
    action: 'REMOVE',
    quantity: '0.25',
    reason: 'Unusable after inspection',
    expectedRevision: 1,
    requestId: expect.any(String),
  })
  fireEvent.click(screen.getByText('Audit history'))
  expect(screen.getByText(/REMOVE 0.25: Unusable after inspection/)).toBeTruthy()
})

it('blocks mutation when product units cannot be identified', async () => {
  mount({ ...stock, inventoryItem: { ...stock.inventoryItem, unit: undefined } })
  await screen.findByText(
    'Product, warehouse, or unit details are unavailable. Reload inventory before making changes.',
  )
  expect(screen.getByRole('button', { name: /^Release to/ }).matches(':disabled')).toBe(true)
  expect(writes).toHaveLength(0)
})

it('loads independent condition and resolution history cursors without embedding history in lot detail', async () => {
  const urls: { url?: string; params: unknown }[] = []
  const detail = { ...initialLot }
  delete (detail as Partial<typeof detail>).conditionChanges
  delete (detail as Partial<typeof detail>).resolutions
  apiClient.defaults.adapter = async (config) => {
    urls.push({ url: config.url, params: config.params })
    let data: unknown = detail
    if (config.url?.endsWith('/condition-changes'))
      data = {
        items: config.params.cursor
          ? [
              {
                id: 21,
                fromCondition: 'DAMAGED',
                toCondition: 'SPOILED',
                reason: 'Second inspection',
                actorUserId: 12,
                createdAt: initialLot.createdAt,
              },
            ]
          : [],
        nextCursor: config.params.cursor ? null : 'conditions-2',
      }
    if (config.url?.endsWith('/resolutions'))
      data = {
        items: config.params.cursor
          ? [
              {
                id: 22,
                action: 'CLEAR',
                quantity: '0.25',
                reason: 'Second release',
                actorUserId: 12,
                createdAt: initialLot.createdAt,
              },
            ]
          : [],
        nextCursor: config.params.cursor ? null : 'resolutions-2',
      }
    return { config, data, status: 200, statusText: '', headers: {} }
  }
  mount()
  fireEvent.click(await screen.findByText('Audit history'))
  fireEvent.click(await screen.findByRole('button', { name: 'Load more condition changes' }))
  await screen.findByText(/Second inspection/)
  expect(screen.queryByText(/Second release/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'Load more resolutions' }))
  await screen.findByText(/Second release/)
  expect(urls).toContainEqual({
    url: '/stock-items/quarantine-lots/8/condition-changes',
    params: { limit: 50, cursor: 'conditions-2' },
  })
  expect(urls).toContainEqual({
    url: '/stock-items/quarantine-lots/8/resolutions',
    params: { limit: 50, cursor: 'resolutions-2' },
  })
  expect(urls.some(({ url }) => url === '/stock-items/quarantine-lots')).toBe(false)
})

it('loads subsequent quarantine lot pages into the canonical table', async () => {
  apiClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: '',
    headers: {},
    data:
      config.url === '/stock-items'
        ? { items: [stock], nextCursor: null }
        : {
            items: [
              {
                ...initialLot,
                id: config.params.cursor ? 9 : 8,
                remainingQuantity: config.params.cursor ? '0.75' : '2.00',
              },
            ],
            nextCursor: config.params.cursor ? null : 'lots-2',
          },
  })
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <QuarantinedStock />
    </QueryClientProvider>,
  )
  await screen.findByText('2.00')
  fireEvent.click(await screen.findByRole('button', { name: 'Next' }))
  await screen.findByText('0.75')
  expect(screen.getAllByRole('button', { name: 'Review & Resolve' })).toHaveLength(1)
  expect(screen.queryByText('2.00')).toBeNull()
})

it('resolves off-page stock by ID and preserves revision-aware partial release', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  const reads: string[] = []
  apiClient.defaults.adapter = async (config) => {
    reads.push(config.url ?? '')
    const data = config.url === '/stock-items/4' ? stock
      : config.url === '/inventory-items/1' ? { ...stock.inventoryItem, isActive: true }
        : config.url === '/warehouses/2' ? { ...stock.warehouse, isActive: true } : undefined
    return data ? { config, data, status: 200, statusText: '', headers: {} } : base(config)
  }
  mount(null)
  await chooseAction('CLEAR')
  expect(screen.getByText('Rice')).toBeTruthy()
  expect(screen.getByText('Main Warehouse')).toBeTruthy()
  quantity('0.25')
  reason('Inspected off-page lot')
  inspect()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
  await waitFor(() => expect(writes).toHaveLength(1))
  expect(writes[0].body).toEqual({ action: 'CLEAR', quantity: '0.25', reason: 'Inspected off-page lot', expectedRevision: 1, requestId: expect.any(String) })
  await screen.findByText('1.75 kg')
  expect(reads).toEqual(expect.arrayContaining(['/stock-items/4', '/inventory-items/1', '/warehouses/2']))
  expect(reads.some((url) => ['/stock-items', '/inventory-items', '/warehouses'].includes(url))).toBe(false)
})

it.each(['network', 'product mismatch', 'warehouse mismatch'] as const)('blocks off-page actions on %s and supports explicit metadata retry', async (failure) => {
  const base = getAdapter(apiClient.defaults.adapter)
  let failing = true
  apiClient.defaults.adapter = async (config) => {
    if (config.url === '/stock-items/4' && failing && failure === 'network') throw new AxiosError('Network Error')
    const data = config.url === '/stock-items/4' ? stock
      : config.url === '/inventory-items/1' ? { ...stock.inventoryItem, id: failing && failure === 'product mismatch' ? 99 : 1 }
        : config.url === '/warehouses/2' ? { ...stock.warehouse, id: failing && failure === 'warehouse mismatch' ? 99 : 2 } : undefined
    return data ? { config, data, status: 200, statusText: '', headers: {} } : base(config)
  }
  mount(null)
  const retry = await screen.findByRole('button', { name: 'Reload stock details' })
  expect(screen.getByRole('button', { name: /^Release to/ }).matches(':disabled')).toBe(true)
  expect(writes).toHaveLength(0)
  failing = false
  fireEvent.click(retry)
  await waitFor(() => expect(screen.getByRole('button', { name: /^Release to/ }).matches(':disabled')).toBe(false))
  expect(screen.queryByRole('button', { name: 'Reload stock details' })).toBeNull()
  expect(writes).toHaveLength(0)
})
