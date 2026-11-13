import type { PropsWithChildren } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, expect, it } from 'vitest'
import { apiClient } from '@/lib/api-client'
import { useRunDeliverySelection } from './use-run-delivery-selection'
import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'

const original = apiClient.defaults.adapter
afterEach(() => {
  apiClient.defaults.adapter = original
})
const delivery = (id: number): OutgoingDeliveryRecord => ({
  id,
  deliveryNumber: `OUT-${id}`,
  revision: 3,
  warehouseId: 2,
  status: 'READY',
  runId: null,
  salesOrderId: 1,
  plannedItems: [{ id: 1, outgoingDeliveryId: id, salesOrderItemId: 1, plannedQuantity: '1.00', createdAt: '', updatedAt: '' }],
  items: [],
  notes: null,
  reconciledAt: null,
  reconciledByUserId: null,
  fulfillmentOutcome: null,
  hasDamage: false,
  hasMissing: false,
  cancelledAt: null,
  createdAt: '',
  updatedAt: '',
})

it('rejects a Ready delivery whose saved plan is empty after selection and before saving', async () => {
  const latest = { ...delivery(100), plannedItems: [] }
  apiClient.defaults.adapter = async (config) => ({ config, status: 200, statusText: 'OK', headers: {}, data: latest })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  const { result } = renderHook(() => useRunDeliverySelection(2), { wrapper })
  act(() => result.current.toggle(delivery(100)))
  await waitFor(() => expect(result.current.issues[0]).toMatch(/valid saved plan/))
  expect(result.current.canSave).toBe(false)
  expect(await result.current.verify()).toBe(false)
  client.clear()
})

it('uses stable identities and respects the remaining member limit during rapid changes', async () => {
  apiClient.defaults.adapter = async (config) => ({
    config,
    status: 200,
    statusText: 'OK',
    headers: {},
    data: delivery(Number(config.url!.split('/').at(-1))),
  })
  const client = new QueryClient()
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const existing = Array.from({ length: 99 }, (_, index) => index + 1)
  const { result } = renderHook(() => useRunDeliverySelection(2, existing), { wrapper })
  act(() => {
    result.current.toggle(delivery(100))
    result.current.toggle(delivery(101))
  })
  expect(result.current.selected.map((record) => record.id)).toEqual([100])
  act(() => {
    result.current.toggle(delivery(100))
    result.current.toggle(delivery(101))
    result.current.toggle(delivery(102))
  })
  expect(result.current.selected.map((record) => record.id)).toEqual([101])
  await waitFor(() => expect(result.current.canSave).toBe(true))
  await act(async () => {
    expect(await result.current.verify()).toBe(true)
  })
  expect(result.current.selected.map((record) => record.id)).toEqual([101])
  client.clear()
})

it('does not approve a save after its selection owner unmounts during validation', async () => {
  let block = false
  let started = false
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  apiClient.defaults.adapter = async (config) => {
    if (block) {
      started = true
      await pending
    }
    return { config, status: 200, statusText: 'OK', headers: {}, data: delivery(100) }
  }
  const client = new QueryClient()
  const wrapper = ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  const { result, unmount } = renderHook(() => useRunDeliverySelection(2), { wrapper })
  act(() => result.current.toggle(delivery(100)))
  await waitFor(() => expect(result.current.canSave).toBe(true))
  block = true
  const verifying = result.current.verify()
  await waitFor(() => expect(started).toBe(true))
  unmount()
  release()
  expect(await verifying).toBe(false)
  client.clear()
})
