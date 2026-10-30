import { useCursorLookup } from '@/lib/use-cursor-lookup'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import {
  fetchQuarantineLotApi,
  correctQuarantineConditionApi,
  createManualQuarantineApi,
  resolveQuarantineApi,
} from './quarantine.api'
import type {
  ManualQuarantinePayload,
  QuarantineConditionPayload,
  QuarantineFilter,
  QuarantineLot,
  QuarantineConditionChange,
  QuarantineResolution,
  QuarantineResolutionPayload,
} from './quarantine.types'

export const QUARANTINE_QUERY_KEY = ['quarantine-lots'] as const

export function useRefreshQuarantine() {
  const client = useQueryClient()
  return () =>
    Promise.all(
      [
        'stock-items',
        'products',
        'warehouses',
        'quarantine-lots',
        'purchase-orders',
        'incoming-deliveries',
        'outgoing-deliveries',
      ].map((key) => client.invalidateQueries({ queryKey: [key] }, { throwOnError: true })),
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
  return useCursorLookup<QuarantineLot>('/stock-items/quarantine-lots', filter, enabled)
}
export function useQuarantineLot(id: number) {
  return useQuery({
    queryKey: [...QUARANTINE_QUERY_KEY, id],
    queryFn: () => fetchQuarantineLotApi(id),
  })
}
export function useQuarantineConditionChanges(id: number) {
  return useCursorLookup<QuarantineConditionChange>(
    `/stock-items/quarantine-lots/${id}/condition-changes`,
  )
}
export function useQuarantineResolutions(id: number) {
  return useCursorLookup<QuarantineResolution>(`/stock-items/quarantine-lots/${id}/resolutions`)
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
