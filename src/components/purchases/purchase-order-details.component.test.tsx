import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { PurchaseOrderDetailModal } from './PurchaseOrderDetailModal'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
const stamp = '2026-11-11T00:00:00Z'
const order: PurchaseOrderRecord = {
  id: 1,
  revision: 3,
  orderNumber: 'PO-1',
  status: 'CONFIRMED',
  supplierId: 1,
  orderedAt: stamp,
  expectedAt: null,
  confirmedAt: stamp,
  completedAt: null,
  cancelledAt: null,
  externalReference: null,
  notes: null,
  createdAt: stamp,
  updatedAt: stamp,
  items: [
    {
      id: 11,
      purchaseOrderId: 1,
      lineNumber: 1,
      inventoryItemId: 1,
      quantity: '10',
      unitPrice: '20',
      discountRate: '0',
      discountAmount: '0',
      taxRate: '0',
      taxAmount: '0',
      subtotalAmount: '200',
      taxableAmount: '200',
      totalAmount: '200',
      notes: null,
      createdAt: stamp,
      updatedAt: stamp,
    },
  ],
}
const product = { id: 1, name: 'Mango', unit: 'kg' } as InventoryItemResponse
function receipt(
  id: number,
  status: IncomingDeliveryRecord['status'],
  received = '5',
  accepted = '3',
  damaged = '2',
): IncomingDeliveryRecord {
  return {
    id,
    revision: 1,
    deliveryNumber: 'IN-' + id,
    purchaseOrderId: 1,
    warehouseId: 1,
    status,
    scheduledAt: stamp,
    completedAt: status === 'COMPLETED' ? stamp : null,
    cancelledAt: null,
    supplierReference: null,
    notes: null,
    createdAt: stamp,
    updatedAt: stamp,
    items: [
      {
        id: id * 100,
        incomingDeliveryId: id,
        purchaseOrderItemId: 11,
        receivedQuantity: received,
        acceptedQuantity: accepted,
        damagedQuantity: damaged,
        createdAt: stamp,
        updatedAt: stamp,
      },
    ],
  }
}
function setup(props: Partial<Parameters<typeof PurchaseOrderDetailModal>[0]> = {}) {
  const actions = {
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onExportReceipt: vi.fn(),
    onNavigateToDeliveries: vi.fn(),
  }
  render(
    <PurchaseOrderDetailModal
      order={order}
      products={[product]}
      warehouses={[]}
      incomingDeliveries={[]}
      canScheduleArrival
      {...actions}
      {...props}
    />,
  )
  return actions
}

it('explains confirmation-only requirements without submitting an incomplete saved purchase draft', async () => {
  const actions = setup({ order: { ...order, status: 'DRAFT', supplierId: null, items: [] } })
  await userEvent.click(screen.getByRole('button', { name: 'Confirm Purchase Order' }))
  expect(actions.onConfirm).not.toHaveBeenCalled()
  expect(screen.getByRole('alert').textContent).toContain('supplier and at least one item')
  expect(screen.getByRole('dialog')).toBeTruthy()
})

it('shows saved purchasing dates in Manila even when the instant falls on the prior UTC day', () => {
  setup({ order: { ...order, orderedAt: '2026-11-11T16:30:00Z', expectedAt: '2026-11-12T16:15:00Z' } })
  expect(screen.getByText('Purchase order · 11/12/2026')).toBeTruthy()
  expect(screen.getByText('11/13/2026')).toBeTruthy()
})
it.each([
  ['DRAFT', 'Draft'],
  ['CONFIRMED', 'Confirmed'],
  ['PARTIALLY_RECEIVED', 'Receiving'],
  ['RECEIVED', null],
] as const)('shows the compact receiving lifecycle for %s', (status, current) => {
  setup({ order: { ...order, status } })
  const line = screen.getByRole('list', { name: 'Purchase order lifecycle' })
  const steps = within(line).getAllByRole('listitem')
  expect(steps.map((step) => step.textContent?.split(' — ')[0])).toEqual([
    'Draft',
    'Confirmed',
    'Receiving',
    'Received',
  ])
  expect(
    steps
      .filter((step) => step.getAttribute('aria-current') === 'step')
      .map((step) => step.textContent?.split(' — ')[0]),
  ).toEqual(current ? [current] : [])
  if (status === 'RECEIVED') steps.forEach((step) => expect(step.textContent).toMatch(/Completed/))
})
it('shows cancellation as a distinct terminal state', () => {
  setup({ order: { ...order, status: 'CANCELLED' } })
  const line = screen.getByRole('list', { name: 'Purchase order lifecycle' })
  expect(within(line).getAllByRole('listitem')).toHaveLength(1)
  expect(line.textContent).toBe('Cancelled')
  expect(screen.queryByRole('button', { name: 'Schedule Arrival' })).toBeNull()
})
it('keeps scheduling contextual and does not advance Receiving', () => {
  setup({ incomingDeliveries: [receipt(1, 'SCHEDULED')] })
  const line = screen.getByRole('list', { name: 'Purchase order lifecycle' })
  expect(within(line).getByText('Confirmed').closest('li')?.getAttribute('aria-current')).toBe(
    'step',
  )
  expect(within(line).getByText('Receiving').closest('li')?.textContent).toContain('Upcoming')
  expect(screen.getByText(/An arrival is scheduled/)).toBeTruthy()
  expect(screen.getByRole('button', { name: 'Schedule Arrival' })).toBeTruthy()
})
it('keeps multiple partial receipts and damage truthful in a labeled breakdown', async () => {
  setup({
    order: { ...order, status: 'PARTIALLY_RECEIVED' },
    incomingDeliveries: [
      receipt(1, 'COMPLETED'),
      receipt(2, 'COMPLETED', '2', '2', '0'),
      receipt(3, 'SCHEDULED'),
    ],
  })
  const section = screen.getByRole('region', { name: 'Receiving Progress' })
  const table = within(section).getAllByRole('table')[0]
  expect(
    within(table)
      .getAllByRole('columnheader')
      .map((node) => node.textContent),
  ).toEqual(['Product', 'Ordered', 'Received', 'Remaining'])
  expect(
    within(table)
      .getAllByRole('cell')
      .map((node) => node.textContent),
  ).toEqual(['Mango', '10 kg', '7 kg', '5 kg'])
  await userEvent.click(screen.getByText('Accepted and damaged quantities'))
  const breakdown = within(section).getAllByRole('table')[1]
  expect(within(breakdown).getByRole('cell', { name: '5 kg' })).toBeTruthy()
  expect(within(breakdown).getByRole('cell', { name: '2 kg' })).toBeTruthy()
  expect(screen.queryByText(/backend-accepted|quarantine/)).toBeNull()
})
it('keeps secondary operations in a menu and scheduling in the footer', async () => {
  const actions = setup()
  const footer = screen.getByRole('group', { name: 'Purchase order actions' })
  expect(within(footer).getByRole('button', { name: 'Close' })).toBeTruthy()
  expect(within(footer).getByRole('button', { name: 'Schedule Arrival' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: 'Print / Download Purchase Order' })).toBeNull()
  for (const name of [
    'View Incoming Deliveries',
    'Print / Download Purchase Order',
    'Cancel Order',
  ]) {
    await userEvent.click(screen.getByRole('button', { name: 'More Actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name }))
  }
  expect(actions.onNavigateToDeliveries).toHaveBeenCalledWith(1)
  expect(actions.onExportReceipt).toHaveBeenCalledOnce()
  expect(actions.onCancel).toHaveBeenCalledOnce()
  await userEvent.click(screen.getByRole('button', { name: 'Schedule Arrival' }))
  expect(actions.onNavigateToDeliveries).toHaveBeenLastCalledWith(1, true)
})
it('keeps lifecycle and footer outside the scrolling content and omits an empty receipt breakdown', () => {
  setup()
  const body = screen.getByRole('region', { name: 'Purchase order content' })
  expect(body.classList.contains('overflow-y-auto')).toBe(true)
  expect(body.contains(screen.getByRole('list', { name: 'Purchase order lifecycle' }))).toBe(false)
  expect(body.contains(screen.getByRole('button', { name: 'Schedule Arrival' }))).toBe(false)
  expect(screen.queryByText('Accepted and damaged quantities')).toBeNull()
})
it('displays a supplied year 2204 without rewriting the date', () => {
  setup({ order: { ...order, expectedAt: '2204-12-31T04:00:00Z' } })
  expect(screen.getByText(new Date('2204-12-31T04:00:00Z').toLocaleDateString())).toBeTruthy()
  expect(screen.getByText(/2204/)).toBeTruthy()
})

it('shows the order date once in the header and omits missing optional fields', () => {
  setup()
  expect(
    screen.getByText('Purchase order · ' + new Date(order.orderedAt).toLocaleDateString()),
  ).toBeTruthy()
  expect(screen.queryByText('Ordered Date')).toBeNull()
  expect(screen.queryByText('Expected Date')).toBeNull()
  expect(screen.queryByText('Destination Warehouse')).toBeNull()
  expect(screen.queryByText('Supplier Reference')).toBeNull()
})

it('keeps draft editing secondary without duplicating purchase confirmation', async () => {
  const actions = setup({ order: { ...order, status: 'DRAFT' } })
  const footer = screen.getByRole('group', { name: 'Purchase order actions' })
  expect(
    within(footer)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim()),
  ).toEqual(['More Actions', 'Close', 'Confirm Purchase Order'])
  await userEvent.click(screen.getByRole('button', { name: 'More Actions' }))
  expect(screen.queryByRole('menuitem', { name: 'Confirm Purchase Order' })).toBeNull()
  expect(actions.onConfirm).not.toHaveBeenCalled()
  expect(actions.onEdit).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit Draft' }))
  expect(actions.onEdit).toHaveBeenCalledOnce()
  expect(screen.queryByRole('menu')).toBeNull()
})
