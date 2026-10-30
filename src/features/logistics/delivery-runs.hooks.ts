import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelDeliveryRunApi, cancelRunMemberApi, changeRunMembersApi, createDeliveryRunApi,
  dispatchDeliveryRunApi, fetchDeliveryRunByIdApi, fetchDeliveryRunsPageApi,
  reconcileRunMemberApi, reopenRunMemberApi, updateDeliveryRunDraftApi,
} from './delivery-runs.api'
import type {
  ChangeRunMembersPayload, CreateDeliveryRunPayload, DeliveryRunFilter, DeliveryRunRecord,
  DispatchDeliveryRunPayload, ReconcileRunMemberPayload, RunMemberActionPayload,
  RunMemberReconciliationResponse, UpdateDeliveryRunDraftPayload,
} from './delivery-runs.types'

export const DELIVERY_RUNS_QUERY_KEY = ['delivery-runs'] as const

export function useDeliveryRuns(filter: DeliveryRunFilter = {}) {
  return useInfiniteQuery({
    queryKey: [...DELIVERY_RUNS_QUERY_KEY, 'pages', filter],
    initialPageParam: filter.cursor,
    queryFn: ({ pageParam, signal }) => fetchDeliveryRunsPageApi({ ...filter, cursor: pageParam }, signal),
    getNextPageParam: (lastPage, pages) => pages.slice(0, -1).some((page) => page.nextCursor === lastPage.nextCursor)
      ? undefined : lastPage.nextCursor ?? undefined,
  })
}

export function useDeliveryRunById(id?: number) {
  return useQuery({
    queryKey: [...DELIVERY_RUNS_QUERY_KEY, 'id', id],
    queryFn: ({ signal }) => fetchDeliveryRunByIdApi(id!, signal),
    enabled: Boolean(id && id > 0),
    staleTime: 0,
  })
}

function useRunMutation<T, R extends DeliveryRunRecord | RunMemberReconciliationResponse>(mutationFn: (variables: T) => Promise<R>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    retry: false,
    onSuccess: (result) => {
      const run = 'id' in result ? result as DeliveryRunRecord : result.run
      queryClient.setQueryData([...DELIVERY_RUNS_QUERY_KEY, 'id', run.id], run)
      if ('delivery' in result)
        queryClient.setQueryData(['outgoing-deliveries', 'id', result.delivery.id], result.delivery)
    },
    // A rejected or interrupted workflow can still leave these operational views stale.
    onSettled: () => Promise.all([
      DELIVERY_RUNS_QUERY_KEY, ['outgoing-deliveries'], ['sales-orders'], ['stock-items'],
      ['quarantine-lots'], ['delivery-vehicles'], ['staffing'], ['products'], ['warehouses'],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  })
}

export function useCreateDeliveryRun() {
  return useRunMutation((payload: CreateDeliveryRunPayload) => createDeliveryRunApi(payload))
}
export function useUpdateDeliveryRunDraft() {
  return useRunMutation(({ id, payload }: { id: number; payload: UpdateDeliveryRunDraftPayload }) => updateDeliveryRunDraftApi(id, payload))
}
export function useChangeRunMembers() {
  return useRunMutation(({ id, payload }: { id: number; payload: ChangeRunMembersPayload }) => changeRunMembersApi(id, payload))
}
export function useReopenRunMember() {
  return useRunMutation(({ id, deliveryId, payload }: { id: number; deliveryId: number; payload: RunMemberActionPayload }) => reopenRunMemberApi(id, deliveryId, payload))
}
export function useCancelRunMember() {
  return useRunMutation(({ id, deliveryId, payload }: { id: number; deliveryId: number; payload: RunMemberActionPayload }) => cancelRunMemberApi(id, deliveryId, payload))
}
export function useCancelDeliveryRun() {
  return useRunMutation(({ id, expectedRevision }: { id: number; expectedRevision: number }) => cancelDeliveryRunApi(id, expectedRevision))
}
export function useDispatchDeliveryRun() {
  return useRunMutation(({ id, payload }: { id: number; payload: DispatchDeliveryRunPayload }) => dispatchDeliveryRunApi(id, payload))
}
export function useReconcileRunMember() {
  return useRunMutation(({ id, deliveryId, payload }: { id: number; deliveryId: number; payload: ReconcileRunMemberPayload }) => reconcileRunMemberApi(id, deliveryId, payload))
}
