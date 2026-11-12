import { useEffect, useRef, useState } from 'react'
import { hasValidOutgoingPlan } from './outgoing-issues'
import { useQueries } from '@tanstack/react-query'
import { fetchOutgoingDeliveryByIdApi } from './outgoing-deliveries.api'
import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'
import { getApiError, getErrorMessage } from '@/lib/api-client'

export function useRunDeliverySelection(warehouseId?: number, existingIds: number[] = []) {
  const active = useRef(true)
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])
  const [selected, setSelected] = useState<OutgoingDeliveryRecord[]>([])
  const queries = useQueries({
    queries: selected.map((delivery) => ({
      queryKey: ['outgoing-deliveries', 'id', delivery.id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchOutgoingDeliveryByIdApi(delivery.id, signal),
      retry: false,
      staleTime: 0,
    })),
  })
  const issue = (
    delivery: OutgoingDeliveryRecord,
    latest: OutgoingDeliveryRecord | null | undefined,
    error: unknown,
  ) => {
    if (delivery.warehouseId !== warehouseId)
      return 'Select a delivery from the chosen warehouse, or remove this selection.'
    if (existingIds.includes(delivery.id))
      return 'This delivery is already in the run. Remove it from the selection.'
    if (error)
      return getApiError(error)?.status === 404
        ? 'This delivery is no longer available.'
        : getErrorMessage(error)
    if (latest === undefined) return undefined
    if (!latest || latest.id !== delivery.id) return 'This delivery is no longer available.'
    if (latest.runId !== null) return 'This delivery belongs to another trip.'
    if (latest.status !== 'READY' || latest.warehouseId !== warehouseId)
      return 'This delivery is no longer eligible for this warehouse.'
    if (!hasValidOutgoingPlan(latest))
      return 'This delivery needs a valid saved plan before it can join a trip. Review the outgoing delivery.'
    if (
      !Number.isSafeInteger(delivery.revision) ||
      delivery.revision < 1 ||
      latest.revision !== delivery.revision
    )
      return 'This delivery changed. Remove it and select it again to review the latest version.'
    return undefined
  }
  const issues = selected.map((delivery, index) =>
    issue(delivery, queries[index].data, queries[index].error),
  )
  const checking = queries.some((query) => query.isFetching || query.isPending)
  const overLimit = selected.length + existingIds.length > 100
  return {
    selected,
    issues,
    checking,
    canSave: !checking && !overLimit && issues.every((value) => !value),
    toggle: (delivery: OutgoingDeliveryRecord) =>
      setSelected((current) =>
        current.some((entry) => entry.id === delivery.id)
          ? current.filter((entry) => entry.id !== delivery.id)
          : current.length + existingIds.length < 100
            ? [...current, delivery]
            : current,
      ),
    remove: (id: number) => setSelected((current) => current.filter((entry) => entry.id !== id)),
    clear: () => setSelected([]),
    retry: (index: number) => void queries[index].refetch(),
    verify: async () => {
      if (overLimit) return false
      const results = await Promise.all(queries.map((query) => query.refetch()))
      return (
        active.current &&
        selected.every(
          (delivery, index) =>
            !results[index].isError &&
            results[index].data !== undefined &&
            !issue(delivery, results[index].data, false),
        )
      )
    },
  }
}
