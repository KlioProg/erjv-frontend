import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { QuarantinedStock } from './QuarantinedStock'
import type { QuarantineLot, StockItemWithRelations } from '@/features/logistics/stock-items.types'

const auth = vi.hoisted(() => ({ role: 'MANAGER' }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: auth.role } }) }))
const originalAdapter = apiClient.defaults.adapter
beforeEach(() => {
  auth.role = 'MANAGER'
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

const baseLot: QuarantineLot = {
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
  conditionChanges: [],
  resolutions: [],
}
const baseStock: StockItemWithRelations = {
  id: 7,
  inventoryItemId: 1,
  warehouseId: 2,
  quantity: '10.00',
  damagedQuantity: '3.25',
  quarantinedQuantity: '3.25',
  availableQuantity: '1.75',
  reservedQuantity: '5.00',
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
        quantity: removed ? '8.75' : '10.00',
        damagedQuantity: '2.00',
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
      if (options.listErrorStatus) throw httpError(options.listErrorStatus, 'Validation failed (numeric string is expected)', config)
      return { ...response, data: currentLots }
    }
    return {
      ...response,
      data: config.url === '/stock-items' && !options.missingStock ? [stock] : [],
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
  fireEvent.click(await screen.findByRole('button', { name: 'View quarantine lot #11' }))
  return screen.getByRole('dialog')
}

it('preserves an unsubmitted resolution until discard is confirmed', async () => {
  const { posts } = mount()
  await openLot()
  fill()
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }))
  expect((screen.getByLabelText('Quantity') as HTMLInputElement).value).toBe('1.25')
  fireEvent.click(screen.getByRole('button', { name: 'Close' }))
  fireEvent.click(screen.getByRole('button', { name: 'Discard Changes' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(posts).toHaveLength(0)
})
function fill(quantity = '1.25', reason = 'Inspection completed') {
  fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: quantity } })
  fireEvent.change(screen.getByLabelText('Reason (required)'), { target: { value: reason } })
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
  await screen.findByText('Rice')
  expect(screen.getByText('Main')).toBeTruthy()
  expect(screen.getByText('Incoming delivery item #19')).toBeTruthy()
  expect(screen.getByText('4.5 kg')).toBeTruthy()
  expect(screen.getByText('3.25 kg')).toBeTruthy()
  expect(gets.find((request) => request.url.endsWith('quarantine-lots'))?.params).toEqual({
    stockItemId: 7,
  })
  const dialog = await openLot()
  expect(within(dialog).getByText('1.75 kg')).toBeTruthy()
  expect(within(dialog).getByText('10 kg')).toBeTruthy()
})

it('identifies damaged outgoing returns without suggesting manual stock creation', async () => {
  mount({ lots: [{ ...baseLot, incomingDeliveryItemId: null, outgoingDeliveryItemId: 22, sourceKind: 'OUTGOING_DELIVERY' }] })
  expect(await screen.findByText('Outgoing return item #22')).toBeTruthy()
  expect(screen.getByText(/incoming receiving or outgoing delivery returns/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /Add Damaged Stock|Create Quarantine|Tag Stock/i })).toBeNull()
})

it('shows an empty state and allows zero-balance lots to be inspected without actions', async () => {
  mount({ lots: [{ ...baseLot, remainingQuantity: '0.00' }] })
  await screen.findByText('No quarantine lots match this view.')
  fireEvent.click(screen.getByRole('checkbox', { name: 'Only lots with remaining quarantine' }))
  expect(await screen.findByText('No remaining quarantine')).toBeTruthy()
  await openLot()
  expect(screen.queryByRole('button', { name: 'Clear Quarantine' })).toBeNull()
})

it('handles a genuinely empty quarantine list', async () => {
  mount({ lots: [] })
  expect(await screen.findByText(/No quarantined stock has been recorded/)).toBeTruthy()
  expect(screen.queryByRole('button', { name: /View quarantine lot/ })).toBeNull()
})

it('does not invent missing product or warehouse context or allow an unidentified stock resolution', async () => {
  const { posts } = mount({ missingStock: true })
  await screen.findByText('Stock item #7')
  expect(screen.getByText('Warehouse unavailable')).toBeTruthy()
  await openLot()
  expect(screen.getByText(/Product and warehouse context is unavailable/)).toBeTruthy()
  expect(
    screen.getByRole('button', { name: 'Clear Quarantine' }).closest('fieldset')?.disabled,
  ).toBe(true)
  expect(posts).toHaveLength(0)
})

it('shows loading and recoverable list errors', async () => {
  let release!: () => void
  const deferred = new Promise<void>((resolve) => {
    release = resolve
  })
  mount({ deferList: deferred, listFailure: true })
  expect(screen.getByText('Loading quarantine lots')).toBeTruthy()
  release()
  expect(await screen.findByText(/Unable to load quarantined stock/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Refresh' }).hasAttribute('disabled')).toBe(false)
})

it('explains quarantine load failures without exposing routing validation and allows refresh', async () => {
  const options: { listErrorStatus?: number } = { listErrorStatus: 400 }
  mount(options)
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toContain('Unable to load quarantined stock')
  expect(alert.textContent).toContain('Refresh')
  expect(alert.textContent).toContain('administrator')
  expect(alert.textContent).not.toMatch(/numeric string|Validation failed|quarantine-lots/i)
  options.listErrorStatus = undefined
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }))
  expect(await screen.findByRole('button', { name: 'View quarantine lot #11' })).toBeTruthy()
  expect(screen.queryByRole('alert')).toBeNull()
})

it.each([401, 403])('keeps authorization guidance on quarantine load failure (%s)', async (status) => {
  mount({ listErrorStatus: status })
  const alert = await screen.findByRole('alert')
  expect(alert.textContent).toMatch(status === 401 ? /sign in/i : /permission/i)
  expect(alert.textContent).not.toContain('numeric string')
})

it.each(['STAFF', 'UNKNOWN'])('%s has read-only resolution access', async (role) => {
  auth.role = role
  const { posts } = mount()
  await openLot()
  expect(screen.queryByLabelText('Quantity')).toBeNull()
  expect(posts).toEqual([])
})

it.each(['MANAGER', 'ADMIN', 'SUPERADMIN'])(
  '%s submits CLEAR with exact decimal strings and refreshes dependent caches',
  async (role) => {
    auth.role = role
    const { posts, client, gets } = mount()
    await openLot()
    fill()
    fireEvent.click(screen.getByRole('button', { name: 'Clear Quarantine' }))
    await waitFor(() => expect(screen.getByLabelText('Quantity').getAttribute('value')).toBe(''))
    expect(posts).toEqual([
      {
        url: '/stock-items/quarantine-lots/11/resolutions',
        body: { action: 'CLEAR', quantity: '1.25', reason: 'Inspection completed' },
      },
    ])
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('3 kg')).toBeTruthy())
    expect(within(screen.getByRole('dialog')).getByText('10 kg')).toBeTruthy()
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
    expect(screen.getByLabelText('Quantity').getAttribute('placeholder')).toBe('0')
    fill(value)
    fireEvent.click(screen.getByRole('button', { name: 'Clear Quarantine' }))
    expect(await screen.findByText(/Enter a positive quantity/)).toBeTruthy()
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
  fill('1.25', '   ')
  expect(screen.getByRole('button', { name: 'Clear Quarantine' }).hasAttribute('disabled')).toBe(
    true,
  )
  fill()
  fireEvent.click(screen.getByRole('radio', { name: 'Remove Damaged Stock' }))
  const remove = screen.getByRole('button', { name: 'Remove Damaged Stock' })
  expect(remove.hasAttribute('disabled')).toBe(true)
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: /I confirm permanent removal of 1.25 kg of Rice from Main/,
    }),
  )
  fireEvent.click(remove)
  fireEvent.click(remove)
  await waitFor(() => expect(posts).toHaveLength(1))
  expect(posts[0].body).toEqual({
    action: 'REMOVE',
    quantity: '1.25',
    reason: 'Inspection completed',
  })
  expect(screen.getByRole('button', { name: 'Processing…' }).hasAttribute('disabled')).toBe(true)
  finish()
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Processing…' })).toBeNull())
  expect(within(screen.getByRole('dialog')).getByText('8.75 kg')).toBeTruthy()
  expect(within(screen.getByRole('dialog')).getByText('1.75 kg')).toBeTruthy()
})

it('preserves removal inputs after an error and requires a fresh confirmation for a deliberate retry', async () => {
  let fail = true
  const { posts } = mount({
    post: async (config) => {
      if (fail) throw httpError(409, 'Quarantine balance changed', config)
    },
  })
  await openLot()
  fill()
  fireEvent.click(screen.getByRole('radio', { name: 'Remove Damaged Stock' }))
  fireEvent.click(screen.getByRole('checkbox', { name: /I confirm permanent removal/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove Damaged Stock' }))
  await screen.findByText(/Quarantine balance changed/)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Remove Damaged Stock' }).closest('fieldset')?.disabled,
    ).toBe(false),
  )
  expect(
    screen.getByRole('button', { name: 'Remove Damaged Stock' }).hasAttribute('disabled'),
  ).toBe(true)
  expect((screen.getByLabelText('Quantity') as HTMLInputElement).value).toBe('1.25')
  fail = false
  fireEvent.click(screen.getByRole('checkbox', { name: /I confirm permanent removal/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Remove Damaged Stock' }))
  await waitFor(() => expect(within(screen.getByRole('dialog')).getByText('8.75 kg')).toBeTruthy())
  expect(posts).toHaveLength(2)
})

it('compares large lot balances exactly and accepts the remaining balance without rounding', async () => {
  const { posts } = mount({ lots: [{ ...baseLot, remainingQuantity: '90071992547409.25' }] })
  await openLot()
  fill('90071992547409.26')
  fireEvent.click(screen.getByRole('button', { name: 'Clear Quarantine' }))
  expect(posts).toHaveLength(0)
  fill('90071992547409.25')
  fireEvent.click(screen.getByRole('button', { name: 'Clear Quarantine' }))
  await waitFor(() => expect(posts).toHaveLength(1))
  expect(posts[0].body).toEqual({
    action: 'CLEAR',
    quantity: '90071992547409.25',
    reason: 'Inspection completed',
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
  fireEvent.click(screen.getByRole('button', { name: 'Clear Quarantine' }))
  await screen.findByText(status === 403 ? /You are not authorized/ : /This lot may have changed/)
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Clear Quarantine' }).closest('fieldset')?.disabled,
    ).toBe(false),
  )
  expect((screen.getByLabelText('Quantity') as HTMLInputElement).value).toBe('1.25')
  expect((screen.getByLabelText('Reason (required)') as HTMLTextAreaElement).value).toBe(
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
  fireEvent.click(screen.getByRole('button', { name: 'Clear Quarantine' }))
  await screen.findByText(/The result is uncertain/)
  await waitFor(() =>
    expect(
      screen
        .getByRole('button', { name: 'Refresh inventory before retrying' })
        .hasAttribute('disabled'),
    ).toBe(false),
  )
  expect(
    screen.getByRole('button', { name: 'Clear Quarantine' }).closest('fieldset')?.disabled,
  ).toBe(true)
  expect(posts).toHaveLength(1)
  expect((screen.getByLabelText('Quantity') as HTMLInputElement).value).toBe('1.25')
})
