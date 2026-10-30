import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useOrderSubmission } from './use-order-submission'

describe('saved order confirmation', () => {
  it.each([undefined, 500])('blocks a second create after an uncertain response (%s)', async (status) => {
    const create = vi.fn().mockRejectedValue({ isAxiosError: true, response: status ? { status } : undefined })
    const onClose = vi.fn()
    const { result } = renderHook(() => useOrderSubmission({ onClose }))
    await act(() => result.current.submit(create, false))
    await act(() => result.current.submit(create, false))
    expect(create).toHaveBeenCalledOnce()
    expect(result.current.reviewRequired).toBe(true)
    expect(result.current.error).toContain('result is uncertain')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('confirms an existing draft without creating, and ignores further submits after success', async () => {
    const savedDraft = { id: 42, revision: 3, orderNumber: 'ORDER-42', status: 'DRAFT' }
    const confirmed = { ...savedDraft, status: 'CONFIRMED' }
    const create = vi.fn()
    const onConfirm = vi.fn().mockResolvedValue(confirmed)
    const onConfirmed = vi.fn()
    const onClose = vi.fn()
    const { result } = renderHook(() =>
      useOrderSubmission({ savedDraft, onConfirm, onConfirmed, onClose }),
    )
    await act(() => result.current.submit(create, true))
    await act(() => result.current.submit(create, true))
    expect(create).not.toHaveBeenCalled()
    expect(onConfirm.mock.calls).toEqual([[42, 3]])
    expect(onConfirmed.mock.calls).toEqual([[confirmed]])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it.each([
    { id: 42, orderNumber: 'ORDER-42', status: 'DRAFT' },
    { id: 99, orderNumber: 'ORDER-99', status: 'CONFIRMED' },
  ])('requires the matching confirmed response before showing success: %j', async (response) => {
    const savedDraft = { id: 42, revision: 3, orderNumber: 'ORDER-42', status: 'DRAFT' }
    const create = vi.fn()
    const onConfirm = vi.fn().mockResolvedValue(response)
    const onConfirmed = vi.fn()
    const onClose = vi.fn()
    const { result } = renderHook(() =>
      useOrderSubmission({ savedDraft, onConfirm, onConfirmed, onClose }),
    )
    await act(() => result.current.submit(create, true))
    expect(result.current.error).toContain('The server did not confirm this order')
    expect(result.current.savedOrder?.id).toBe(42)
    expect(result.current.confirmationAttempted).toBe(true)
    expect(onConfirmed).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(create).not.toHaveBeenCalled()
  })
})
