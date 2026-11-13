import { describe, expect, it } from 'vitest'
import { outgoingPreparationIssue, hasValidOutgoingPlan } from '@/features/logistics/outgoing-issues'
import { getDeliveryActions, formatDeliverySchedule } from '@/features/logistics/delivery-workflow'
import { incomingSchedulingIssue } from '@/features/logistics/incoming-scheduling'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'

const draft = {
  status: 'DRAFT',
  warehouseId: 1,
  plannedItems: [{ salesOrderItemId: 1, plannedQuantity: '2' }],
} as OutgoingDeliveryRecord

describe('delivery issue ownership', () => {
  it('distinguishes a valid unloaded Ready plan from a missing or invalid plan', () => {
    const ready = { ...draft, status: 'READY' as const, runId: null, items: [] }
    expect(hasValidOutgoingPlan(ready)).toBe(true)
    expect(outgoingPreparationIssue(ready, 'CONFIRMED', true)).toBeNull()
    for (const quantity of ['', '0', '-1', 'invalid']) {
      const invalid = { ...ready, plannedItems: [{ ...draft.plannedItems[0], plannedQuantity: quantity }] }
      const issue = outgoingPreparationIssue(invalid, 'CONFIRMED', true)
      expect(issue?.target).toBe('delivery')
      expect(getDeliveryActions({ type: 'Outgoing', status: 'READY', record: invalid, schedulingIssue: issue })).not.toContain('run')
    }
    expect(hasValidOutgoingPlan({ ...ready, plannedItems: [] })).toBe(false)
  })
  it('preserves the actual saved year and formats times in Manila without imposing an invented horizon', () => {
    const value = formatDeliverySchedule('3213-01-02T02:30:00Z', false)
    expect(value.date).toContain('3213')
    expect(value.time).toBe('10:30')
  })
  it('distinguishes outgoing parent blockers from editable preparation', () => {
    expect(outgoingPreparationIssue(draft, 'DRAFT', true)?.target).toBe('order')
    expect(outgoingPreparationIssue(draft, 'CANCELLED', true)?.message).toMatch(/cancelled/i)
    expect(outgoingPreparationIssue(draft, 'DELIVERED', true)?.message).toMatch(/delivered/i)
    expect(outgoingPreparationIssue(draft, undefined, true)?.target).toBe('refresh')
    expect(
      outgoingPreparationIssue({ ...draft, warehouseId: null }, 'CONFIRMED', true)?.target,
    ).toBe('delivery')
    expect(outgoingPreparationIssue(draft, 'CONFIRMED', false)?.target).toBe('delivery')
    expect(
      outgoingPreparationIssue({ ...draft, plannedItems: [] }, 'CONFIRMED', true)?.target,
    ).toBe('delivery')
    expect(outgoingPreparationIssue(draft, 'PARTIALLY_DELIVERED', true)).toBeNull()
    expect(
      outgoingPreparationIssue({ ...draft, status: 'DISPATCHED' }, 'CANCELLED', false),
    ).toBeNull()
  })
  it('identifies only the incoming fields that require correction', () => {
    const context = {
      delivery: { status: 'DRAFT', scheduledAt: null },
      order: { status: 'CONFIRMED' },
      warehouse: { isActive: true },
    } as Parameters<typeof incomingSchedulingIssue>[0]
    expect(incomingSchedulingIssue(context)?.target).toBe('schedule')
    expect(
      incomingSchedulingIssue({ ...context, warehouse: { ...context.warehouse, isActive: false } })
        ?.target,
    ).toBe('warehouse')
    expect(
      incomingSchedulingIssue({ ...context, order: { ...context.order, status: 'DRAFT' } })?.target,
    ).toBe('order')
  })
})
