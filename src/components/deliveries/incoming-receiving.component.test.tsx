import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { toast } from 'sonner'
import { apiClient } from '@/lib/api-client'
import {
  createIncomingDeliveryApi,
  completeIncomingDeliveryApi,
} from '@/features/logistics/incoming-deliveries.api'
import { ReceiveProductsModal } from './ReceiveProductsModal'
import { DeliveriesHub } from './DeliveriesHub'
import { StockNotifications } from '@/components/layout/StockNotifications'
import { QuarantinedStock } from '@/components/inventory/QuarantinedStock'
import type { ReactNode } from 'react'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import { decimalString } from '@/lib/order-amounts'
import { parseStockCents } from '@/features/logistics/stock-display'
import { useState } from 'react'
import { MemoryRouter } from 'react-router'
import { getAdapter } from 'axios'

const auth = vi.hoisted(() => ({ isAdmin: true, isManager: false, isStaff: false }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }))
const dates = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
let delivery: IncomingDeliveryRecord
let order: PurchaseOrderRecord
let history: IncomingDeliveryRecord[]
let requests: { method: string; url: string; body: Record<string, unknown> }[]
let failure: number | 'network' | undefined
let failLoad: boolean
let gate: Promise<void> | undefined
const originalAdapter = apiClient.defaults.adapter
const writes = () => requests.filter((request) => request.method !== 'get')
const received = (product = 'Banana') =>
  screen.getByRole('textbox', { name: `Received now for ${product} (${product === 'Banana' ? 1 : 2})` }) as HTMLInputElement
const damaged = (product = 'Banana') =>
  screen.getByRole('textbox', { name: `Damaged now for ${product} (${product === 'Banana' ? 1 : 2})` }) as HTMLInputElement
function mount(ui?: ReactNode) {
  const onClose = vi.fn()
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    ...render(
      <QueryClientProvider client={client}>
        <MemoryRouter>{ui ?? <ReceiveProductsModal deliveryId={90} onClose={onClose} />}</MemoryRouter>
      </QueryClientProvider>,
    ),
    client,
    onClose,
  }
}
async function choosePartial() {
  const choice = await screen.findByRole('radio', { name: 'Some goods arrived or were damaged' })
  await waitFor(() => expect(choice.matches(':disabled')).toBe(false))
  fireEvent.click(choice)
}
beforeEach(() => {
  requests = []
  failure = undefined
  failLoad = false
  gate = undefined
  auth.isAdmin = true
  auth.isManager = false
  auth.isStaff = false
  delivery = {
    id: 90,
    revision: 1,
    deliveryNumber: 'IN-90',
    purchaseOrderId: 7,
    warehouseId: 2,
    status: 'SCHEDULED',
    scheduledAt: '2026-10-20',
    completedAt: null,
    cancelledAt: null,
    supplierReference: null,
    notes: null,
    ...dates,
    items: [],
  }
  order = {
    id: 7,
    orderNumber: 'PO-7',
    status: 'PARTIALLY_RECEIVED',
    supplierId: 70,
    items: [
      { id: 10, purchaseOrderId: 7, inventoryItemId: 1, quantity: '10.25' },
      { id: 20, purchaseOrderId: 7, inventoryItemId: 2, quantity: '5.00' },
    ],
  } as PurchaseOrderRecord
  history = [
    {
      ...delivery,
      id: 80,
      deliveryNumber: 'IN-80',
      status: 'COMPLETED',
      items: [
        {
          id: 801,
          incomingDeliveryId: 80,
          purchaseOrderItemId: 10,
          receivedQuantity: '4.25',
          damagedQuantity: '1.00',
          acceptedQuantity: '3.25',
          ...dates,
        },
      ],
    },
  ]
  vi.spyOn(toast, 'success').mockReturnValue('success')
  vi.spyOn(toast, 'error').mockReturnValue('error')
  apiClient.defaults.adapter = async (config) => {
    const url = config.url ?? ''
    const method = config.method ?? 'get'
    const body = typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {})
    requests.push({ method, url, body })
    let data: unknown = []
    const receipt =
      delivery.status === 'COMPLETED'
        ? delivery.items.find((item) => item.purchaseOrderItemId === 10)
        : undefined
    // Test server balances and quarantine records, consumed through the real query hooks.
    const stock = {
      id: 301,
      inventoryItemId: 1,
      warehouseId: 2,
      revision: 1,
      onHandQuantity: receipt?.receivedQuantity ?? '0.00',
      inTransitQuantity: '0.00',
      quarantinedQuantity: receipt?.damagedQuantity ?? '0.00',
      conditionQuantities: { DAMAGED: receipt?.damagedQuantity ?? '0.00', SPOILED: '0.00' },
      reorderThreshold: null,
      availableQuantity: receipt?.acceptedQuantity ?? '0.00',
      stockStatus: (parseStockCents(receipt?.acceptedQuantity) ?? 0n) > 0n ? 'UNCONFIGURED' : 'OUT',
      inventoryItem: { id: 1, name: 'Banana', unit: 'kg' },
      warehouse: { id: 2, name: 'Saved warehouse' },
      ...dates,
    }
    if (method === 'get') {
      if (failLoad && url === '/incoming-deliveries/90')
        throw { isAxiosError: true, response: { status: 503, data: { message: 'Unavailable' } } }
      data =
        url === '/incoming-deliveries/90'
          ? delivery
          : url === '/incoming-deliveries'
            ? { items: config.params?.statuses?.includes('COMPLETED') ? history : [delivery, ...history], nextCursor: null }
            : url === '/purchase-orders/7'
              ? order
              : url === '/purchase-orders'
                ? { items: [order], nextCursor: null }
                : url === '/warehouses'
                  ? [{ id: 2, name: 'Saved warehouse', isActive: true }]
                  : url === '/inventory-items'
                    ? [
                        { id: 1, name: 'Banana', unit: 'kg', isActive: true },
                        { id: 2, name: 'Mango', unit: 'boxes', isActive: true },
                      ]
                    : url === '/suppliers'
                      ? [{ id: 70, name: 'Saved supplier', isActive: true }]
                      : url === '/stock-items'
                        ? [stock]
                        : url === '/stock-items/quarantine-lots' &&
                            (parseStockCents(receipt?.damagedQuantity) ?? 0n) > 0n
                          ? [
                              {
                                id: 700,
                                revision: 1,
                                stockItemId: 301,
                                incomingDeliveryItemId: 900,
                                outgoingDeliveryItemId: null,
                                sourceKind: 'INCOMING_DELIVERY',
                                condition: 'DAMAGED',
                                reportedCondition: 'DAMAGED',
                                taggedByUserId: null,
                                tagReason: null,
                                requestId: null,
                                initialQuantity: receipt?.damagedQuantity,
                                remainingQuantity: receipt?.damagedQuantity,
                                conditionChanges: [],
                                resolutions: [],
                                ...dates,
                              },
                            ]
                          : []
    } else if (method === 'post') data = { ...delivery, status: 'DRAFT' }
    else if (url === '/incoming-deliveries/90/complete') {
      await gate
      if (failure)
        throw {
          isAxiosError: true,
          response:
            failure === 'network'
              ? undefined
              : {
                  status: failure,
                  data: { message: 'Accepted quantity exceeds remaining order quantity' },
                },
        }
      const items = body.items as {
        purchaseOrderItemId: number
        receivedQuantity: string
        damagedQuantity: string
      }[]
      delivery = {
        ...delivery,
        status: 'COMPLETED',
        outcome: items.length
          ? items.some((item) => item.damagedQuantity !== '0.00')
            ? 'RECEIVED_WITH_DAMAGE'
            : 'RECEIVED'
          : 'NO_RECEIPT',
        noReceiptReason: body.noReceiptReason as string | undefined,
        items: items.map((item, index) => ({
          ...item,
          id: 900 + index,
          incomingDeliveryId: 90,
          acceptedQuantity: decimalString(
            parseStockCents(item.receivedQuantity)! - parseStockCents(item.damagedQuantity)!,
          ),
          ...dates,
        })),
      }
      history = [...history, delivery]
      data = delivery
    }
    if (method === 'get' && /^\/inventory-items\/[12]$/.test(url)) data = { id: Number(url.split('/').pop()), name: url.endsWith('/1') ? 'Banana' : 'Mango', unit: url.endsWith('/1') ? 'kg' : 'boxes', isActive: true }
    if (method === 'get' && url === '/warehouses/2') data = { id: 2, name: 'Saved warehouse', isActive: true }
    if (method === 'get' && url === '/suppliers/70') data = { id: 70, name: 'Saved supplier', isActive: true }
    if (Array.isArray(data)) data = { items: data, nextCursor: null }
    return { config, data: structuredClone(data), status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  vi.restoreAllMocks()
})

it('creates a delivery header without receipt items', async () => {
  const legacyPayload = {
    purchaseOrderId: 7,
    warehouseId: 2,
    supplierReference: ' REF ',
    items: [{ purchaseOrderItemId: 10, receivedQuantity: '10.25' }],
  }
  await createIncomingDeliveryApi(legacyPayload)
  expect(writes()[0].body).toEqual({ purchaseOrderId: 7, warehouseId: 2, supplierReference: 'REF' })
})

it('sends actual received and damaged quantities in the completion request', async () => {
  await completeIncomingDeliveryApi(90, {
    expectedRevision: 1,
    items: [{ purchaseOrderItemId: 10, receivedQuantity: '2.25', damagedQuantity: '0.25' }],
  })
  expect(writes()[0].body).toEqual({
    expectedRevision: 1,
    items: [{ purchaseOrderItemId: 10, receivedQuantity: '2.25', damagedQuantity: '0.25' }],
  })
})

it('loads current delivery and PO lines with blank receipt inputs and authoritative prior receiving balances', async () => {
  mount()
  expect(await screen.findByText('Banana')).toBeTruthy()
  expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)
  await choosePartial()
  expect(screen.getByText('Mango')).toBeTruthy()
  expect(screen.getByText('Saved warehouse')).toBeTruthy()
  expect(screen.getByText('Saved supplier')).toBeTruthy()
  const row = within(received().closest('tr')!)
  expect(row.getByText('7 kg outstanding')).toBeTruthy()
  expect(received().value).toBe('')
  expect(damaged().value).toBe('0')
  expect(writes()).toHaveLength(0)
})

it('confirms a partial damaged receipt using PO line IDs and refreshes every affected cache', async () => {
  const user = userEvent.setup()
  const { onClose, client } = mount()
  const keys = [
    ['incoming-deliveries', 'ALL'],
    ['purchase-orders', 'ALL'],
    ['stock-items'],
    ['products', 'detail', 1],
    ['warehouses', 'detail', 2],
    ['quarantine-lots'],
  ]
  for (const key of keys) client.setQueryData(key, [])
  await screen.findByText('Banana')
  await choosePartial()
  fireEvent.change(received(), { target: { value: '2.25' } })
  fireEvent.change(damaged(), { target: { value: '0.25' } })
  fireEvent.change(received('Mango'), { target: { value: '0.00' } })
  await user.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(writes()).toEqual([
    {
      method: 'patch',
      url: '/incoming-deliveries/90/complete',
      body: {
        expectedRevision: 1,
        items: [{ purchaseOrderItemId: 10, receivedQuantity: '2.25', damagedQuantity: '0.25' }],
      },
    },
  ])
  expect(delivery.items[0].acceptedQuantity).toBe('2.00')
  expect(delivery.outcome).toBe('RECEIVED_WITH_DAMAGE')
  for (const key of keys) {
    if ((key[0] === 'products' || key[0] === 'warehouses') && key[1] === 'detail') {
      const writeIndex = requests.findIndex((request) => request.url === '/incoming-deliveries/90/complete')
      const path = key[0] === 'products' ? '/inventory-items/1' : '/warehouses/2'
      expect(requests.slice(writeIndex + 1).some((request) => request.method === 'get' && request.url === path)).toBe(true)
      expect(client.getQueryData(key)).toMatchObject({ id: key[2] })
    } else expect(client.getQueryState(key)?.isInvalidated).toBe(true)
  }
  expect(
    client.getQueryData<IncomingDeliveryRecord>(['incoming-deliveries', 'id', 90])?.status,
  ).toBe('COMPLETED')
})

it('allows received quantities above the outstanding good balance when damage keeps accepted goods within the backend limit', async () => {
  const user = userEvent.setup()
  const { onClose } = mount()
  await screen.findByText('Banana')
  await choosePartial()
  fireEvent.change(received(), { target: { value: '8.25' } })
  fireEvent.change(damaged(), { target: { value: '1.25' } })
  await user.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(delivery.items[0].acceptedQuantity).toBe('7.00')
})

it('allows a wholly damaged receipt and does not treat it as good stock', async () => {
  const user = userEvent.setup()
  const { onClose } = mount()
  await screen.findByText('Banana')
  await choosePartial()
  fireEvent.change(received(), { target: { value: '2.25' } })
  fireEvent.change(damaged(), { target: { value: '2.25' } })
  await user.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(delivery.items[0].acceptedQuantity).toBe('0.00')
})

it('requires a reason for no receipt and sends an empty items array without assumed counts', async () => {
  const user = userEvent.setup()
  const { onClose } = mount()
  await screen.findByText('Banana')
  await user.click(screen.getByRole('radio', { name: 'No goods arrived' }))
  expect(screen.getByRole('button', { name: 'Confirm No Receipt' }).hasAttribute('disabled')).toBe(true)
  expect(writes()).toHaveLength(0)
  expect(screen.queryByRole('textbox', { name: /Received now/ })).toBeNull()
  await user.type(
    screen.getByRole('textbox', { name: 'Reason no goods arrived' }),
    '  Supplier did not arrive  ',
  )
  await user.click(screen.getByRole('button', { name: 'Confirm No Receipt' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(writes()[0].body).toEqual({ expectedRevision: 1, items: [], noReceiptReason: 'Supplier did not arrive' })
  expect(delivery.outcome).toBe('NO_RECEIPT')
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('no receipt'))
})

it.each([
  ['-1', '0'],
  ['abc', '0'],
  ['1.001', '0'],
  ['1e2', '0'],
  ['10000000000', '0'],
  ['1', '-1'],
  ['1', '1.001'],
  ['1', '2'],
  ['0', '1'],
  ['7.01', '0'],
])(
  'rejects invalid or excessive received %s / damaged %s while retaining input',
  async (value, damage) => {
    mount()
    await screen.findByText('Banana')
  await choosePartial()
    fireEvent.change(received(), { target: { value } })
    fireEvent.change(damaged(), { target: { value: damage } })
    fireEvent.submit(screen.getByRole('button', { name: 'Confirm Receipt' }).closest('form')!)
    expect(within(received().closest('tr')!).getAllByRole('alert').length).toBeGreaterThan(0)
    expect(received().value).toBe(value)
    expect(damaged().value).toBe(damage)
    expect(writes()).toHaveLength(0)
  },
)

it('requires explicit actual quantities rather than assuming ordered goods were received', async () => {
  mount()
  await screen.findByText('Banana')
  await choosePartial()
  fireEvent.submit(screen.getByRole('button', { name: 'Confirm Receipt' }).closest('form')!)
  expect(screen.getByRole('button', { name: 'Confirm Receipt' }).hasAttribute('disabled')).toBe(true)
  expect(received().value).toBe('')
  expect(writes()).toHaveLength(0)
})

it('prevents repeated confirmation and closing while a receipt is pending', async () => {
  let release!: () => void
  gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const { onClose } = mount()
  await screen.findByText('Banana')
  await choosePartial()
  fireEvent.change(received(), { target: { value: '1.25' } })
  const form = screen.getByRole('button', { name: 'Confirm Receipt' }).closest('form')!
  fireEvent.submit(form)
  fireEvent.submit(form)
  await waitFor(() => expect(writes()).toHaveLength(1))
  expect(received().matches(':disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Close' }).hasAttribute('disabled')).toBe(true)
  expect(screen.getByRole('button', { name: 'Cancel' }).hasAttribute('disabled')).toBe(true)
  expect(toast.success).not.toHaveBeenCalled()
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(onClose).not.toHaveBeenCalled()
  await act(async () => release())
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
})

it.each([400, 403, 404, 409, 'network'] as const)(
  'retains quantities after a %s failure and requires refresh before retrying',
  async (status) => {
    failure = status
    const user = userEvent.setup()
    const { onClose } = mount()
    await screen.findByText('Banana')
  await choosePartial()
    fireEvent.change(received(), { target: { value: '1.25' } })
    fireEvent.change(damaged(), { target: { value: '0.25' } })
    await user.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(received().value).toBe('1.25')
    expect(damaged().value).toBe('0.25')
    expect(screen.getByRole('button', { name: 'Confirm Receipt' }).hasAttribute('disabled')).toBe(
      true,
    )
    expect(writes()).toHaveLength(1)
    expect(onClose).not.toHaveBeenCalled()
    expect(toast.success).not.toHaveBeenCalled()
    failure = undefined
    await user.click(screen.getByRole('button', { name: 'Refresh receipt data' }))
    await waitFor(() => expect(received().disabled).toBe(false))
    expect(received().value).toBe('1.25')
    await user.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  },
)

it('does not repeat an uncertain receipt when refresh finds the delivery already completed', async () => {
  failure = 'network'
  const user = userEvent.setup()
  mount()
  await screen.findByText('Banana')
  await choosePartial()
  fireEvent.change(received(), { target: { value: '1.25' } })
  await user.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
  await screen.findByRole('alert')
  delivery.status = 'COMPLETED'
  await user.click(screen.getByRole('button', { name: 'Refresh receipt data' }))
  expect((await screen.findAllByText(/Only a scheduled delivery can be received/)).length).toBeGreaterThan(0)
  expect(writes()).toHaveLength(1)
})

it('recovers from a failed detail fetch without using an incomplete list record', async () => {
  failLoad = true
  const user = userEvent.setup()
  mount()
  expect(await screen.findByRole('alert')).toBeTruthy()
  failLoad = false
  await user.click(screen.getByRole('button', { name: 'Refresh receipt data' }))
  expect(await screen.findByText('Banana')).toBeTruthy()
})

it('keeps existing staff permissions read-only', async () => {
  auth.isAdmin = false
  auth.isStaff = true
  mount()
  expect(await screen.findByText(/do not have permission/)).toBeTruthy()
  expect(screen.getAllByRole('radio').every((radio) => radio.matches(':disabled'))).toBe(true)
  expect(screen.getByRole('button', { name: 'Confirm Receipt' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(writes()).toHaveLength(0)
})

it('opens the actual receiving form from Incoming Deliveries and moves the confirmed delivery into history', async () => {
  const user = userEvent.setup()
  mount(<DeliveriesHub initialTab="incoming" />)
  await user.click(await screen.findByRole('button', { name: 'Receive Goods IN-90' }))
  expect(await screen.findByText('Banana')).toBeTruthy()
  await choosePartial()
  fireEvent.change(received(), { target: { value: '1.25' } })
  await user.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Receive Goods' })).toBeNull())
  expect(screen.queryByRole('button', { name: 'Receive Goods IN-90' })).toBeNull()
})

it('refreshes the rendered Stock Warnings and Quarantine views after a damaged receipt', async () => {
  function Integration() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Receive shipment</button>
        <StockNotifications onOpenInventory={vi.fn()} />
        <QuarantinedStock />
        {open && <ReceiveProductsModal deliveryId={90} onClose={() => setOpen(false)} />}
      </>
    )
  }
  const user = userEvent.setup()
  mount(<Integration />)
  await screen.findByRole('button', { name: /1 unresolved/ })
  await user.click(screen.getByRole('button', { name: 'Receive shipment' }))
  await choosePartial()
  fireEvent.change(received(), { target: { value: '1.25' } })
  fireEvent.change(damaged(), { target: { value: '0.25' } })
  await user.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Receive Goods' })).toBeNull())
  expect(screen.queryByRole('button', { name: /1 unresolved/ })).toBeNull()
  const quarantineSource = await screen.findByText('INCOMING DELIVERY')
  expect(within(quarantineSource.closest('tr')!).getByText('0.25')).toBeTruthy()
  expect(
    requests.filter((request) => request.url === '/stock-items/quarantine-lots').length,
  ).toBeGreaterThan(1)
  expect(requests.filter((request) => request.url === '/stock-items').length).toBeGreaterThan(1)
})

it('confirms a full remaining receipt across current purchase order line IDs', async () => {
  const user = userEvent.setup()
  const { onClose } = mount()
  await screen.findByText('Banana')
  await choosePartial()
  fireEvent.change(received(), { target: { value: '7.00' } })
  fireEvent.change(received('Mango'), { target: { value: '5.00' } })
  await user.click(screen.getByRole('button', { name: 'Confirm Receipt' }))
  await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  expect(writes()[0].body).toEqual({
    expectedRevision: 1,
    items: [
      { purchaseOrderItemId: 10, receivedQuantity: '7.00', damagedQuantity: '0.00' },
      { purchaseOrderItemId: 20, receivedQuantity: '5.00', damagedQuantity: '0.00' },
    ],
  })
})

it('shows a recoverable error for incomplete purchase order detail data', async () => {
  order.items = undefined as unknown as PurchaseOrderRecord['items']
  mount()
  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Confirm Receipt' }).hasAttribute('disabled')).toBe(
    true,
  )
  expect(screen.getByRole('button', { name: 'Refresh receipt data' })).toBeTruthy()
  expect(writes()).toHaveLength(0)
})

it('binds nested receipt issues to submitted purchase lines after skipped rows and restores local validation on edit', async () => {
  const adapter = getAdapter(apiClient.defaults.adapter)
  apiClient.defaults.adapter = async (config) => {
    if (config.method === 'patch' && config.url === '/incoming-deliveries/90/complete') {
      requests.push({ method: config.method, url: config.url, body: JSON.parse(config.data) })
      throw {
        isAxiosError: true,
        response: { status: 400, data: {
          message: 'Review receipt quantities',
          issues: [{ path: 'items[0].receivedQuantity', code: 'invalid', message: 'Supplier count must be checked' }],
        } },
      }
    }
    return adapter(config)
  }
  const { onClose } = mount()
  await choosePartial()
  fireEvent.change(received('Banana'), { target: { value: '0' } })
  fireEvent.change(received('Mango'), { target: { value: '1' } })
  fireEvent.submit(screen.getByRole('button', { name: 'Confirm Receipt' }).closest('form')!)
  const issue = await screen.findByText('Supplier count must be checked')
  expect(received('Mango').getAttribute('aria-describedby')).toBe(issue.id)
  expect(received('Mango').getAttribute('aria-invalid')).toBe('true')
  expect(received('Banana').getAttribute('aria-invalid')).toBe('false')
  expect(writes()[0].body.items).toEqual([{ purchaseOrderItemId: 20, receivedQuantity: '1.00', damagedQuantity: '0.00' }])
  expect(received('Mango').value).toBe('1')
  expect(onClose).not.toHaveBeenCalled()
  fireEvent.change(received('Mango'), { target: { value: '-1' } })
  expect(screen.queryByText('Supplier count must be checked')).toBeNull()
  expect(received('Mango').getAttribute('aria-invalid')).toBe('true')
  expect(within(received('Mango').closest('tr')!).getAllByRole('alert').length).toBeGreaterThan(0)
  expect(writes()).toHaveLength(1)
})

it('loads receiving products, supplier and warehouse by ID without downloading selector collections', async () => {
  mount()
  await choosePartial()
  expect(received('Banana')).toBeTruthy()
  expect(received('Mango')).toBeTruthy()
  await screen.findByText('Saved supplier')
  expect(screen.getByText('Saved warehouse')).toBeTruthy()
  const urls = requests.map((request) => request.url)
  expect(urls).toEqual(expect.arrayContaining(['/inventory-items/1', '/inventory-items/2', '/warehouses/2', '/suppliers/70']))
  expect(urls.some((url) => ['/inventory-items', '/warehouses', '/suppliers'].includes(url))).toBe(false)
})

it('keeps receipt counts while failed product details are explicitly refreshed', async () => {
  const base = getAdapter(apiClient.defaults.adapter)
  let failing = true
  apiClient.defaults.adapter = async (config) => {
    if (failing && config.url === '/inventory-items/2') throw Error('Product details unavailable')
    return base(config)
  }
  mount()
  await screen.findByText('Banana')
  await waitFor(() => expect(screen.getByRole('radio', { name: 'Some goods arrived or were damaged' }).matches(':disabled')).toBe(true))
  failing = false
  fireEvent.click(screen.getByRole('button', { name: 'Refresh receipt data' }))
  await choosePartial()
  fireEvent.change(received(), { target: { value: '1.25' } })
  fireEvent.click(screen.getByRole('button', { name: 'Refresh receipt data' }))
  await waitFor(() => expect(received().hasAttribute('disabled')).toBe(false))
  expect(received().value).toBe('1.25')
  expect(writes()).toHaveLength(0)
})
