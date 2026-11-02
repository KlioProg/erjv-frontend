import { useResourcePage } from '@/lib/use-cursor-page'
import type { IncomingDeliveryRecord } from './incoming-deliveries.types'
import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'
import type { DeliveryRunRecord } from './delivery-runs.types'

// Validate the fields used by the overview before presenting counts or an all-clear.
function preview<T extends { id: number }>(
  query: ReturnType<typeof useResourcePage<T>>,
  valid: (item: T) => boolean,
) {
  const isError = query.isError || query.items.some((item) => !valid(item))
  return { ...query, isError, items: isError ? [] : query.items }
}

export function useDashboardDeliveries() {
  const incoming = useResourcePage<IncomingDeliveryRecord>('/incoming-deliveries', {
    statuses: ['SCHEDULED'],
  })
  const outgoing = useResourcePage<OutgoingDeliveryRecord>('/outgoing-deliveries', {
    statuses: ['READY'],
    unassigned: 'true',
  })
  const drafts = useResourcePage<DeliveryRunRecord>('/delivery-runs', { statuses: ['DRAFT'] })
  const dispatched = useResourcePage<DeliveryRunRecord>('/delivery-runs', {
    statuses: ['DISPATCHED'],
  })
  const validRun = (run: DeliveryRunRecord) =>
    typeof run.runNumber === 'string' &&
    run.runNumber.length > 0 &&
    Array.isArray(run.deliveries) &&
    run.deliveries.every(
      (member) =>
        Number.isSafeInteger(member?.id) &&
        member.id > 0 &&
        ['DRAFT', 'READY', 'DISPATCHED', 'RECONCILED', 'CANCELLED'].includes(member.status),
    )
  return {
    incoming: preview(
      incoming,
      (item) =>
        item.status === 'SCHEDULED' &&
        typeof item.deliveryNumber === 'string' &&
        item.deliveryNumber.length > 0 &&
        (item.scheduledAt === null ||
          (typeof item.scheduledAt === 'string' && Number.isFinite(Date.parse(item.scheduledAt)))),
    ),
    outgoing: preview(
      outgoing,
      (item) =>
        item.status === 'READY' &&
        item.runId === null &&
        typeof item.deliveryNumber === 'string' &&
        item.deliveryNumber.length > 0,
    ),
    drafts: preview(drafts, (run) => run.status === 'DRAFT' && validRun(run)),
    dispatched: preview(dispatched, (run) => run.status === 'DISPATCHED' && validRun(run)),
  }
}
