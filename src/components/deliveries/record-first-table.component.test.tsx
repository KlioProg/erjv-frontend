import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DeliveryTable } from './DeliveryTable'
import type { DeliveryRow } from '@/features/logistics/delivery-workflow'

const row = (type: 'Incoming' | 'Outgoing', status = 'DRAFT') =>
  ({
    key: 'delivery-1',
    reference: 'DEL-1',
    type,
    status,
    party: 'Business partner',
    relatedOrder: 'ORDER-1',
    orderId: 2,
    purchaseOrderStatus: 'CONFIRMED',
    warehouse: 'Main warehouse',
    date: null,
    record: { id: 1, status, runId: type === 'Outgoing' ? 7 : undefined },
  }) as DeliveryRow
function mount(record: DeliveryRow, canManage = true) {
  const onView = vi.fn(),
    onViewOrder = vi.fn(),
    onViewTrip = vi.fn(), onAction = vi.fn()
  render(
    <DeliveryTable
      rows={[record]}
      view={record.type === 'Incoming' ? 'incoming' : 'outgoing'}
      isLoading={false}
      onView={onView}
      onViewOrder={onViewOrder}
      onViewTrip={onViewTrip}
      onAction={onAction} canManage={canManage}
    />,
  )
  return { onView, onViewOrder, onViewTrip, onAction }
}
describe('record-first delivery tables', () => {
  it.each(['Incoming', 'Outgoing'] as const)(
    'opens %s details from a keyboard-accessible delivery identifier without row operations',
    async (type) => {
      const { onView } = mount(row(type))
      expect(screen.getByRole('columnheader', { name: 'Next Action' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: /More actions/i })).toBeNull()
      const user = userEvent.setup()
      const reference = screen.getByRole('button', { name: 'View delivery DEL-1' })
      reference.focus()
      await user.keyboard('{Enter}')
      expect(onView).toHaveBeenCalledOnce()
      fireEvent.click(screen.getAllByRole('row')[1])
      expect(onView).toHaveBeenCalledTimes(2)
    },
  )
  it('navigates to the linked order and actual trip without opening delivery details', async () => {
    const { onView, onViewOrder, onViewTrip } = mount(row('Outgoing', 'READY'))
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'View sales order ORDER-1' }))
    await user.click(screen.getByRole('button', { name: 'Open Trip #7' }))
    expect(onViewOrder).toHaveBeenCalledOnce()
    expect(onViewTrip).toHaveBeenCalledWith(7)
    expect(onView).not.toHaveBeenCalled()
    expect(screen.getAllByRole('columnheader')).toHaveLength(6)
  })
  it('keeps a meaningful record issue separate from its neutral lifecycle badge', async () => {
    const record = {
      ...row('Incoming'),
      schedulingIssue: {
        target: 'schedule',
        title: 'Arrival Date Required',
        message: 'Choose an arrival date.',
      },
    } as DeliveryRow
    const { onViewOrder } = mount(record)
    expect(screen.getByRole('columnheader', { name: 'Issue' })).toBeTruthy()
    const badge = screen.getByText('Needs review').closest<HTMLElement>('[data-slot="badge"]')!
    expect(badge.className).toContain('bg-muted')
    expect(badge.querySelector('[data-slot="status-dot"]')).toBeTruthy()
    badge.focus()
    expect((await screen.findByRole('tooltip')).textContent).toContain('Choose an arrival date.')
    expect(screen.getByText('Draft').closest('[data-slot="badge"]')?.className).toContain(
      'bg-muted',
    )
    fireEvent.click(screen.getByRole('button', { name: 'View purchase order ORDER-1' }))
    expect(onViewOrder).toHaveBeenCalledOnce()
    expect(within(screen.getAllByRole('row')[1]).getAllByRole('cell')).toHaveLength(7)
  })
})
it('prioritizes reviewing an outgoing preparation issue without starting a mutation', async () => {
  const record = { ...row('Outgoing'), schedulingIssue: { target: 'delivery', title: 'Preparation Incomplete', message: 'Add planned quantities in Edit Delivery before marking this draft ready.' } } as DeliveryRow
  const { onView, onAction } = mount(record)
  await userEvent.click(screen.getByRole('button', { name: 'Review Issue' }))
  expect(onView).toHaveBeenCalledWith(record)
  expect(onAction).not.toHaveBeenCalled()
  expect(screen.queryByRole('button', { name: 'Edit Delivery DEL-1' })).toBeNull()
})
it.each([
  ['Incoming', 'DRAFT', null, 'Schedule Arrival', 'schedule'],
  ['Incoming', 'SCHEDULED', null, 'Receive Goods', 'receive'],
  ['Outgoing', 'DRAFT', null, 'Edit Delivery', 'ready'],
  ['Outgoing', 'READY', null, 'Add to Trip', 'run'],
  ['Outgoing', 'READY', 7, 'View Trip', 'run'],
  ['Outgoing', 'DISPATCHED', 7, 'Record Results', 'reconcile'],
] as const)('offers one %s %s operation without opening details', async (type, status, runId, label, action) => {
  const record = row(type, status)
  if (record.type === 'Outgoing') record.record.runId = runId
  const { onView, onAction } = mount(record)
  const button = screen.getByRole('button', { name: label + ' DEL-1' })
  button.focus()
  await userEvent.keyboard('{Enter}')
  expect(onAction).toHaveBeenCalledWith(record, action)
  expect(onView).not.toHaveBeenCalled()
})
it.each(['COMPLETED', 'CANCELLED'])('offers no operation for incoming %s', (status) => {
  mount(row('Incoming', status))
  expect(screen.queryByRole('button', { name: /Schedule Arrival|Receive Goods/ })).toBeNull()
})
it('does not offer management operations to a read-only employee', () => {
  mount(row('Incoming'), false)
  expect(screen.queryByRole('button', { name: /Schedule Arrival/ })).toBeNull()
})
