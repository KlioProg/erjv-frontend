import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  correctQuarantineConditionApi,
  createManualQuarantineApi,
  fetchQuarantineLotsApi,
  resolveQuarantineApi,
} from './stock-items.api'
import type {
  ManualQuarantinePayload,
  QuarantineConditionPayload,
  QuarantineFilter,
  QuarantineResolutionPayload,
} from './stock-items.types'

export const QUARANTINE_QUERY_KEY = ['quarantine-lots'] as const

export function useRefreshQuarantine() {
  const client = useQueryClient()
  return () => Promise.all(
    ['stock-items', 'products', 'warehouses', 'quarantine-lots', 'purchase-orders', 'incoming-deliveries', 'outgoing-deliveries']
      .map((key) => client.invalidateQueries({ queryKey: [key] }, { throwOnError: true })),
  )
}

export const useCreateManualQuarantine = useManualQuarantineTag

function refreshStockConditionQueries(client: QueryClient) {
  // Warnings share stock/product/warehouse caches; planning and receipt balances also depend on these writes.
  return Promise.all(
    [
      'stock-items',
      'products',
      'warehouses',
      'quarantine-lots',
      'purchase-orders',
      'incoming-deliveries',
      'outgoing-deliveries',
    ].map((key) => client.invalidateQueries({ queryKey: [key] })),
  )
}

export function useQuarantineLots(filter?: QuarantineFilter, enabled = true) {
  return useQuery({
    queryKey: [...QUARANTINE_QUERY_KEY, filter ?? {}],
    queryFn: () => fetchQuarantineLotsApi(filter),
    enabled,
  })
}

export function useManualQuarantineTag() {
  const client = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: (payload: ManualQuarantinePayload) => createManualQuarantineApi(payload),
    onSettled: () => refreshStockConditionQueries(client),
  })
}

export function useCorrectQuarantineCondition() {
  const client = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: ({ id, payload }: { id: number; payload: QuarantineConditionPayload }) =>
      correctQuarantineConditionApi(id, payload),
    onSettled: () => refreshStockConditionQueries(client),
  })
}

export function useResolveQuarantine() {
  const client = useQueryClient()
  return useMutation({
    retry: false,
    mutationFn: ({ id, payload }: { id: number; payload: QuarantineResolutionPayload }) =>
      resolveQuarantineApi(id, payload),
    onSettled: () => refreshStockConditionQueries(client),
  })
}
