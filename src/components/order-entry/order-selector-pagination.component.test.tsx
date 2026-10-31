import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { OrderModal } from '@/components/orders/OrderModal'
import { PurchaseModal } from '@/components/purchases/PurchaseModal'
import { buildSalesOrderPayload } from '@/features/crm/sales-order-entry.utils'
import type { OrderFormValues } from '@/features/crm/sales-order-entry.types'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
const dates = { createdAt: '', updatedAt: '' }
const products = [1, 2].map((id) => ({
  ...dates,
  id,
  name: `Product ${id}`,
  unit: 'kg',
  unitPrice: '20.00',
  description: null,
  isActive: true,
}))
const parties = [1, 2].map((id) => ({
  ...dates,
  id,
  name: `Party ${id}`,
  code: `S${id}`,
  address: `Address ${id}`,
  contactPerson: null,
  phone: null,
  email: null,
  isActive: true,
}))
function mount(
  kind: 'PO' | 'SO',
  { failure = '', empty = false }: { failure?: string; empty?: boolean } = {},
) {
  let failing = failure
  const path = kind === 'PO' ? '/suppliers' : '/clients'
  const reads: { url: string; params: Record<string, unknown> }[] = []
  const saves: unknown[] = []
  apiClient.defaults.adapter = async (config) => {
    const url = config.url!,
      params = config.params ?? {}
    reads.push({ url, params: { ...params } })
    if (url === failing || (failing === 'INVALID_CURSOR' && params.cursor))
      throw new AxiosError('Lookup failed', undefined, config, undefined, {
        config,
        status: 400,
        statusText: '',
        headers: {},
        data: {
          code: failing === 'INVALID_CURSOR' ? 'INVALID_CURSOR' : 'UNAVAILABLE',
          detail: 'Lookup failed.',
        },
      })
    if (url !== path && url !== '/inventory-items') throw Error(`Unexpected request ${url}`)
    const records = url === path ? parties : products
    const items = empty
      ? []
      : params.q
        ? records.filter((record) => record.name.includes(String(params.q)))
        : params.cursor
          ? records
          : records.slice(0, 1)
    return {
      config,
      data: { items, nextCursor: empty || params.q || params.cursor ? null : `${url}-2` },
      status: 200,
      statusText: '',
      headers: {},
    }
  }
  const close = vi.fn()
  const confirmed = vi.fn(async (id: number, revision: number) => ({
    id,
    revision: revision + 1,
    orderNumber: `${kind}-99`,
    status: 'CONFIRMED',
  }))
  const common = {
    open: true,
    remoteSelectors: true,
    onClose: close,
    products: [],
    onConfirm: confirmed,
  }
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={client}>
      {kind === 'PO' ? (
        <PurchaseModal
          {...common}
          suppliers={[]}
          processedBy="Tester"
          onSubmit={async (payload) => {
            saves.push(payload)
            return { id: 99, revision: 5, orderNumber: 'PO-99', status: 'DRAFT' }
          }}
        />
      ) : (
        <OrderModal
          {...common}
          clients={[]}
          cashier="Tester"
          onSubmit={async (values: OrderFormValues) => {
            saves.push(buildSalesOrderPayload(values))
            return { id: 99, revision: 5, orderNumber: 'SO-99', status: 'DRAFT' }
          }}
        />
      )}
    </QueryClientProvider>,
  )
  return {
    path,
    reads,
    saves,
    close,
    confirmed,
    recover: () => {
      failing = ''
    },
  }
}
const partyButton = (kind: 'PO' | 'SO') =>
  screen.getByRole('button', {
    name: kind === 'PO' ? 'Search and choose a supplier' : 'Search and choose a customer',
  })
async function chooseParty(kind: 'PO' | 'SO', second = true) {
  await userEvent.click(partyButton(kind))
  if (second)
    await userEvent.click(await screen.findByRole('button', { name: 'Load more results' }))
  await userEvent.click(
    await screen.findByRole('menuitem', { name: second ? /Party 2/ : /Party 1/ }),
  )
}
const catalog = async () => {
  await userEvent.click(screen.getByRole('tab', { name: 'Product Catalog' }))
}
const quantity = () =>
  screen.getByRole('textbox', { name: 'Quantity for Product 2' }) as HTMLInputElement

it.each(['PO', 'SO'] as const)(
  '%s pages both lookups, retains off-page selections and edited terms, and increments one line',
  async (kind) => {
    const { reads, saves, path } = mount(kind)
    expect(reads.some((read) => read.url === path)).toBe(false)
    expect(reads.some((read) => read.params.cursor)).toBe(false)
    await chooseParty(kind)
    expect(reads.find((read) => read.params.cursor === `${path}-2`)?.params).toEqual({
      includeInactive: 'false',
      limit: 50,
      cursor: `${path}-2`,
    })
    await catalog()
    await userEvent.click(await screen.findByRole('button', { name: 'Load more products' }))
    expect(screen.getAllByRole('button', { name: 'Add Product 1' })).toHaveLength(1)
    expect(reads.find((read) => read.params.cursor === '/inventory-items-2')?.params).toEqual({
      includeInactive: 'false',
      limit: 50,
      cursor: '/inventory-items-2',
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Add Product 2' }))
    fireEvent.change(quantity(), { target: { value: '2.25' } })
    if (kind === 'PO')
      fireEvent.change(screen.getByRole('textbox', { name: 'Unit cost for Product 2' }), {
        target: { value: '10.20' },
      })
    await catalog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Search inventory products' }), {
      target: { value: 'Product 1' },
    })
    await screen.findByRole('button', { name: 'Add Product 1' })
    fireEvent.change(screen.getByRole('textbox', { name: 'Search inventory products' }), {
      target: { value: 'Product 2' },
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Add Product 2' }))
    expect(quantity().value).toBe('3.25')
    expect(screen.getAllByRole('textbox', { name: 'Quantity for Product 2' })).toHaveLength(1)
    await userEvent.click(partyButton(kind))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'No match' } })
    await screen.findByText('No matching results.')
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    expect(partyButton(kind).textContent).toContain('Party 2')
    await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(saves).toHaveLength(1))
    expect(saves[0]).toMatchObject({
      [kind === 'PO' ? 'supplierId' : 'clientId']: 2,
      items: [
        {
          inventoryItemId: 2,
          quantity: '3.25',
          unitPrice: kind === 'PO' ? '10.20' : '20.00',
          taxRate: '12.00',
        },
      ],
    })
    expect(
      reads.filter((read) => read.params.q).every((read) => read.params.cursor === undefined),
    ).toBe(true)
  },
)

it.each(['PO', 'SO'] as const)(
  '%s recovers invalid party cursors explicitly and keeps form data',
  async (kind) => {
    const { reads, recover } = mount(kind, { failure: 'INVALID_CURSOR' })
    await userEvent.click(partyButton(kind))
    await userEvent.click(await screen.findByRole('button', { name: 'Load more results' }))
    await screen.findByRole('button', { name: 'Reload results' })
    expect(reads.filter((read) => read.params.cursor)).toHaveLength(1)
    recover()
    await userEvent.click(screen.getByRole('button', { name: 'Reload results' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Party 1/ }))
    expect(partyButton(kind).textContent).toContain('Party 1')
  },
)

it('keeps supplier optional for an incomplete PO draft', async () => {
  const { saves, confirmed } = mount('PO', { empty: true })
  await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await waitFor(() => expect(saves).toHaveLength(1))
  expect(saves[0]).toMatchObject({ supplierId: null, items: [] })
  expect(confirmed).not.toHaveBeenCalled()
})

it('requires a customer and preserves confirmation prerequisites for a SO', async () => {
  const { saves, confirmed } = mount('SO', { empty: true })
  await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await screen.findByText('Select an active customer.')
  expect(saves).toHaveLength(0)
  await userEvent.click(partyButton('SO'))
  await screen.findByText('No matching results.')
  fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
  expect(confirmed).not.toHaveBeenCalled()
})

it('reports failed product requests, reloads only the first page, and does not reset the customer', async () => {
  const { recover, reads } = mount('SO', { failure: '/inventory-items' })
  await chooseParty('SO', false)
  await catalog()
  await screen.findByRole('alert')
  recover()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByRole('button', { name: 'Add Product 1' })
  await userEvent.click(screen.getByRole('tab', { name: /Order Editor/ }))
  expect(partyButton('SO').textContent).toContain('Party 1')
  expect(
    reads
      .filter((read) => read.url === '/inventory-items')
      .every((read) => read.params.cursor === undefined),
  ).toBe(true)
})

it.each(['PO', 'SO'] as const)('%s keeps selected lines when the party changes', async (kind) => {
  const { saves } = mount(kind)
  await chooseParty(kind)
  await catalog()
  await userEvent.click(await screen.findByRole('button', { name: 'Add Product 1' }))
  if (kind === 'PO')
    fireEvent.change(screen.getByRole('textbox', { name: 'Unit cost for Product 1' }), {
      target: { value: '8.25' },
    })
  await chooseParty(kind, false)
  expect(screen.getByRole('textbox', { name: 'Quantity for Product 1' })).toBeTruthy()
  if (kind === 'SO')
    expect(
      (screen.getByLabelText('Delivery Address (optional for drafts)') as HTMLInputElement).value,
    ).toBe('Address 1')
  await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await waitFor(() => expect(saves).toHaveLength(1))
  expect(saves[0]).toMatchObject({
    [kind === 'PO' ? 'supplierId' : 'clientId']: 1,
    items: [{ inventoryItemId: 1, quantity: '1' }],
  })
})

it.each(['PO', 'SO'] as const)(
  '%s preserves confirmation requirements and uses the saved revision',
  async (kind) => {
    const { saves, confirmed, close } = mount(kind)
    await chooseParty(kind)
    await catalog()
    await userEvent.click(await screen.findByRole('button', { name: 'Add Product 1' }))
    if (kind === 'PO')
      fireEvent.change(screen.getByRole('textbox', { name: 'Unit cost for Product 1' }), {
        target: { value: '12.30' },
      })
    const button = screen.getByRole('button', {
      name: kind === 'PO' ? 'Confirm Purchase Order' : 'Confirm Order',
    })
    if (kind === 'SO') {
      fireEvent.change(screen.getByLabelText('Delivery Address (optional for drafts)'), {
        target: { value: '' },
      })
      await userEvent.click(button)
      await screen.findByText('Enter the delivery address.')
      expect(saves).toHaveLength(0)
      fireEvent.change(screen.getByLabelText('Delivery Address (optional for drafts)'), {
        target: { value: 'Delivery dock' },
      })
    }
    await userEvent.click(button)
    await waitFor(() => expect(close).toHaveBeenCalledOnce())
    expect(saves).toHaveLength(1)
    expect(confirmed).toHaveBeenCalledExactlyOnceWith(99, 5)
  },
)

it('shows an empty remote product catalog without fabricated stock or products', async () => {
  mount('PO', { empty: true })
  await catalog()
  await screen.findByText('No active products available.')
  expect(screen.queryByRole('button', { name: /^Add Product \d+$/ })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Load more products' })).toBeNull()
})

it('recovers an invalid product cursor without resetting the selected customer', async () => {
  const { recover, reads } = mount('SO', { failure: 'INVALID_CURSOR' })
  await chooseParty('SO', false)
  await catalog()
  await userEvent.click(await screen.findByRole('button', { name: 'Load more products' }))
  await screen.findByRole('button', { name: 'Retry' })
  expect(
    reads.filter((read) => read.url === '/inventory-items' && read.params.cursor),
  ).toHaveLength(1)
  recover()
  await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
  await screen.findByRole('button', { name: 'Add Product 1' })
  await userEvent.click(screen.getByRole('tab', { name: /Order Editor/ }))
  expect(partyButton('SO').textContent).toContain('Party 1')
})

it('saves an incomplete SO draft with an off-page customer and no delivery address', async () => {
  const { saves, confirmed } = mount('SO')
  await chooseParty('SO')
  fireEvent.change(screen.getByLabelText('Delivery Address (optional for drafts)'), { target: { value: '' } })
  await userEvent.click(screen.getByRole('button', { name: 'Save Draft' }))
  await waitFor(() => expect(saves).toHaveLength(1))
  expect(saves[0]).toMatchObject({ clientId: 2, deliveryAddress: '', items: [] })
  expect(confirmed).not.toHaveBeenCalled()
})
