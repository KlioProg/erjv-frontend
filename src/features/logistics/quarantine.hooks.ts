import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchQuarantineLotsApi, resolveQuarantineApi, createManualQuarantineApi, correctQuarantineConditionApi } from './stock-items.api'
import { STOCK_ITEMS_QUERY_KEY } from './stock-items.hooks'
import { PURCHASE_ORDERS_QUERY_KEY } from './purchase-orders.hooks'
import type { ResolveQuarantinePayload, CreateManualQuarantinePayload, CorrectQuarantineConditionPayload } from './stock-items.types'

export const QUARANTINE_QUERY_KEY = ['quarantine-lots'] as const

export function useQuarantineLots(stockItemId?: number) {
  return useQuery({
    queryKey: [...QUARANTINE_QUERY_KEY, stockItemId ?? 'all'],
    queryFn: () => fetchQuarantineLotsApi(stockItemId),
  })
}

export function useRefreshQuarantine() {
  const client = useQueryClient()
  return async () => {
    // Stock warnings share stock-items/products/warehouses caches. Await active
    // refetches so an uncertain mutation cannot immediately be submitted again.
    await Promise.all(
      [
        QUARANTINE_QUERY_KEY,
        STOCK_ITEMS_QUERY_KEY,
        ['products'],
        ['warehouses'],
        PURCHASE_ORDERS_QUERY_KEY,
      ].map((queryKey) => client.invalidateQueries({ queryKey }, { throwOnError: true })),
    )
  }
}

export function useResolveQuarantine() {
  return useMutation({
    mutationFn: ({ lotId, payload }: { lotId: number; payload: ResolveQuarantinePayload }) =>
      resolveQuarantineApi(lotId, payload),
    retry: false,
  })
}

export function useCreateManualQuarantine() {
  return useMutation({ mutationFn: (payload: CreateManualQuarantinePayload) => createManualQuarantineApi(payload), retry: false })
}

export function useCorrectQuarantineCondition() {
  return useMutation({ mutationFn: ({ lotId, payload }: { lotId: number; payload: CorrectQuarantineConditionPayload }) => correctQuarantineConditionApi(lotId, payload), retry: false })
}
