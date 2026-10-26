import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { PropsWithChildren } from 'react'
import { apiClient } from '@/lib/api-client'
import { useQuarantineTag } from '@/features/logistics/use-quarantine-tag'
import { CorrectQuarantineConditionDialog } from './CorrectQuarantineConditionDialog'
import type { QuarantineLot } from '@/features/logistics/stock-items.types'

const auth = vi.hoisted(() => ({ role: 'STAFF' }))
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { role: auth.role } }) }))
const adapter = apiClient.defaults.adapter
const lot: QuarantineLot = {
  id: 11,
  stockItemId: 7,
  sourceKind: 'MANUAL',
  condition: 'DAMAGED',
  reportedCondition: 'DAMAGED',
  taggedByUserId: 3,
  tagReason: 'Inspection',
  requestId: null,
  initialQuantity: '1',
  remainingQuantity: '1',
  incomingDeliveryItemId: null,
  outgoingDeliveryItemId: null,
  createdAt: '',
  conditionChanges: [],
  resolutions: [],
}
let calls: { url: string; body: Record<string, unknown>; method: string }[],
  fail: boolean,
  persistOnFailure: boolean,
  currentLot: QuarantineLot | null
let pending: Promise<void> | undefined
beforeEach(() => {
  calls = []
  fail = false
  persistOnFailure = false
  currentLot = null
  pending = undefined
  auth.role = 'STAFF'
  apiClient.defaults.adapter = async (config) => {
    let data: unknown = []
    if (config.method === 'post' || config.method === 'patch') {
      const body = JSON.parse(config.data)
      calls.push({ url: config.url!, body, method: config.method })
      await pending
      if (config.method === 'post' && (!fail || persistOnFailure))
        currentLot = {
          ...lot,
          requestId: body.requestId,
          initialQuantity: body.quantity,
          reportedCondition: body.condition,
          tagReason: body.reason,
        }
      if (fail) throw new AxiosError('Network Error')
      data = config.method === 'patch' ? { ...lot, condition: body.condition } : currentLot
    } else if (config.url === '/stock-items')
      data = [
        {
          id: 7,
          inventoryItemId: 1,
          warehouseId: 2,
          quantity: '10',
          availableQuantity: '1.75',
          inventoryItem: { id: 1, name: 'Rice', unit: 'kg' },
          warehouse: { id: 2, name: 'Main' },
        },
      ]
    else if (config.url === '/warehouses') data = [{ id: 2, name: 'Main', isActive: true }]
    else if (config.url === '/inventory-items')
      data = [{ id: 1, name: 'Rice', unit: 'kg', isActive: true }]
    else if (config.url === '/stock-items/quarantine-lots') data = currentLot ? [currentLot] : []
    return { config, data, status: 200, statusText: 'OK', headers: {} }
  }
})
afterEach(() => {
  apiClient.defaults.adapter = adapter
})
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return { client, wrapper: Wrapper }
}
async function tag() {
  const close = vi.fn(),
    context = setup()
  const hook = renderHook(() => useQuarantineTag(close, 7), context)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  act(() => {
    hook.result.current.setQuantity('1.25')
    hook.result.current.setReason(' Inspection ')
  })
  return { ...hook, close, client: context.client }
}
it('tags the real stock record with exact decimals, a stable request ID, and refreshes authoritative data', async () => {
  const { result, close, client } = await tag()
  const invalidate = vi.spyOn(client, 'invalidateQueries')
  await act(() => result.current.submit())
  expect(calls).toHaveLength(1)
  expect(calls[0]).toEqual({
    url: '/stock-items/quarantine-lots',
    method: 'post',
    body: {
      stockItemId: 7,
      condition: 'DAMAGED',
      quantity: '1.25',
      reason: 'Inspection',
      requestId: expect.any(String),
    },
  })
  expect(calls[0].body.requestId).toMatch(/^[a-f\d-]{36}$/)
  expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey)).toEqual(
    expect.arrayContaining([
      ['stock-items'],
      ['quarantine-lots'],
      ['products'],
      ['warehouses'],
      ['purchase-orders'],
    ]),
  )
  expect(close).toHaveBeenCalledTimes(1)
})
it.each(['0', '-1', '1.001', '1e0', '1.76', '10000000000'])(
  'rejects unsupported or unavailable quantity %s',
  async (quantity) => {
    const { result } = await tag()
    act(() => result.current.setQuantity(quantity))
    await act(() => result.current.submit())
    expect(calls).toHaveLength(0)
    expect(result.current.error).toMatch(/positive quantity/)
  },
)
it('requires an inspection reason', async () => {
  const { result } = await tag()
  act(() => result.current.setReason(' '))
  await act(() => result.current.submit())
  expect(calls).toHaveLength(0)
})
it('prevents duplicate submissions while a tag is pending', async () => {
  let resolve!: () => void
  pending = new Promise<void>((done) => {
    resolve = done
  })
  const { result } = await tag()
  let first!: Promise<void>
  act(() => {
    first = result.current.submit()
    void result.current.submit()
  })
  await waitFor(() => expect(calls).toHaveLength(1))
  await act(async () => {
    resolve()
    await first
  })
})
it('recovers an uncertain persisted tag by request ID without another stock mutation', async () => {
  fail = true
  persistOnFailure = true
  const { result, close } = await tag()
  await act(() => result.current.submit())
  expect(result.current.canSubmit).toBe(false)
  expect(result.current.canEdit).toBe(false)
  await act(() => result.current.refreshData())
  expect(close).toHaveBeenCalledTimes(1)
  expect(calls).toHaveLength(1)
})
it('explicitly retries an absent uncertain tag with the same request and payload', async () => {
  fail = true
  const { result } = await tag()
  await act(() => result.current.submit())
  await act(() => result.current.refreshData())
  fail = false
  await act(() => result.current.submit())
  expect(calls).toHaveLength(2)
  expect(calls[1].body).toEqual(calls[0].body)
})
it.each(['ADMIN', 'MANAGER', 'SUPERADMIN', 'STAFF'])('%s can tag warehouse stock', async (role) => {
  auth.role = role
  const { result } = await tag()
  expect(result.current.canTag).toBe(true)
})
it('denies unknown roles', async () => {
  auth.role = 'UNKNOWN'
  const { result } = await tag()
  await act(() => result.current.submit())
  expect(calls).toHaveLength(0)
})
it('requires a different open-lot condition and audit reason, then refreshes after PATCH', async () => {
  auth.role = 'SUPERADMIN'
  const close = vi.fn(),
    context = setup()
  render(<CorrectQuarantineConditionDialog lot={lot} onClose={close} />, context)
  expect(
    (screen.getByRole('button', { name: 'Save condition' }) as HTMLButtonElement).disabled,
  ).toBe(true)
  fireEvent.change(screen.getByLabelText('Corrected condition'), { target: { value: 'SPOILED' } })
  fireEvent.change(screen.getByLabelText('Correction reason'), {
    target: { value: ' Lab inspection ' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Save condition' }))
  await waitFor(() => expect(close).toHaveBeenCalledTimes(1))
  expect(calls[0]).toEqual({
    url: '/stock-items/quarantine-lots/11/condition',
    method: 'patch',
    body: { condition: 'SPOILED', reason: 'Lab inspection' },
  })
})
it('blocks condition correction by staff and on closed lots', () => {
  const { rerender } = render(
    <CorrectQuarantineConditionDialog lot={lot} onClose={vi.fn()} />,
    setup(),
  )
  expect((screen.getByLabelText('Corrected condition') as HTMLSelectElement).disabled).toBe(false)
  expect(screen.getByLabelText('Corrected condition').closest('fieldset')?.disabled).toBe(true)
  auth.role = 'ADMIN'
  rerender(
    <CorrectQuarantineConditionDialog lot={{ ...lot, remainingQuantity: '0' }} onClose={vi.fn()} />,
  )
  fireEvent.change(screen.getByLabelText('Corrected condition'), { target: { value: 'SPOILED' } })
  fireEvent.change(screen.getByLabelText('Correction reason'), { target: { value: 'Inspection' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save condition' }))
  expect(calls).toHaveLength(0)
})
