import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import type { FormEvent } from 'react'
import { usePurchaseOrderEntry } from './purchase-order-entry.hooks'
import type { PurchaseOrderRecord } from './purchase-orders.types'

const stamps = { createdAt: '2026-10-26', updatedAt: '2026-10-26' }
const draft = {
  id: 7,
  revision: 1,
  orderNumber: 'PO-7',
  status: 'DRAFT',
  supplierId: 1,
  items: [
    {
      id: 9,
      inventoryItemId: 1,
      quantity: '2.00',
      unitPrice: '10.00',
      discountRate: '0.00',
      discountAmount: '0.00',
      taxRate: '0.00',
    },
  ],
} as PurchaseOrderRecord
const props = {
  suppliers: [
    {
      id: 1,
      code: 'SUP',
      name: 'Supplier',
      isActive: true,
      address: 'Davao',
      email: null,
      phone: null,
      contactPerson: null,
      ...stamps,
    },
  ],
  products: [
    {
      id: 1,
      name: 'Rice',
      unit: 'kg',
      isActive: true,
      unitPrice: '10.00',
      variety: null,
      description: null,
      ...stamps,
    },
  ],
  draftOrder: draft,
  onSubmit: vi.fn(async () => draft),
  onClose: vi.fn(),
}
const event = { preventDefault() {}, nativeEvent: {} } as FormEvent<HTMLFormElement>

it.each(['STALE_REVISION', 'INVALID_ORDER_STATE'])(
  'preserves unsaved PO edits after %s until an explicit reload',
  async (code) => {
    const error = new AxiosError('Conflict')
    error.response = {
      status: 409,
      data: { code, message: 'Changed by another user', details: { currentRevision: 2 } },
      config: {} as never,
      headers: {},
      statusText: '',
    }
    const latest = { ...draft, revision: 2, notes: 'Server notes' }
    const onLoadLatest = vi.fn(async () => latest)
    const onUpdateDraft = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValue({ ...latest, revision: 3 })
    const { result } = renderHook(() =>
      usePurchaseOrderEntry({ ...props, onLoadLatest, onUpdateDraft }),
    )
    act(() => {
      result.current.setNotes('My unsaved notes')
      result.current.updateLine(1, 'quantity', '3.00')
    })
    await act(() => result.current.submit(event))
    expect(onUpdateDraft).toHaveBeenCalledWith(7, expect.objectContaining({ expectedRevision: 1 }))
    expect(result.current.notes).toBe('My unsaved notes')
    expect(result.current.lines[0].quantity).toBe('3.00')
    expect(result.current.conflict?.latest).toEqual(latest)
    await act(() => result.current.submit(event))
    expect(onUpdateDraft).toHaveBeenCalledTimes(1)
    act(() => result.current.reloadLatestDraft())
    expect(result.current.notes).toBe('Server notes')
    expect(result.current.lines[0].quantity).toBe('2.00')
    await act(() => result.current.submit(event))
    expect(onUpdateDraft).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ expectedRevision: 2 }),
    )
  },
)

it('keeps a newer confirmed PO read-only after conflict reload', async () => {
  const error = new AxiosError('Conflict')
  error.response = {
    status: 409,
    data: { code: 'INVALID_ORDER_STATE' },
    config: {} as never,
    headers: {},
    statusText: '',
  }
  const onUpdateDraft = vi.fn().mockRejectedValue(error)
  const { result } = renderHook(() =>
    usePurchaseOrderEntry({
      ...props,
      onUpdateDraft,
      onLoadLatest: async () => ({ ...draft, revision: 2, status: 'CONFIRMED' }),
    }),
  )
  await act(() => result.current.submit(event))
  act(() => result.current.reloadLatestDraft())
  expect(result.current.submitDisabled).toBe(true)
  await act(() => result.current.submit(event))
  expect(onUpdateDraft).toHaveBeenCalledTimes(1)
})
