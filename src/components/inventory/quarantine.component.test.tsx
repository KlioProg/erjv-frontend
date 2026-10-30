import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { QuarantinedStock } from './QuarantinedStock'
import type { QuarantineLot, StockItemWithRelations } from '@/features/logistics/stock-items.types'

const auth = vi.hoisted(() => ({ role: 'MANAGER' }))
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { role: auth.role },
    isAdmin: ['ADMIN', 'SUPERADMIN'].includes(auth.role),
    isManager: auth.role === 'MANAGER',
  }),
}))
const originalAdapter = apiClient.defaults.adapter
beforeEach(() => {
  auth.role = 'MANAGER'
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

const baseLot: QuarantineLot = {
  revision: 1,
  id: 11,
  stockItemId: 7,
  incomingDeliveryItemId: 19,
  outgoingDeliveryItemId: null,
  sourceKind: 'INCOMING_DELIVERY',
  condition: 'DAMAGED',
  reportedCondition: 'DAMAGED',
  taggedByUserId: null,
  tagReason: null,
  requestId: null,
  initialQuantity: '4.50',
  remainingQuantity: '3.25',
  createdAt: '2026-10-26T02:00:00Z',
}
const baseStock: StockItemWithRelations = {
  id: 7,
  inventoryItemId: 1,
  warehouseId: 2,
  onHandQuantity: '10.00',
  revision: 1,
  inTransitQuantity: '0.00',
  conditionQuantities: { DAMAGED: '0.00', SPOILED: '0.00' },
  reorderThreshold: null,
  stockStatus: 'NORMAL',

  quarantinedQuantity: '3.25',
  availableQuantity: '1.75',

  inventoryItem: { id: 1, name: 'Rice', unit: 'kg' },
  warehouse: { id: 2, name: 'Main' },
  createdAt: '',
  updatedAt: '',
}

function mount(
  options: {
    lots?: QuarantineLot[]
    stockItemId?: number
    listFailure?: boolean
    listErrorStatus?: number
    deferList?: Promise<void>
    failRefresh?: boolean
    missingStock?: boolean
    post?: (config: InternalAxiosRequestConfig) => Promise<void>
  } = {},
) {
  let currentLots = structuredClone(options.lots ?? [baseLot])
  let stock = structuredClone(baseStock)
  const gets: { url: string; params: unknown }[] = []
  const posts: { url: string; body: unknown }[] = []
  apiClient.defaults.adapter = async (config) => {
    const response = { config, status: 200, statusText: 'OK', headers: {}, data: {} as unknown }
    if (config.method === 'post') {
      posts.push({ url: config.url!, body: JSON.parse(config.data as string) })
      await options.post?.(config)
      currentLots = currentLots.map((lot) => ({ ...lot, remainingQuantity: '2.00' }))
      const removed = JSON.parse(config.data as string).action === 'REMOVE'
      stock = {
        ...stock,
        onHandQuantity: removed ? '8.75' : '10.00',

        quarantinedQuantity: '2.00',
        availableQuantity: removed ? '1.75' : '3.00',
      }
      return { ...response, data: { id: 1, lotId: 11, purchaseOrderId: 9 } }
    }
    gets.push({ url: config.url!, params: config.params })
    if (options.failRefresh && posts.length) throw new AxiosError('Network Error')
    if (config.url === '/stock-items/quarantine-lots') {
      await options.deferList
      if (options.listFailure) throw new AxiosError('Network Error')
      if (options.listErrorStatus)
        throw httpError(
          options.listErrorStatus,
          'Validation failed (numeric string is expected)',
          config,
        )
      return { ...response, data: { items: currentLots, nextCursor: null } }
    }
    return {
      ...response,
      data:
        config.url === '/stock-items/quarantine-lots/11'
          ? currentLots[0]
          : {
              items: config.url === '/stock-items' && !options.missingStock ? [stock] : [],
              nextCursor: null,
            },
    }
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
  })
  for (const key of [
    ['stock-items', 'warehouse', 2],
    ['stock-items', 'item', 1],
    ['stock-items', 'false'],
    ['products'],
    ['warehouses'],
    ['purchase-orders', 'id', 9],
  ])
    client.setQueryData(key, [])
  render(
    <QueryClientProvider client={client}>
      <QuarantinedStock stockItemId={options.stockItemId} />
    </QueryClientProvider>,
  )
  return { client, gets, posts }
}

async function openLot() {
  fireEvent.click(await screen.findByRole('button', { name: 'Review & Resolve' }))
  await screen.findByText('Originally reported condition')
  return screen.getByRole('dialog')
}

it('preserves an unsubmitted resolution until discard is confirmed', async () => {
  const { posts } = mount()
  await openLot()
  fill()
  fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }))
  expect((screen.getByLabelText('Quantity to release') as HTMLInputElement).value).toBe('1.25')
  fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0])
  fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts).toHaveLength(0)
})
function fill(quantity = '1.25', reason = 'Inspection completed') {
  if (!screen.queryByLabelText('Quantity to release'))
    fireEvent.click(screen.getByRole('button', { name: /^Release to/ }))
  fireEvent.change(screen.getByLabelText('Quantity to release'), { target: { value: quantity } })
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: reason } })
  const inspected = screen.getByRole('checkbox') as HTMLInputElement
  if (!inspected.checked) fireEvent.click(inspected)
}
function httpError(status: number, message: string, config: InternalAxiosRequestConfig) {
  return new AxiosError(message, undefined, config, undefined, {
    status,
    statusText: 'Error',
    config,
    headers: {},
    data: { message },
  })
}

it('loads filtered lots with product, warehouse, source and exact quantities', async () => {
  const { gets } = mount({ stockItemId: 7 })
  await screen.findAllByText(/Rice.*Main/)
  expect(screen.getByText('INCOMING DELIVERY')).toBeTruthy()
  expect(screen.getByText('3.25')).toBeTruthy()
  expect(gets.find((request) => request.url.endsWith('quarantine-lots'))?.params).toEqual({
    stockItemId: 7,
    openOnly: true,
    limit: 50,
  })
  const dialog = await openLot()
  expect(within(dialog).getByText('4.50 kg')).toBeTruthy()
  expect(within(dialog).getByText('3.25 kg')).toBeTruthy()
})

it('identifies damaged outgoing returns without suggesting manual stock creation', async () => {
  mount({
    lots: [
      {
        ...baseLot,
        incomingDeliveryItemId: null,
        outgoingDeliveryItemId: 22,
        sourceKind: 'OUTGOING_DELIVERY',
      },
    ],
  })
  expect(await screen.findByText('OUTGOING DELIVERY')).toBeTruthy()
  expect(
    screen.queryByRole('button', { name: /Add Damaged Stock|Create Quarantine|Tag Stock/i }),
  ).toBeNull()
})

it('shows an empty state and allows zero-balance lots to be inspected without actions', async () => {
  mount({ lots: [{ ...baseLot, remainingQuantity: '0.00' }] })
  await openLot()
  expect(await screen.findByText(/This lot is closed/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /^Release to/ })).toBeNull()
})

it('handles a genuinely empty quarantine list', async () => {
  mount({ lots: [] })
  expect(await screen.findByText(/No quarantine lots match these filters/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Review & Resolve/ })).toBeNull()
})

it('does not invent missing product or warehouse context or allow an unidentified stock resolution', async () => {
  const { posts } = mount({ missingStock: true })
  await screen.findByText('Stock details unavailable')
  await openLot()
  expect(screen.getByText(/Product, warehouse, or unit details are unavailable/)).toBeTruthy()
  expect(screen.getByRole('button', { name: /^Release to/ }).matches(':disabled')).toBe(true)
  expect(posts).toHaveLength(0)
})

it('shows loading and recoverable list errors', async () => {
  let release!: () => void
  const deferred = new Promise<void>((resolve) => {
    release = resolve
  })
  mount({ deferList: deferred, listFailure: true })
  expect(screen.queryByRole('button', { name: 'Review & Resolve' })).toBeNull()
  release()
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Retry quarantine list' }).hasAttribute('disabled'),
  ).toBe(false)
})

it('explains quarantine load failures without exposing routing validation and allows refresh', async () => {
  const options: { listErrorStatus?: number } = { listErrorStatus: 400 }
  mount(options)
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Retry quarantine list')
  expect(alert.textContent).not.toMatch(/numeric string|Validation failed|quarantine-lots/i)
  options.listErrorStatus = undefined
  fireEvent.click(screen.getByRole('button', { name: 'Retry quarantine list' }))
  expect(await screen.findByRole('button', { name: 'Review & Resolve' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it.each([401, 403])(
  'keeps authorization guidance on quarantine load failure (%s)',
  async (status) => {
    mount({ listErrorStatus: status })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(status === 401 ? /sign in/i : /permission/i)
    expect(alert.textContent).not.toContain('numeric string')
  },
)

it.each(['STAFF', 'UNKNOWN'])('%s has read-only resolution access', async (role) => {
  auth.role = role
  const { posts } = mount()
  await openLot()
  expect(screen.queryByLabelText('Quantity to release')).toBeNull()
  expect(posts).toEqual([])
})

it.each(['MANAGER', 'ADMIN', 'SUPERADMIN'])(
  '%s submits CLEAR with exact decimal strings and refreshes dependent caches',
  async (role) => {
    auth.role = role
    const { posts, client, gets } = mount()
    await openLot()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
    await waitFor(() => expect(screen.queryByLabelText('Quantity to release')).toBeNull())
    expect(posts).toEqual([
      {
        url: '/stock-items/quarantine-lots/11/resolutions',
        body: {
          action: 'CLEAR',
          quantity: '1.25',
          reason: 'Inspection completed',
          expectedRevision: 1,
          requestId: expect.any(String),
        },
      },
    ])
    await waitFor(() =>
      expect(within(screen.getByRole('dialog')).getByText('2.00 kg')).toBeTruthy(),
    )
    expect(
      gets.filter((request) => request.url.endsWith('quarantine-lots')).length,
    ).toBeGreaterThan(1)
    for (const key of [
      ['stock-items', 'warehouse', 2],
      ['stock-items', 'item', 1],
      ['stock-items', 'false'],
      ['products'],
      ['warehouses'],
      ['purchase-orders', 'id', 9],
    ])
      expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  },
)

it.each(['', '0', '-1', '1.234', '3.26', 'abc', '1e2'])(
  'rejects invalid quantity %j without a request',
  async (value) => {
    const { posts } = mount()
    await openLot()
    fill(value)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
    expect(screen.getByRole('button', { name: 'Confirm Release' }).matches(':disabled')).toBe(true)
    expect(posts).toEqual([])
  },
)

it('requires a nonblank reason and explicit removal confirmation, and blocks duplicate requests', async () => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const { posts } = mount({ post: async () => pending })
  await openLot()
  fireEvent.click(screen.getByRole('button', { name: /^Remove from Inventory/ }))
  fireEvent.change(screen.getByLabelText('Quantity to remove'), { target: { value: '1.25' } })
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: '   ' } })
  expect(screen.getByRole('button', { name: 'Review Removal' }).matches(':disabled')).toBe(true)
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Inspection completed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review Removal' }))
  const confirm = await screen.findByRole('button', { name: 'Confirm Removal' })
  expect(posts).toHaveLength(0)
  fireEvent.click(confirm)
  fireEvent.click(confirm)
  await waitFor(() => expect(posts).toHaveLength(1))
  expect(posts[0].body).toEqual({
    action: 'REMOVE',
    quantity: '1.25',
    reason: 'Inspection completed',
    expectedRevision: 1,
    requestId: expect.any(String),
  })
  finish()
  await screen.findByText('2.00 kg')
})

it('preserves removal inputs after a conflict and requires another explicit confirmation', async () => {
  let fail = true
  const { posts } = mount({
    post: async (config) => {
      if (fail) throw httpError(409, 'Quarantine balance changed', config)
    },
  })
  await openLot()
  fireEvent.click(screen.getByRole('button', { name: /^Remove from Inventory/ }))
  fireEvent.change(screen.getByLabelText('Quantity to remove'), { target: { value: '1.25' } })
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Inspection completed' } })
  fireEvent.click(screen.getByRole('button', { name: 'Review Removal' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm Removal' }))
  await screen.findByText(/Quarantine balance changed/)
  expect((screen.getByLabelText('Quantity to remove') as HTMLInputElement).value).toBe('1.25')
  fail = false
  fireEvent.click(screen.getByRole('button', { name: 'Review Removal' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm Removal' }))
  await screen.findByText('2.00 kg')
  expect(posts).toHaveLength(2)
})

it('compares large lot balances exactly and accepts the remaining balance without rounding', async () => {
  const { posts } = mount({ lots: [{ ...baseLot, remainingQuantity: '90071992547409.25' }] })
  await openLot()
  fill('90071992547409.26')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
  expect(posts).toHaveLength(0)
  fill('90071992547409.25')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
  await waitFor(() => expect(posts).toHaveLength(1))
  expect(posts[0].body).toEqual({
    action: 'CLEAR',
    quantity: '90071992547409.25',
    reason: 'Inspection completed',
    expectedRevision: 1,
    requestId: expect.any(String),
  })
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Processing…' })).toBeNull())
})

it.each([403, 409])('handles HTTP %i without losing inputs and refreshes lots', async (status) => {
  const { posts, gets } = mount({
    post: async (config) => {
      throw httpError(status, 'Resolution exceeds quarantined quantity', config)
    },
  })
  await openLot()
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
  await screen.findByRole('alert')
  await waitFor(() =>
    expect(screen.getByRole('button', { name: /^Release to/ }).matches(':disabled')).toBe(false),
  )
  expect((screen.getByLabelText('Quantity to release') as HTMLInputElement).value).toBe('1.25')
  expect((screen.getByLabelText('Reason') as HTMLTextAreaElement).value).toBe(
    'Inspection completed',
  )
  expect(posts).toHaveLength(1)
  expect(gets.filter((request) => request.url.endsWith('quarantine-lots')).length).toBeGreaterThan(
    1,
  )
})

it('never retries an uncertain mutation and requires refresh when authoritative reads fail', async () => {
  const { posts } = mount({
    failRefresh: true,
    post: async () => {
      throw new AxiosError('Network Error')
    },
  })
  await openLot()
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Confirm Release' }))
  await screen.findByText(/The outcome is uncertain/)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Retry same request' }).hasAttribute('disabled'),
    ).toBe(false),
  )
  expect(screen.getByRole('button', { name: /^Release to/ }).matches(':disabled')).toBe(true)
  expect(posts).toHaveLength(1)
  expect((screen.getByLabelText('Quantity to release') as HTMLInputElement).value).toBe('1.25')
})
