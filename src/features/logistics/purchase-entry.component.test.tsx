import { act, renderHook } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { usePurchaseOrderEntry } from './purchase-order-entry.hooks'

it('increments one purchase line during rapid catalog additions and preserves edited terms', () => {
  const product = { id: 1, name: 'Mango', variety: null, description: null, unit: 'kg', unitPrice: '100', isActive: true, createdAt: '', updatedAt: '' }
  const { result } = renderHook(() => usePurchaseOrderEntry({ suppliers: [], products: [product], onSubmit: vi.fn(), onClose: vi.fn() }))
  act(() => {
    result.current.addProduct(product)
    result.current.addProduct(product)
    result.current.addProduct(product)
  })
  expect(result.current.lines).toHaveLength(1)
  const id = result.current.lines[0].formId
  expect(result.current.lines[0].quantity).toBe('3')
  act(() => {
    result.current.updateLine(id, 'quantity', '2.25')
    result.current.updateLine(id, 'unitCost', '10.20')
  })
  act(() => result.current.addProduct(product))
  expect(result.current.lines).toHaveLength(1)
  expect(result.current.lines[0]).toMatchObject({ quantity: '3.25', unitCost: '10.20' })
  act(() => result.current.updateLine(id, 'quantity', 'invalid'))
  act(() => result.current.addProduct(product))
  expect(result.current.lines[0].quantity).toBe('invalid')
})
