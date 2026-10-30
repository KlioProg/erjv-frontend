import { createElement, type PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { useIncomingReceiving } from './use-incoming-receiving'
import type { IncomingDeliveryRecord } from './incoming-deliveries.types'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAdmin: true, isManager: false }),
}))
const originalAdapter = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
})

function setup() {
  let revision = 4
  let reject = false
  const writes: Record<string, unknown>[] = []
  const delivery = {
    id: 7,
    revision: 4,
    purchaseOrderId: 2,
    warehouseId: 3,
    status: 'SCHEDULED',
    items: [],
  } as unknown as IncomingDeliveryRecord
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  apiClient.defaults.adapter = async (config) => {
    let data: unknown = []
    if (config.method === 'get') {
      if (config.url === '/incoming-deliveries/7') data = { ...delivery, revision }
      if (config.url === '/incoming-deliveries') data = { items: [], nextCursor: null }
      if (config.url === '/purchase-orders/2')
        data = {
          id: 2,
          status: 'CONFIRMED',
          items: [{ id: 9, inventoryItemId: 1, quantity: '3.00' }],
        }
      if (config.url === '/inventory-items/1') data = { id: 1, name: 'Rice', unit: 'kg', isActive: true }
      if (config.url === '/inventory-items')
        data = { items: [{ id: 1, name: 'Rice', unit: 'kg', isActive: true }], nextCursor: null }
    } else {
      const body = JSON.parse(config.data)
      writes.push(body)
      if (reject)
        throw {
          isAxiosError: true,
          response: {
            status: 409,
            data: {
              code: 'RECEIPT_ALREADY_CONFIRMED',
              detail: 'Receipt already confirmed with different quantities',
            },
          },
        }
      data = { ...delivery, status: 'COMPLETED', revision: revision + 1 }
    }
    return { config, data, status: 200, statusText: '', headers: {} }
  }
  const onClose = vi.fn()
  const wrapper = ({ children }: PropsWithChildren) =>
    createElement(QueryClientProvider, { client }, children)
  const hook = renderHook(() => useIncomingReceiving(delivery, onClose), { wrapper })
  return {
    ...hook,
    writes,
    onClose,
    changeRevision: () => {
      revision++
    },
    reject: () => {
      reject = true
    },
  }
}

it.each([
  ['all', '3.00', '0.00'],
  ['partial', '1.50', '0.25'],
  ['none', undefined, undefined],
] as const)(
  'confirms a reviewed %s receipt with its delivery revision',
  async (outcome, received, damaged) => {
    const { result, writes, onClose } = setup()
    await waitFor(() => expect(result.current.disabled).toBe(false))
    await act(() => result.current.applyOutcome(outcome))
    if (outcome === 'partial')
      act(() => {
        result.current.change(9, 'received', received!)
        result.current.change(9, 'damaged', damaged!)
      })
    if (outcome === 'none') act(() => result.current.setReason('No shipment arrived'))
    await waitFor(() => expect(result.current.canSubmit).toBe(true))
    await act(() => result.current.submit())
    expect(writes).toEqual([
      {
        expectedRevision: 4,
        items:
          outcome === 'none'
            ? []
            : [{ purchaseOrderItemId: 9, receivedQuantity: received, damagedQuantity: damaged }],
        ...(outcome === 'none' ? { noReceiptReason: 'No shipment arrived' } : {}),
      },
    ])
    expect(onClose).toHaveBeenCalledOnce()
  },
)

it('preserves counts and requires review when preflight finds a changed revision', async () => {
  const { result, changeRevision, writes, onClose } = setup()
  await waitFor(() => expect(result.current.disabled).toBe(false))
  await act(() => result.current.applyOutcome('partial'))
  act(() => result.current.change(9, 'received', '1.50'))
  changeRevision()
  await act(() => result.current.submit())
  expect(writes).toEqual([])
  expect(result.current.counts[9].received).toBe('1.50')
  expect(result.current.canSubmit).toBe(false)
  expect(result.current.error).toMatch(/changed.*preserved/i)
  expect(onClose).not.toHaveBeenCalled()
  await act(() => result.current.refresh())
  await act(() => result.current.submit())
  expect(writes[0].expectedRevision).toBe(5)
})

it('keeps duplicate-confirmation conflicts open and never retries the write automatically', async () => {
  const { result, reject, writes, onClose } = setup()
  await waitFor(() => expect(result.current.disabled).toBe(false))
  await act(() => result.current.applyOutcome('partial'))
  act(() => result.current.change(9, 'received', '1.50'))
  reject()
  await act(() => result.current.submit())
  await act(() => result.current.submit())
  expect(writes).toHaveLength(1)
  expect(result.current.counts[9].received).toBe('1.50')
  expect(result.current.error).toContain('Receipt already confirmed')
  expect(onClose).not.toHaveBeenCalled()
})
