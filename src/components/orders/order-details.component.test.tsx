import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { expect, it, vi } from 'vitest'
import { OrderDetailDrawer } from './OrderDetailDrawer'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false }),
}))
const stamp = '2026-11-11T00:00:00Z'
const order: SalesOrderRecord = {
  id: 1,
  revision: 3,
  orderNumber: 'SO-1',
  status: 'CONFIRMED',
  clientId: 1,
  deliveryAddress: 'Davao',
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
      salesOrderId: 1,
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
function delivery(status: OutgoingDeliveryRecord['status']): OutgoingDeliveryRecord {
  return {
    id: 1,
    deliveryNumber: 'OUT-1',
    salesOrderId: 1,
    status,
    runId: status === 'DISPATCHED' ? 1 : null,
    items: [],
    plannedItems: [],
  } as unknown as OutgoingDeliveryRecord
}
function setup(props: Partial<Parameters<typeof OrderDetailDrawer>[0]> = {}) {
  const actions = {
    onClose: vi.fn(),
    onEdit: vi.fn(),
    onArrangeDelivery: vi.fn(),
    onViewDelivery: vi.fn(),
    onViewDeliveries: vi.fn(),
  }
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <OrderDetailDrawer
        open
        order={order}
        clients={[]}
        products={[{ id: 1, name: 'Mango', unit: 'kg' } as InventoryItemResponse]}
        warehouses={[]}
        vehicles={[]}
        employees={[]}
        stockItems={[]}
        outgoingDeliveries={[]}
        {...actions}
        {...props}
      />
    </QueryClientProvider>,
  )
  return actions
}
it.each([
  ['DRAFT', undefined, 'Draft'],
  ['CONFIRMED', undefined, 'Confirmed'],
  ['CONFIRMED', 'READY', 'Confirmed'],
  ['CONFIRMED', 'DISPATCHED', 'In Transit'],
  ['DELIVERED', 'RECONCILED', null],
] as const)('keeps the %s / %s Sales lifecycle truthful', (status, shipment, current) => {
  setup({ order: { ...order, status }, outgoingDeliveries: shipment ? [delivery(shipment)] : [] })
  const line = screen.getByRole('list', { name: 'Sales order lifecycle' })
  const steps = within(line).getAllByRole('listitem')
  expect(steps.map((step) => step.textContent?.split(' — ')[0])).toEqual([
    'Draft',
    'Confirmed',
    'In Transit',
    'Delivered',
  ])
  expect(
    steps
      .filter((step) => step.getAttribute('aria-current') === 'step')
      .map((step) => step.textContent?.split(' — ')[0]),
  ).toEqual(current ? [current] : [])
  expect(line.querySelectorAll('[data-slot="lifecycle-segment"]')).toHaveLength(4)
  const body = screen.getByRole('region', { name: 'Sales order content' })
  expect(body.contains(line)).toBe(false)
  expect(body.classList.contains('overflow-y-auto')).toBe(true)
  expect(screen.queryByText(/What just happened|Ready for Logistics/)).toBeNull()
})
it('uses an accurate compact summary for partial multi-delivery fulfillment', () => {
  setup({
    order: { ...order, status: 'PARTIALLY_DELIVERED' },
    outgoingDeliveries: [delivery('DISPATCHED'), { ...delivery('RECONCILED'), id: 2 }],
  })
  expect(screen.getByText('Partially Delivered')).toBeTruthy()
  expect(screen.queryByRole('list', { name: 'Sales order lifecycle' })).toBeNull()
  expect(screen.getByText(/Some goods have been delivered/)).toBeTruthy()
})
it('keeps cancelled Sales records distinct from completion', () => {
  setup({ order: { ...order, status: 'CANCELLED' } })
  const line = screen.getByRole('list', { name: 'Sales order lifecycle' })
  expect(line.textContent).toBe('Cancelled')
  expect(screen.queryByRole('button', { name: 'Arrange Delivery' })).toBeNull()
})
it('keeps secondary Sales actions in a menu and the eligible primary action outside the scroll area', async () => {
  const actions = setup({ outgoingDeliveries: [delivery('READY')] })
  const footer = screen.getByRole('group', { name: 'Sales order actions' })
  expect(within(footer).getByRole('button', { name: 'Close' })).toBeTruthy()
  for (const name of ['View Delivery', 'View Deliveries', 'Cancel Order']) {
    await userEvent.click(screen.getByRole('button', { name: 'More Actions' }))
    await userEvent.click(screen.getByRole('menuitem', { name }))
    if (name === 'Cancel Order')
      expect(await screen.findByRole('dialog', { name: 'Cancel Sales Order' })).toBeTruthy()
  }
  expect(actions.onViewDelivery).toHaveBeenCalledWith(1)
  expect(actions.onViewDeliveries).toHaveBeenCalledWith(1)
})
it('keeps simple confirmed records compact without an empty fulfillment section', () => {
  setup()
  expect(screen.queryByText('Fulfillment details')).toBeNull()
  expect(screen.getByRole('cell', { name: '₱200.00' })).toBeTruthy()
  const body = screen.getByRole('region', { name: 'Sales order content' })
  expect(body.contains(screen.getByRole('button', { name: 'Arrange Delivery' }))).toBe(false)
})

it('retains specific delivery access for completed read-only orders', async () => {
  const onViewDelivery = vi.fn()
  setup({
    readOnly: true,
    order: { ...order, status: 'DELIVERED' },
    outgoingDeliveries: [delivery('RECONCILED')],
    onViewDeliveries: undefined,
    onViewDelivery,
  })
  await userEvent.click(screen.getByRole('button', { name: 'More Actions' }))
  await userEvent.click(screen.getByRole('menuitem', { name: 'View Delivery' }))
  expect(onViewDelivery).toHaveBeenCalledWith(1)
  expect(screen.queryByRole('menuitem', { name: 'Cancel Order' })).toBeNull()
})

it('keeps draft editing secondary and confirmation as the only footer primary action', async () => {
  const actions = setup({ order: { ...order, status: 'DRAFT' } })
  const footer = screen.getByRole('group', { name: 'Sales order actions' })
  expect(
    within(footer)
      .getAllByRole('button')
      .map((button) => button.textContent?.trim()),
  ).toEqual(['More Actions', 'Close', 'Confirm Order'])
  await userEvent.click(screen.getByRole('button', { name: 'More Actions' }))
  expect(screen.queryByRole('menuitem', { name: 'Confirm Order' })).toBeNull()
  expect(actions.onEdit).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit Draft' }))
  expect(actions.onEdit).toHaveBeenCalledOnce()
  expect(screen.queryByRole('menu')).toBeNull()
})
