import type { OrderFormValues } from './crm/sales-order-entry.types'
import type { CreatePurchaseOrderPayload } from './logistics/purchase-orders.types'
import type { SavedOrder } from '@/hooks/use-order-submission'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest'
import { OrderModal } from '@/components/orders/OrderModal'
import { PurchaseModal } from '@/components/purchases/PurchaseModal'
import { buildSalesOrderPayload } from './crm/sales-order-entry.utils'
import { createSalesOrderApi, updateSalesOrderDraftApi } from './crm/sales-orders.api'
import {
  createPurchaseOrderApi,
  updatePurchaseOrderDraftApi,
} from './logistics/purchase-orders.api'
import { apiClient } from '@/lib/api-client'
import type { PurchaseOrderRecord } from './logistics/purchase-orders.types'
import {
  orderLineAmounts,
  orderLineTotals,
  savedLineDiscount,
  discountFields,
} from '@/lib/order-line-pricing'

const stamps = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
const products = [
  {
    id: 1,
    name: 'Test Mango',
    variety: null,
    unit: 'kg',
    description: null,
    unitPrice: '100.00',
    isActive: true,
    ...stamps,
  },
]
const clients = [
  {
    id: 1,
    name: 'Customer',
    address: 'Davao',
    contactPerson: null,
    phone: null,
    email: null,
    isActive: true,
    ...stamps,
  },
]
const suppliers = [
  {
    id: 1,
    code: 'SUP-1',
    name: 'Supplier',
    address: 'Davao',
    contactPerson: null,
    phone: null,
    email: null,
    isActive: true,
    ...stamps,
  },
]
const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

describe('precise backend line arithmetic', () => {
  const base = { quantity: '2.00', unitPrice: '100.00', taxRate: '12.00' }
  it.each([
    { name: 'no discount', fields: {}, discount: '0.00', vat: '24.00', total: '224.00' },
    {
      name: 'percentage',
      fields: { discountRate: '10.00' },
      discount: '20.00',
      vat: '21.60',
      total: '201.60',
    },
    {
      name: 'fixed once for the whole line',
      fields: { discountAmount: '10.00' },
      discount: '10.00',
      vat: '22.80',
      total: '212.80',
    },
    {
      name: 'explicit fixed zero',
      fields: { discountAmount: '0.00' },
      discount: '0.00',
      vat: '24.00',
      total: '224.00',
    },
    {
      name: 'full subtotal',
      fields: { discountAmount: '200.00' },
      discount: '200.00',
      vat: '0.00',
      total: '0.00',
    },
    {
      name: '100 percent',
      fields: { discountRate: '100.00' },
      discount: '200.00',
      vat: '0.00',
      total: '0.00',
    },
  ])('$name follows subtotal → discount → tax', ({ fields, discount, vat, total }) => {
    expect(orderLineAmounts({ ...base, ...fields })).toEqual({
      subtotal: '200.00',
      discount,
      vat,
      total,
    })
  })
  it.each([
    { discountAmount: '-0.01' },
    { discountAmount: '0.001' },
    { discountAmount: '200.01' },
    { discountRate: '100.01' },
    { discountRate: '-1' },
    { discountRate: '1.001' },
    { discountRate: '0.00', discountAmount: '0.00' },
  ])('rejects invalid discount fields %j', (fields) => {
    expect(orderLineAmounts({ ...base, ...fields })).toBeNull()
  })
  it('compares fixed discounts against the rounded subtotal and sums rounded lines', () => {
    expect(
      orderLineAmounts({
        quantity: '0.50',
        unitPrice: '0.05',
        discountAmount: '0.03',
        taxRate: '5.00',
      }),
    ).toEqual({ subtotal: '0.03', discount: '0.03', vat: '0.00', total: '0.00' })
    expect(
      orderLineAmounts({ quantity: '1', unitPrice: '9999999999.99', discountAmount: '0.01' })
        ?.total,
    ).toBe('9999999999.98')
    expect(
      orderLineTotals(
        [1, 2].map(() => ({
          quantity: '0.01',
          unitPrice: '0.50',
          discountRate: '50',
          taxRate: '5.00',
        })),
      ),
    ).toEqual({ subtotal: '0.02', discount: '0.02', vat: '0.00', total: '0.00' })
    expect(orderLineAmounts({ ...base, discountAmount: '10.01', taxRate: '5.00' })?.total).toBe(
      '199.49',
    )
  })
  it('distinguishes saved fixed amounts from calculated percentage response amounts', () => {
    expect(
      discountFields(savedLineDiscount({ discountRate: '0.00', discountAmount: '10.01' })),
    ).toEqual({ discountAmount: '10.01' })
    expect(
      discountFields(savedLineDiscount({ discountRate: '5.00', discountAmount: '10.00' })),
    ).toEqual({ discountRate: '5.00' })
  })
})

describe('discount request contracts', () => {
  const endpoints = [
    {
      name: 'sales create',
      path: '/sales-orders',
      send: (item: object) =>
        createSalesOrderApi({ clientId: 1, deliveryAddress: 'Davao', items: [item] } as Parameters<
          typeof createSalesOrderApi
        >[0]),
    },
    {
      name: 'purchase create',
      path: '/purchase-orders',
      send: (item: object) =>
        createPurchaseOrderApi({ items: [item] } as Parameters<typeof createPurchaseOrderApi>[0]),
    },
    {
      name: 'purchase draft',
      path: '/purchase-orders/7/draft',
      send: (item: object) =>
        updatePurchaseOrderDraftApi(7, { expectedRevision: 1, items: [item] } as Parameters<
          typeof updatePurchaseOrderDraftApi
        >[1]),
    },
  ]
  const baseLine = { inventoryItemId: 1, quantity: '2.00', unitPrice: '100.00', taxRate: '12.00' }
  it.each(endpoints)(
    'sends exact fixed pesos and preserves authoritative response totals for $name',
    async ({ path, send }) => {
      const server = {
        id: 7,
        items: [
          { ...baseLine, discountRate: '0.00', discountAmount: '10.01', totalAmount: '212.79' },
        ],
      }
      apiClient.defaults.adapter = async (config) => {
        expect(config.url).toBe(path)
        expect(JSON.parse(config.data).items).toEqual([{ ...baseLine, discountAmount: '10.01' }])
        return { config, status: 200, statusText: 'OK', headers: {}, data: server }
      }
      await expect(send({ ...baseLine, discountAmount: '10.01' })).resolves.toEqual(server)
    },
  )
  it.each(endpoints)(
    'rejects simultaneous discount fields, including zero, before sending $name',
    async ({ send }) => {
      const adapter = vi.fn()
      apiClient.defaults.adapter = adapter
      await expect(
        send({ ...baseLine, discountAmount: '0.00', discountRate: '0.00' }),
      ).rejects.toThrow(/either|both/i)
      expect(adapter).not.toHaveBeenCalled()
    },
  )
  it('serializes the verified fixed-discount Sales Order draft contract', async () => {
    const bodies: unknown[] = []
    apiClient.defaults.adapter = async (config) => {
      bodies.push(JSON.parse(config.data))
      return {
        config,
        status: 200,
        statusText: '',
        headers: {},
        data: { id: 7, status: 'DRAFT', revision: 2 },
      }
    }
    await updateSalesOrderDraftApi(7, {
      expectedRevision: 1,
      items: [{ ...baseLine, discountAmount: '10.00' }],
    })
    expect(bodies).toEqual([
      { expectedRevision: 1, items: [{ ...baseLine, discountAmount: '10.00' }] },
    ])
  })
  it('rejects a zero sales draft revision before sending', async () => {
    const adapter = vi.fn()
    apiClient.defaults.adapter = adapter
    await expect(
      updateSalesOrderDraftApi(7, { expectedRevision: 0, notes: 'Change' }),
    ).rejects.toThrow(/revision/i)
    expect(adapter).not.toHaveBeenCalled()
  })
})

describe.each(['sales', 'purchase'] as const)('%s line discount editor', (kind) => {
  async function setup(
    options: {
      onSubmit?: Mock<(values: unknown, intent?: 'draft' | 'confirm') => Promise<SavedOrder>>
      onConfirm?: Mock<(id: number) => Promise<SavedOrder>>
    } = {},
  ) {
    const user = userEvent.setup()
    const onSubmit =
      options.onSubmit ??
      vi
        .fn<(values: unknown, intent?: 'draft' | 'confirm') => Promise<SavedOrder>>()
        .mockResolvedValue({ id: 7, orderNumber: 'ORDER-7', status: 'DRAFT' })
    if (kind === 'sales') {
      render(
        <OrderModal
          open
          clients={clients}
          products={products}
          cashier="Manager"
          onSubmit={onSubmit}
          onConfirm={options.onConfirm}
          onClose={vi.fn()}
        />,
      )
      await user.click(screen.getByRole('button', { name: 'Search and choose a customer' }))
      await user.click(screen.getByRole('menuitem', { name: 'Customer' }))
    } else
      render(
        <PurchaseModal
          open
          suppliers={suppliers}
          products={products}
          processedBy="Manager"
          onSubmit={onSubmit}
          onConfirm={options.onConfirm}
          onClose={vi.fn()}
        />,
      )
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    if (kind === 'purchase')
      await user.type(screen.getByRole('textbox', { name: 'Unit cost for Test Mango' }), '100.00')
    return {
      user,
      onSubmit,
      payload: () =>
        kind === 'sales'
          ? buildSalesOrderPayload(onSubmit.mock.calls[0][0] as OrderFormValues)
          : (onSubmit.mock.calls[0][0] as CreatePurchaseOrderPayload),
    }
  }

  it('switches explicitly without converting values and submits only the selected discount', async () => {
    const { user, onSubmit, payload } = await setup()
    await user.click(screen.getByRole('button', { name: 'Edit discount for Test Mango' }))
    const input = screen.getByRole('textbox', { name: 'Line discount for Test Mango' })
    await user.clear(input)
    await user.type(input, '10')
    await user.click(screen.getByRole('combobox', { name: 'Discount type for Test Mango' }))
    await user.click(screen.getByRole('option', { name: '₱' }))
    expect((input as HTMLInputElement).value).toBe('')
    await user.type(input, '7.50')
    await user.click(screen.getByRole('combobox', { name: 'Discount type for Test Mango' }))
    await user.click(screen.getByRole('option', { name: '%' }))
    expect((input as HTMLInputElement).value).toBe('10')
    await user.click(screen.getByRole('combobox', { name: 'Discount type for Test Mango' }))
    await user.click(screen.getByRole('option', { name: '₱' }))
    expect((input as HTMLInputElement).value).toBe('7.50')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(payload().items[0]).toMatchObject({ discountAmount: '7.50' })
    expect(payload().items[0]).not.toHaveProperty('discountRate')
  })

  it.each(['-1', '1.001', '100.01'])(
    'rejects invalid fixed discount %s while preserving the input',
    async (value) => {
      const { user, onSubmit } = await setup()
      await user.click(screen.getByRole('button', { name: 'Edit discount for Test Mango' }))
      await user.click(screen.getByRole('combobox', { name: 'Discount type for Test Mango' }))
      await user.click(screen.getByRole('option', { name: '₱' }))
      const input = screen.getByRole('textbox', { name: 'Line discount for Test Mango' })
      fireEvent.change(input, { target: { value } })
      await user.keyboard('{Escape}')
      await user.click(screen.getByRole('button', { name: 'Save Draft' }))
      expect(onSubmit).not.toHaveBeenCalled()
      expect((input as HTMLInputElement).value).toBe(value)
      expect(input.getAttribute('aria-invalid')).toBe('true')
      expect(input.getAttribute('aria-describedby')).toBeTruthy()
    },
  )

  it('applies a fixed discount once per line and previews tax after the discount', async () => {
    const { user, onSubmit, payload } = await setup()
    const quantity = screen.getByRole('textbox', { name: 'Quantity for Test Mango' })
    fireEvent.change(quantity, { target: { value: '2' } })
    await user.click(screen.getByRole('button', { name: 'Edit discount for Test Mango' }))
    await user.click(screen.getByRole('combobox', { name: 'Discount type for Test Mango' }))
    await user.click(screen.getByRole('option', { name: '₱' }))
    await user.type(screen.getByRole('textbox', { name: 'Line discount for Test Mango' }), '10')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    const row = quantity.closest('tr')!
    expect(within(row).getByText('\u20b1212.80')).toBeTruthy()
    if (kind === 'purchase') {
      await user.click(screen.getByRole('button', { name: 'Edit discount for Test Mango' }))
      await user.click(screen.getByRole('switch', { name: 'VAT exempt for Test Mango' }))
      await user.click(screen.getByRole('button', { name: 'Done' }))
      expect(within(row).getByText('\u20b1190.00')).toBeTruthy()
    }
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(payload().items[0]).toMatchObject({ quantity: '2', discountAmount: '10', taxRate: kind === 'purchase' ? '0.00' : '12.00' })
  })

  it('shows authoritative saved line and overall totals while a confirmation failure remains recoverable', async () => {
    const onSubmit = vi
      .fn<(values: unknown, intent?: 'draft' | 'confirm') => Promise<SavedOrder>>()
      .mockResolvedValue({
        id: 7,
        revision: 1,
        orderNumber: 'ORDER-7',
        status: 'DRAFT',
        items: [
          {
            subtotalAmount: '100.00',
            discountAmount: '11.00',
            taxAmount: '7.00',
            totalAmount: '96.00',
          },
        ],
      })
    const onConfirm = vi
      .fn<(id: number) => Promise<SavedOrder>>()
      .mockRejectedValue(new Error('Confirmation unavailable'))
    const { user } = await setup({ onSubmit, onConfirm })
    if (kind === 'purchase') {
      await user.click(screen.getByRole('button', { name: 'Search and choose a supplier' }))
      await user.click(screen.getByRole('menuitem', { name: 'Supplier (SUP-1)' }))
    }
    await user.click(
      screen.getByRole('button', {
        name: kind === 'sales' ? 'Confirm Order' : 'Confirm Purchase Order',
      }),
    )
    expect(await screen.findByText(/Confirmation did not complete/)).toBeTruthy()
    expect(screen.getAllByText('₱96.00')).toHaveLength(2)
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onConfirm).toHaveBeenCalledExactlyOnceWith(7, 1)
  })
})

it('retains a fixed PO discount, saved VAT, notes and every intended line on draft replacement', async () => {
  const user = userEvent.setup()
  const draft: PurchaseOrderRecord = {
    id: 7,
    revision: 1,
    orderNumber: 'PO-7',
    status: 'DRAFT',
    supplierId: 1,
    orderedAt: stamps.createdAt,
    expectedAt: null,
    confirmedAt: null,
    completedAt: null,
    cancelledAt: null,
    externalReference: null,
    notes: null,
    ...stamps,
    items: [1, 2].map((id) => ({
      id,
      purchaseOrderId: 7,
      lineNumber: id,
      inventoryItemId: 1,
      quantity: '2.00',
      unitPrice: '100.00',
      discountRate: '0.00',
      discountAmount: '10.01',
      taxRate: '5.00',
      taxAmount: '9.50',
      subtotalAmount: '200.00',
      taxableAmount: '189.99',
      totalAmount: '199.49',
      notes: `Line ${id}`,
      ...stamps,
    })),
  }
  const onUpdateDraft = vi.fn().mockResolvedValue({ ...draft, revision: 2 })
  render(
    <PurchaseModal
      open
      suppliers={suppliers}
      products={products}
      draftOrder={draft}
      processedBy="Manager"
      onSubmit={vi.fn()}
      onUpdateDraft={onUpdateDraft}
      onClose={vi.fn()}
    />,
  )
  const costs = screen.getAllByRole('textbox', { name: 'Unit cost for Test Mango' })
  fireEvent.change(costs[1], { target: { value: '110.00' } })
  await user.click(screen.getByRole('button', { name: 'Save Draft' }))
  await waitFor(() => expect(onUpdateDraft).toHaveBeenCalledOnce())
  const items = onUpdateDraft.mock.calls[0][1].items
  expect(items).toHaveLength(2)
  expect(items[0].unitPrice).toBe('100.00')
  expect(items[1].unitPrice).toBe('110.00')
  expect(items[1]).toMatchObject({ discountAmount: '10.01', taxRate: '5.00', notes: 'Line 2' })
  expect(items[1]).not.toHaveProperty('discountRate')
})
