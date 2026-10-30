import { describe, expect, it } from 'vitest'
import { validateRunLoad, type RunLoadRow } from './run-load-validation'

const members = [
  { id: 1, revision: 3 },
  { id: 2, revision: 7 },
]
const row = (deliveryId: number, availableQuantity = '10.00'): RunLoadRow => ({
  key: `${deliveryId}:20`,
  deliveryId,
  deliveryNumber: `OUT-${deliveryId}`,
  expectedRevision: deliveryId === 1 ? 3 : 7,
  salesOrderItemId: 20,
  stockItemId: 8,
  productName: 'Rice',
  unit: 'kg',
  plannedQuantity: '8.00',
  availableQuantity,
})

describe('physical run load validation', () => {
  it('creates one revision-checked load per member and allows partial planned quantities', () => {
    expect(validateRunLoad(members, [row(1), row(2)], { '1:20': '4.25', '2:20': '5.75' })).toEqual({
      loads: [
        {
          deliveryId: 1,
          expectedRevision: 3,
          items: [{ salesOrderItemId: 20, stockItemId: 8, loadedQuantity: '4.25' }],
        },
        {
          deliveryId: 2,
          expectedRevision: 7,
          items: [{ salesOrderItemId: 20, stockItemId: 8, loadedQuantity: '5.75' }],
        },
      ],
    })
  })
  it('checks shared stock across members, rather than approving each load separately', () => {
    expect(() => validateRunLoad(members, [row(1), row(2)], { '1:20': '6', '2:20': '5' })).toThrow(
      'Combined loads exceed',
    )
  })
  it('requires coverage even when a member has no positive load', () => {
    expect(() => validateRunLoad(members, [row(1), row(2)], { '1:20': '3', '2:20': '0' })).toThrow(
      'OUT-2',
    )
    expect(() => validateRunLoad(members, [row(1)], { '1:20': '3' })).toThrow('Every member')
  })
  it.each(['-1', '1.001', 'NaN', '9'])('rejects invalid or over-plan quantity %s', (quantity) => {
    expect(() => validateRunLoad([members[0]], [row(1)], { '1:20': quantity })).toThrow(
      'within the plan',
    )
  })
  it('rejects duplicate order-line sources and changed member revisions', () => {
    expect(() =>
      validateRunLoad([members[0]], [row(1), { ...row(1), key: 'different-key' }], { '1:20': '1' }),
    ).toThrow('unique saved')
    expect(() => validateRunLoad([{ id: 1, revision: 4 }], [row(1)], { '1:20': '1' })).toThrow(
      'changed',
    )
  })
  it('omits zero product lines without omitting their loaded member', () => {
    expect(
      validateRunLoad([members[0]], [row(1), { ...row(1), key: '1:21', salesOrderItemId: 21 }], {
        '1:20': '1',
        '1:21': '',
      }).loads[0].items,
    ).toHaveLength(1)
  })
})
