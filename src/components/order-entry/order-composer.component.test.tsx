import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PurchaseModal } from '@/components/purchases/PurchaseModal'
import { OrderModal } from '@/components/orders/OrderModal'
import { OrderProductCatalog } from './OrderProductCatalog'
import { buildSalesOrderPayload } from '@/features/crm/sales-order-entry.utils'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { StockItem } from '@/features/logistics/stock-items.types'

// Fixtures stay inside the test runtime; application queries are never replaced.
const timestamps = { createdAt: '2026-10-01', updatedAt: '2026-10-01' }
const products: InventoryItemResponse[] = [
  {
    id: 1,
    name: 'Test Mango',
    variety: 'Carabao',
    description: 'Fresh orchard harvest',
    unit: 'kg',
    unitPrice: '100.00',
    isActive: true,
    ...timestamps,
  },
  {
    id: 2,
    name: 'Test Banana with a long product identity for order entry',
    variety: 'Lakatan',
    description: 'Locally grown',
    unit: 'kg',
    unitPrice: '80.00',
    isActive: true,
    ...timestamps,
  },
]
const stocks: StockItem[] = [
  {
    id: 11,
    inventoryItemId: 1,
    warehouseId: 1,
    quantity: '12',
    reservedQuantity: '2',
    availableQuantity: '10',
    ...timestamps,
  },
  {
    id: 12,
    inventoryItemId: 1,
    warehouseId: 2,
    quantity: '8',
    reservedQuantity: '1',
    availableQuantity: '7',
    ...timestamps,
  },
]
const suppliers = [
  {
    id: 1,
    code: 'SUP-1',
    name: 'Test Supplier',
    contactPerson: null,
    phone: null,
    email: null,
    address: 'Davao',
    isActive: true,
    ...timestamps,
  },
]
const clients = [
  {
    id: 1,
    name: 'Test Customer',
    contactPerson: null,
    phone: null,
    email: null,
    address: 'Saved address',
    isActive: true,
    ...timestamps,
  },
]
const warehouses = [1, 2].map((id) => ({
  id,
  name: `Warehouse ${id}`,
  address: '',
  contactNumber: null,
  isActive: true,
  ...timestamps,
}))
const purchaseProps = {
  open: true,
  suppliers,
  products,
  stockItems: stocks,
  processedBy: 'Test Employee',
}
const salesProps = {
  open: true,
  clients,
  products,
  stockItems: stocks,
  warehouses,
  cashier: 'Test Employee',
}

beforeEach(() => {
  vi.mocked(window.matchMedia).mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaQueryList)
})

describe('purchase composer', () => {
  it('places each product unit beside its quantity instead of beneath the selected product name', async () => {
    const user = userEvent.setup()
    render(
      <PurchaseModal
        {...purchaseProps}
        products={[products[0], { ...products[1], unit: 'pieces' }]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    )
    for (const [product, unit] of [
      [products[0], 'kg'],
      [products[1], 'piece(s)'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: `Add ${product.name}` }))
      const input = screen.getByRole('textbox', { name: `Quantity for ${product.name}` })
      const row = within(input.closest('tr')!)
      const cells = row.getAllByRole('cell')
      expect(within(cells[0]).queryByText(unit)).toBeNull()
      expect(within(cells[1]).getByText(unit)).toBeTruthy()
      expect(input.getAttribute('aria-describedby')).toBeTruthy()
    }
  })

  it('returns keyboard focus to the launching control after the workspace closes', async () => {
    function Launcher() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>New purchase</button>
          <PurchaseModal
            {...purchaseProps}
            open={open}
            onClose={() => setOpen(false)}
            onSubmit={vi.fn()}
          />
        </>
      )
    }
    const user = userEvent.setup()
    render(<Launcher />)
    const launcher = screen.getByRole('button', { name: 'New purchase' })
    await user.click(launcher)
    expect(screen.getByRole('dialog')).toBeTruthy()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(launcher)
  })
  it('adds immediately, focuses quantity, preserves repeat edits/search, and permits purchasing unavailable stock', async () => {
    const user = userEvent.setup()
    render(<PurchaseModal {...purchaseProps} onClose={vi.fn()} onSubmit={vi.fn()} />)
    const catalog = within(screen.getByRole('region', { name: 'Product Catalog' }))
    await user.type(catalog.getByRole('textbox', { name: 'Search inventory products' }), 'orchard')
    await user.click(catalog.getByText('Test Mango'))
    const quantity = screen.getByRole('textbox', { name: 'Quantity for Test Mango' })
    const cost = screen.getByRole('textbox', { name: 'Unit cost for Test Mango' })
    expect(document.activeElement).toBe(quantity)
    expect((cost as HTMLInputElement).value).toBe('')
    await user.clear(quantity)
    await user.type(quantity, '2.25')
    await user.tab()
    expect(document.activeElement).toBe(cost)
    await user.type(cost, '10.20')
    expect(screen.getAllByText('₱22.95').length).toBe(3)
    await user.click(catalog.getByText(/Fresh orchard harvest/))
    expect(document.activeElement).toBe(quantity)
    expect((quantity as HTMLInputElement).value).toBe('3.25')
    expect((cost as HTMLInputElement).value).toBe('10.20')
    expect((catalog.getByRole('textbox') as HTMLInputElement).value).toBe('orchard')
    expect(screen.getAllByRole('textbox', { name: 'Quantity for Test Mango' })).toHaveLength(1)
    await user.clear(catalog.getByRole('textbox'))
    await user.click(catalog.getByRole('button', { name: `Add ${products[1].name}` }))
    expect(screen.getByRole('textbox', { name: `Quantity for ${products[1].name}` })).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Remove Test Mango' }))
    expect(screen.queryByRole('textbox', { name: 'Quantity for Test Mango' })).toBeNull()
  })

  it('saves the actual purchase fields and retains the whole draft after failure for retry', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 422, data: { message: 'Temporary API failure' } },
      })
      .mockResolvedValueOnce(undefined)
    render(<PurchaseModal {...purchaseProps} onClose={onClose} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Search and choose a supplier' }))
    await user.click(screen.getByRole('menuitem', { name: 'Test Supplier (SUP-1)' }))
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    await user.type(screen.getByRole('textbox', { name: 'Unit cost for Test Mango' }), '12.34')
    await user.click(screen.getByText('Additional details'))
    await user.type(screen.getByLabelText('Supplier Invoice / External Ref'), 'INV-1')
    fireEvent.change(screen.getByLabelText('Expected Delivery Date'), {
      target: { value: '2026-10-15' },
    })
    await user.type(screen.getByLabelText('Notes'), 'Delivery instructions')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Temporary API failure.')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect((screen.getByLabelText('Notes') as HTMLInputElement).value).toBe('Delivery instructions')
    expect(
      (screen.getByRole('textbox', { name: 'Unit cost for Test Mango' }) as HTMLInputElement).value,
    ).toBe('12.34')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onSubmit.mock.calls[1][0]).toEqual({
      supplierId: 1,
      expectedAt: '2026-10-15T00:00:00.000Z',
      externalReference: 'INV-1',
      notes: 'Delivery instructions',
      items: [{ inventoryItemId: 1, quantity: '1', unitPrice: '12.34' }],
    })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('saves a supplier-less draft without relaxing the confirmation requirement', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSubmit = vi.fn().mockResolvedValue({
      id: 8,
      orderNumber: 'PO-8',
      status: 'DRAFT',
    })
    render(<PurchaseModal {...purchaseProps} onClose={onClose} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    await user.type(screen.getByRole('textbox', { name: 'Unit cost for Test Mango' }), '12.34')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledWith(
      {
        supplierId: null,
        expectedAt: null,
        items: [{ inventoryItemId: 1, quantity: '1', unitPrice: '12.34' }],
      },
      'draft',
    )
    expect(screen.queryByRole('button', { name: 'Confirm Purchase Order' })).toBeNull()
  })

  it('updates an existing purchase draft while preserving its saved line terms', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const draftOrder: PurchaseOrderRecord = {
      id: 7,
      orderNumber: 'PO-DRAFT-7',
      status: 'DRAFT',
      supplierId: 1,
      orderedAt: '2026-10-01T00:00:00.000Z',
      expectedAt: '2026-10-15T00:00:00.000Z',
      confirmedAt: null,
      completedAt: null,
      cancelledAt: null,
      externalReference: 'INV-7',
      notes: 'Existing order notes',
      ...timestamps,
      items: [
        {
          id: 70,
          purchaseOrderId: 7,
          lineNumber: 1,
          inventoryItemId: 1,
          quantity: '2',
          unitPrice: '12.00',
          discountRate: '5.00',
          discountAmount: '1.20',
          taxRate: '12.00',
          taxAmount: '2.74',
          subtotalAmount: '24.00',
          taxableAmount: '22.80',
          totalAmount: '25.54',
          notes: 'Line terms',
          ...timestamps,
        },
      ],
    }
    const onUpdateDraft = vi.fn().mockResolvedValue(draftOrder)
    render(
      <PurchaseModal
        {...purchaseProps}
        draftOrder={draftOrder}
        onUpdateDraft={onUpdateDraft}
        onClose={onClose}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByRole('heading', { name: 'Edit Draft PO-DRAFT-7' })).toBeTruthy()
    await user.clear(screen.getByRole('textbox', { name: 'Unit cost for Test Mango' }))
    await user.type(screen.getByRole('textbox', { name: 'Unit cost for Test Mango' }), '13.20')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(onUpdateDraft).toHaveBeenCalledWith(7, {
      supplierId: 1,
      expectedAt: '2026-10-15T00:00:00.000Z',
      externalReference: 'INV-7',
      notes: 'Existing order notes',
      items: [
        {
          inventoryItemId: 1,
          quantity: '2',
          unitPrice: '13.20',
          discountRate: '5.00',
          taxRate: '12.00',
          notes: 'Line terms',
        },
      ],
    })
  })

  it('keeps one mobile workspace and retains editor values and catalog search across switches', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<PurchaseModal {...purchaseProps} onClose={onClose} onSubmit={vi.fn()} />)
    await user.click(screen.getByText('Additional details'))
    await user.type(screen.getByLabelText('Notes'), 'Keep this draft')
    await user.click(screen.getByRole('button', { name: 'Add Products' }))
    const catalog = within(screen.getByRole('tabpanel', { name: 'Product Catalog' }))
    expect(document.activeElement).toBe(catalog.getByRole('textbox'))
    await user.type(catalog.getByRole('textbox'), 'Carabao')
    await user.click(catalog.getByRole('button', { name: 'Add Test Mango' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(screen.getByRole('tabpanel', { name: 'Order Editor' })).toBeTruthy()
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Quantity for Test Mango' }),
    )
    expect((screen.getByLabelText('Notes') as HTMLInputElement).value).toBe('Keep this draft')
    await user.click(screen.getByRole('tab', { name: 'Product Catalog' }))
    expect(
      (
        within(screen.getByRole('tabpanel', { name: 'Product Catalog' })).getByRole(
          'textbox',
        ) as HTMLInputElement
      ).value,
    ).toBe('Carabao')
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Keep Editing' }))
    await user.click(screen.getByRole('tab', { name: /Order Editor/ }))
    expect((screen.getByLabelText('Notes') as HTMLInputElement).value).toBe('Keep this draft')
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await user.click(screen.getByRole('button', { name: 'Discard Changes' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('guards double submission and blocks dismissal while saving', async () => {
    const user = userEvent.setup()
    let finish: () => void = () => {}
    const onSubmit = vi.fn(
      () =>
        new Promise<{ id: number; orderNumber: string; status: string }>((resolve) => {
          finish = () => resolve({ id: 1, orderNumber: 'PO-1', status: 'DRAFT' })
        }),
    )
    const onClose = vi.fn()
    render(<PurchaseModal {...purchaseProps} onClose={onClose} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Search and choose a supplier' }))
    await user.click(screen.getByRole('menuitem', { name: 'Test Supplier (SUP-1)' }))
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    await user.type(screen.getByRole('textbox', { name: 'Unit cost for Test Mango' }), '0')
    await user.dblClick(screen.getByRole('button', { name: 'Save Draft' }))
    expect(onSubmit).toHaveBeenCalledOnce()
    expect((screen.getByRole('button', { name: 'Close' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    await user.keyboard('{Escape}')
    expect(onClose).not.toHaveBeenCalled()
    await act(async () => finish())
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('sales composer', () => {
  it('keeps compact pricing columns and saves edited amounts and metadata without sources', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ id: 1, orderNumber: 'SO-1', status: 'DRAFT' })
    render(<OrderModal {...salesProps} onClose={vi.fn()} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Search and choose a customer' }))
    await user.click(screen.getByRole('menuitem', { name: 'Test Customer' }))
    expect((screen.getByLabelText(/Delivery Address/) as HTMLInputElement).value).toBe(
      'Saved address',
    )
    await user.clear(screen.getByLabelText(/Delivery Address/))
    await user.type(screen.getByLabelText(/Delivery Address/), 'Edited address')
    await user.click(
      within(screen.getByRole('region', { name: 'Product Catalog' })).getByText('Test Mango'),
    )
    const quantity = screen.getByRole('textbox', { name: 'Quantity for Test Mango' })
    expect(document.activeElement).toBe(quantity)
    const items = within(screen.getByRole('region', { name: 'Sales order items' }))
    expect(items.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
      'Product',
      'Quantity',
      'Unit Price',
      'Discount',
      'Line Total',
      'Remove',
    ])
    expect(items.queryByRole('combobox', { name: /warehouse/i })).toBeNull()
    expect(screen.queryByText(/Warehouse source required|Choose warehouse/)).toBeNull()
    await user.clear(quantity)
    await user.type(quantity, '12.5')
    const price = screen.getByRole('textbox', { name: 'Unit price for Test Mango' })
    await user.clear(price)
    await user.type(price, '20')
    await user.click(screen.getByRole('button', { name: 'Edit discount for Test Mango' }))
    await user.clear(screen.getByRole('textbox', { name: 'Line discount for Test Mango' }))
    await user.type(screen.getByRole('textbox', { name: 'Line discount for Test Mango' }), '10')
    await user.click(screen.getByRole('button', { name: 'Done' }))
    await user.click(screen.getByText('Additional details'))
    await user.type(screen.getByLabelText('External Reference'), 'REF-2')
    fireEvent.change(screen.getByLabelText('Expected Delivery Date'), {
      target: { value: '2026-10-15' },
    })
    await user.type(screen.getByLabelText('Notes'), 'Leave at reception')
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    expect(document.activeElement).toBe(quantity)
    expect((quantity as HTMLInputElement).value).toBe('13.50')
    await user.clear(quantity)
    await user.type(quantity, '12.5')
    expect((price as HTMLInputElement).value).toBe('20')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(onSubmit).toHaveBeenCalledOnce()
    const values = onSubmit.mock.calls[0][0]
    expect(values.total).toBe('252.00')
    expect(buildSalesOrderPayload(values)).toEqual({
      clientId: 1,
      deliveryAddress: 'Edited address',
      expectedAt: '2026-10-15T00:00:00.000Z',
      externalReference: 'REF-2',
      notes: 'Leave at reception',
      items: [
        {
          inventoryItemId: 1,
          quantity: '12.5',
          unitPrice: '20',
          discountRate: '10',
          taxRate: '12.00',
        },
      ],
    })
  })

  it('preserves quantity validation and editable data after a draft API failure', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 422, data: { message: 'Try again' } },
      })
      .mockResolvedValueOnce({ id: 1, orderNumber: 'SO-1', status: 'DRAFT' })
    render(<OrderModal {...salesProps} onClose={onClose} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Search and choose a customer' }))
    await user.click(screen.getByRole('menuitem', { name: 'Test Customer' }))
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    const quantity = screen.getByRole('textbox', { name: 'Quantity for Test Mango' })
    await user.clear(quantity)
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(onSubmit).not.toHaveBeenCalled()
    await user.type(quantity, '2.25')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Try again.')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect((quantity as HTMLInputElement).value).toBe('2.25')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(onSubmit).toHaveBeenCalledTimes(2)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('creates and confirms a sales order without selecting warehouse sources', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ id: 42, orderNumber: 'SO-42', status: 'DRAFT' })
    const onConfirm = vi
      .fn()
      .mockResolvedValue({ id: 42, orderNumber: 'SO-42', status: 'CONFIRMED' })
    render(
      <OrderModal {...salesProps} onClose={vi.fn()} onSubmit={onSubmit} onConfirm={onConfirm} />,
    )
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    expect(screen.queryByRole('group', { name: /stock sources/i })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Search and choose a customer' }))
    await user.click(screen.getByRole('menuitem', { name: 'Test Customer' }))
    const confirm = screen.getByRole('button', { name: 'Confirm Order' })
    await user.click(confirm)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(buildSalesOrderPayload(onSubmit.mock.calls[0][0]).items[0]).toEqual({
      inventoryItemId: 1,
      quantity: '1',
      unitPrice: '100.00',
      discountRate: '0.00',
      taxRate: '12.00',
    })
    expect('allocations' in buildSalesOrderPayload(onSubmit.mock.calls[0][0]).items[0]).toBe(false)
    expect(onConfirm).toHaveBeenCalledWith(42)
  })

  it('allows creating a sales order for products with no available stock', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ id: 43, orderNumber: 'SO-43', status: 'DRAFT' })
    render(
      <OrderModal
        {...salesProps}
        stockItems={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Add Test Banana with a long product identity for order entry' }))
    await user.click(screen.getByRole('button', { name: 'Search and choose a customer' }))
    await user.click(screen.getByRole('menuitem', { name: 'Test Customer' }))
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    expect(buildSalesOrderPayload(onSubmit.mock.calls[0][0]).items[0].inventoryItemId).toBe(2)
    expect('allocations' in buildSalesOrderPayload(onSubmit.mock.calls[0][0]).items[0]).toBe(false)
  })

  it('saves edited sales quantities without adding fulfillment sources', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn().mockResolvedValue({ id: 1, orderNumber: 'SO-1', status: 'DRAFT' })
    render(<OrderModal {...salesProps} onClose={vi.fn()} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Search and choose a customer' }))
    await user.click(screen.getByRole('menuitem', { name: 'Test Customer' }))
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    const quantity = screen.getByRole('textbox', { name: 'Quantity for Test Mango' })
    await user.clear(quantity)
    await user.type(quantity, '12.50')
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
    const item = buildSalesOrderPayload(onSubmit.mock.calls[0][0]).items[0]
    expect(item.quantity).toBe('12.50')
    expect('allocations' in item).toBe(false)
    expect(screen.queryByRole('combobox', { name: /warehouse source/i })).toBeNull()
  })

  it('preserves mobile catalog state and optional details through collapse, failure and retry', async () => {
    vi.mocked(window.matchMedia).mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList)
    const user = userEvent.setup()
    const onClose = vi.fn()
    const onSubmit = vi
      .fn()
      .mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 422, data: { message: 'Try again' } },
      })
      .mockResolvedValueOnce(undefined)
    render(<OrderModal {...salesProps} onClose={onClose} onSubmit={onSubmit} />)
    await user.click(screen.getByRole('button', { name: 'Search and choose a customer' }))
    await user.click(screen.getByRole('menuitem', { name: 'Test Customer' }))
    await user.click(screen.getByText('Additional details'))
    await user.type(screen.getByLabelText('External Reference'), 'Keep reference')
    await user.type(screen.getByLabelText('Notes'), 'Keep notes')
    await user.click(screen.getByText('Additional details'))
    expect(screen.queryByRole('textbox', { name: 'Notes' })).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Add Products' }))
    const search = screen.getByRole('textbox', { name: 'Search inventory products' })
    expect(document.activeElement).toBe(search)
    await user.type(search, 'orchard')
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(document.activeElement).toBe(
      screen.getByRole('textbox', { name: 'Quantity for Test Mango' }),
    )
    expect(screen.queryByRole('group', { name: 'Warehouse allocations for Test Mango' })).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Product Catalog' }))
    expect(
      (screen.getByRole('textbox', { name: 'Search inventory products' }) as HTMLInputElement)
        .value,
    ).toBe('orchard')
    await user.click(screen.getByRole('tab', { name: 'Order Editor (1)' }))
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    expect(await screen.findByText('Try again.')).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      externalReference: 'Keep reference',
      notes: 'Keep notes',
    })
    await user.click(screen.getByText('Additional details'))
    expect((screen.getByLabelText('Notes') as HTMLInputElement).value).toBe('Keep notes')
    expect((screen.getByLabelText('External Reference') as HTMLInputElement).value).toBe(
      'Keep reference',
    )
    await user.click(screen.getByRole('button', { name: 'Save Draft' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(onSubmit).toHaveBeenCalledTimes(2)
  })
})

describe('shared catalog', () => {
  it.each([false, true])(
    'puts Add first and adds once from button, keyboard or any row cell (sales: %s)',
    async (sales) => {
      const user = userEvent.setup()
      const onAdd = vi.fn()
      render(
        <OrderProductCatalog
          products={products}
          stockItems={stocks}
          onAdd={onAdd}
          busy={false}
          sales={sales}
        />,
      )
      expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual([
        'Add',
        'Product',
        sales ? 'Available Stock' : 'Total Stock',
      ])
      const add = screen.getByRole('button', { name: 'Add Test Mango' })
      await user.click(add)
      expect(onAdd).toHaveBeenCalledTimes(1)
      await user.click(screen.getByText('Test Mango'))
      expect(onAdd).toHaveBeenCalledTimes(2)
      await user.click(screen.getByText(/Fresh orchard harvest/))
      expect(onAdd).toHaveBeenCalledTimes(3)
      await user.click(screen.getByText(sales ? '17 kg' : '20 kg'))
      expect(onAdd).toHaveBeenCalledTimes(4)
      await user.click(add.closest('tr')!)
      expect(onAdd).toHaveBeenCalledTimes(5)
      add.focus()
      await user.keyboard('{Enter}')
      expect(onAdd).toHaveBeenCalledTimes(6)
      await user.keyboard(' ')
      expect(onAdd).toHaveBeenCalledTimes(7)
      expect(onAdd.mock.calls.every(([product]) => product === products[0])).toBe(true)
    },
  )

  it('keeps whole-row sales additions stock-independent and respects read-only state', async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()
    const props = { products, stockItems: stocks, onAdd, busy: false, sales: true }
    const { rerender } = render(<OrderProductCatalog {...props} state={{ stockLoading: true }} />)
    await user.click(screen.getByText('Test Mango'))
    expect(onAdd).toHaveBeenCalledTimes(1)
    rerender(<OrderProductCatalog {...props} state={{ stockError: 'Disconnected' }} />)
    await user.click(screen.getByText('Test Mango'))
    expect(onAdd).toHaveBeenCalledTimes(2)
    rerender(<OrderProductCatalog {...props} />)
    await user.click(screen.getByText(products[1].name))
    expect(onAdd).toHaveBeenCalledTimes(3)
    rerender(<OrderProductCatalog {...props} stockItems={[{ ...stocks[0], quantity: 'bad' }]} />)
    await user.click(screen.getByText('Test Mango'))
    expect(onAdd).toHaveBeenCalledTimes(4)
    rerender(<OrderProductCatalog {...props} busy />)
    await user.click(screen.getByText('Test Mango'))
    expect(onAdd).toHaveBeenCalledTimes(4)
    rerender(<OrderProductCatalog {...props} sales={false} busy />)
    await user.click(screen.getByText('Test Mango'))
    expect(onAdd).toHaveBeenCalledTimes(4)
    rerender(
      <OrderProductCatalog
        {...props}
        sales={false}
        stockItems={[]}
        state={{ stockError: 'Disconnected' }}
      />,
    )
    await user.click(screen.getByText(products[1].name))
    expect(onAdd).toHaveBeenCalledTimes(5)
    expect(onAdd).toHaveBeenCalledWith(products[1])
  })

  it('sorts sales by unreserved availability while purchase keeps physical stock ordering', async () => {
    const user = userEvent.setup()
    const list = [products[0], { ...products[1], name: 'Test Banana' }]
    const stockItems = [
      stocks[0],
      { ...stocks[1], inventoryItemId: 2, quantity: '30', reservedQuantity: '29', availableQuantity: '1' },
    ]
    const props = { products: list, stockItems, onAdd: vi.fn(), busy: false }
    const { rerender } = render(<OrderProductCatalog {...props} sales />)
    await user.click(screen.getByRole('button', { name: 'Available Stock' }))
    expect(screen.getAllByRole('button', { name: /^Add Test/ })[0].getAttribute('aria-label')).toBe(
      'Add Test Banana',
    )
    rerender(<OrderProductCatalog {...props} />)
    expect(screen.getByRole('button', { name: 'Total Stock' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Add Test/ })[0].getAttribute('aria-label')).toBe(
      'Add Test Mango',
    )
  })
  it('searches metadata, preserves sorting and pagination, and has keyboard add controls', async () => {
    const user = userEvent.setup()
    const list = Array.from({ length: 15 }, (_, index) => ({
      ...products[0],
      id: index + 1,
      name: `Product ${String(index + 1).padStart(2, '0')}`,
    }))
    const onAdd = vi.fn()
    render(<OrderProductCatalog products={list} stockItems={[]} onAdd={onAdd} busy={false} />)
    expect(screen.getAllByRole('button', { name: /^Add Product/ })).toHaveLength(10)
    await user.click(screen.getByRole('button', { name: 'Next Page' }))
    expect(screen.getAllByRole('button', { name: /^Add Product/ })).toHaveLength(5)
    await user.type(screen.getByRole('textbox'), 'Product 01')
    expect(screen.getAllByRole('button', { name: /^Add Product/ })).toHaveLength(1)
    await user.clear(screen.getByRole('textbox'))
    await user.click(screen.getByRole('button', { name: 'Product' }))
    await user.click(screen.getByRole('button', { name: 'Product' }))
    expect(
      screen.getAllByRole('button', { name: /^Add Product/ })[0].getAttribute('aria-label'),
    ).toBe('Add Product 15')
    screen.getByRole('button', { name: 'Add Product 15' }).focus()
    await user.keyboard('{Enter}')
    expect(onAdd).toHaveBeenCalledWith(list[14])
    await user.type(screen.getByRole('textbox'), 'No such product')
    expect(screen.getByText('No products match your search.')).toBeTruthy()
  })

  it('renders loading and retry states while keeping sales order item selection independent of stock', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const props = { products, stockItems: stocks, onAdd: vi.fn(), sales: true, busy: false }
    const { rerender } = render(
      <OrderProductCatalog {...props} state={{ productsLoading: true }} />,
    )
    expect(screen.getByText('Loading products…')).toBeTruthy()
    rerender(<OrderProductCatalog {...props} state={{ stockError: 'Disconnected', onRetry }} />)
    expect(
      (screen.getByRole('button', { name: 'Add Test Mango' }) as HTMLButtonElement).disabled,
    ).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'Add Test Mango' }))
    rerender(<OrderProductCatalog {...props} />)
    expect(
      (screen.getByRole('button', { name: `Add ${products[1].name}` }) as HTMLButtonElement)
        .disabled,
    ).toBe(false)
    await user.click(screen.getByRole('button', { name: `Add ${products[1].name}` }))
    expect(props.onAdd).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: 'Available Stock' })).toBeTruthy()
    expect(screen.getByText('17 kg')).toBeTruthy()
    expect(screen.getByText('20 kg on hand')).toBeTruthy()
    rerender(<OrderProductCatalog {...props} products={[]} />)
    expect(screen.getByText('No active products available.')).toBeTruthy()
  })
})
