import type { SalesOrderRecord } from './sales-orders.types'
import type { OutgoingDeliveryRecord } from '../logistics/outgoing-deliveries.types'
import { parseStockCents } from '../logistics/stock-display.ts'
import type { LifecycleMilestone } from '../../components/ui/LifecycleProgress'
import type { StatusBadgeTone } from '../../components/ui/StatusBadge'

/** Saved order state takes precedence over the state of any single shipment. */
export function getSalesOrderProgressDisplay(
  order: Pick<SalesOrderRecord, 'id' | 'status'>,
  deliveries: OutgoingDeliveryRecord[],
  complete = true,
): { label: string; tone: StatusBadgeTone; explanation: string; milestones: LifecycleMilestone[] } {
  const linked = deliveries.filter(
    (record) => record.salesOrderId === order.id && record.status !== 'CANCELLED',
  )
  let label = 'Confirmed'
  let tone: StatusBadgeTone = 'info'
  let explanation = complete
    ? 'Delivery preparation has not started.'
    : 'Delivery progress is unavailable. Refresh the related deliveries before continuing.'
  let stage = 1
  if (order.status === 'CANCELLED')
    return {
      label: 'Cancelled',
      tone: 'neutral',
      explanation: 'This order was cancelled. Its saved items remain available for review.',
      milestones: [{ id: 'cancelled', label: 'Cancelled', state: 'cancelled' }],
    }
  if (order.status === 'PARTIALLY_DELIVERED')
    return {
      label: 'Partially Delivered',
      tone: 'progress',
      explanation:
        'Some goods have been delivered. Review each shipment and the remaining quantities before arranging more.',
      milestones: [],
    }
  if (order.status === 'DRAFT') {
    label = 'Draft'
    tone = 'neutral'
    stage = 0
    explanation = 'Review the customer and ordered items before confirming.'
  } else if (order.status === 'DELIVERED') {
    label = 'Completed'
    tone = 'success'
    stage = 3
    explanation = 'Fulfillment is complete. Review the recorded delivery results below.'
  } else if (complete && linked.some((record) => record.status === 'DISPATCHED')) {
    label = 'In Transit'
    stage = 2
    explanation =
      'Goods have departed. Return when the delivery outcomes are known to record results.'
  } else if (
    complete &&
    linked.some((record) => record.status === 'DRAFT' || record.status === 'READY')
  ) {
    label = 'Preparing'
    stage = 2
    explanation =
      'Delivery preparation is saved. Ready goods have not necessarily departed; review the linked shipments.'
  } else if (complete && linked.length)
    explanation =
      'Delivery results are recorded. Review the remaining quantities; the order is not marked complete.'
  const labels = [
    'Draft',
    'Confirmed',
    label === 'In Transit' ? 'In Transit' : 'Delivery',
    'Completed',
  ]
  return {
    label,
    tone,
    explanation,
    milestones:
      !complete && stage === 1
        ? []
        : labels.map((name, index) => ({
            id: String(index),
            label: name,
            state:
              stage === 3 || index < stage ? 'complete' : index === stage ? 'current' : 'upcoming',
          })),
  }
}

/** Detail milestones describe departure and fulfillment, not delivery preparation. */
export function getSalesOrderDetailProgress(
  order: Pick<SalesOrderRecord, 'id' | 'status'>,
  deliveries: OutgoingDeliveryRecord[],
  complete = true,
): ReturnType<typeof getSalesOrderProgressDisplay> {
  const saved = getSalesOrderProgressDisplay(order, deliveries, complete)
  if (order.status === 'CANCELLED') return saved
  if (order.status === 'PARTIALLY_DELIVERED')
    return {
      ...saved,
      explanation:
        'Some goods have been delivered. Review outstanding quantities and linked deliveries.',
    }
  const stage =
    order.status === 'DRAFT'
      ? 0
      : order.status === 'DELIVERED'
        ? 3
        : saved.label === 'In Transit'
          ? 2
          : 1
  const labels =
    !complete && stage === 1
      ? ['Draft', 'Confirmed']
      : ['Draft', 'Confirmed', 'In Transit', 'Delivered']
  return {
    ...saved,
    label: order.status === 'DELIVERED' ? 'Delivered' : saved.label,
    explanation:
      order.status === 'DELIVERED'
        ? 'All ordered goods have been delivered.'
        : saved.label === 'Preparing'
          ? 'Delivery preparation is saved.'
          : saved.label === 'In Transit'
            ? 'A delivery is in transit. Record results when the outcome is known.'
            : saved.explanation,
    milestones: labels.map((label, index) => ({
      id: String(index),
      label,
      state: stage === 3 || index < stage ? 'complete' : index === stage ? 'current' : 'upcoming',
    })),
  }
}

/** Return-confirmed delivered goods only; never infer delivery from the loaded quantity. */
export function salesDeliveryProgress(
  order: Pick<SalesOrderRecord, 'id' | 'items'>,
  deliveries: OutgoingDeliveryRecord[],
) {
  const totals = new Map(order.items.map((item) => [item.id, 0n]))
  const seen = new Set<number>()
  let available = true
  for (const delivery of deliveries) {
    if (delivery.salesOrderId !== order.id || delivery.status !== 'RECONCILED') continue
    if (!Array.isArray(delivery.items)) {
      available = false
      break
    }
    for (const item of delivery.items) {
      const quantity = parseStockCents(item.deliveredQuantity)
      if (quantity === null || !totals.has(item.salesOrderItemId) || seen.has(item.id)) {
        available = false
        break
      }
      seen.add(item.id)
      totals.set(item.salesOrderItemId, totals.get(item.salesOrderItemId)! + quantity)
    }
  }
  return order.items.map((item) => {
    const ordered = parseStockCents(item.quantity)
    const delivered = available ? totals.get(item.id)! : null
    return {
      item,
      ordered,
      delivered,
      remaining:
        ordered !== null && delivered !== null && delivered <= ordered ? ordered - delivered : null,
    }
  })
}

const neutralBadge = 'border-border/70! bg-muted/20 text-muted-foreground'
const infoBadge = 'border-status-info-foreground/15! bg-status-info text-status-info-foreground'
const warningBadge =
  'border-status-warning-foreground/15! bg-status-warning text-status-warning-foreground'
const successBadge =
  'border-status-success-foreground/15! bg-status-success text-status-success-foreground'

function formatDeliveryDate(value: string | null | undefined) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Presentation only: action selection and fulfillment transitions stay in OrdersView. */
export function getSalesOrderDeliveryDisplay(
  order: SalesOrderRecord,
  delivery: OutgoingDeliveryRecord | undefined,
  deliveries: OutgoingDeliveryRecord[],
) {
  const relatedDeliveries = deliveries.filter(
    (record) => record.salesOrderId === order.id && record.status !== 'CANCELLED',
  )

  if (order.status === 'CANCELLED') {
    const date = formatDeliveryDate(order.cancelledAt)
    return {
      label: 'Cancelled',
      supportingText: date ? `Cancelled ${date}` : undefined,
      badgeClassName: 'border-destructive/15! bg-destructive/5 text-destructive',
    }
  }

  if (order.status === 'DELIVERED') {
    const completionDates = relatedDeliveries
      .filter((record) => record.status === 'RECONCILED' && record.reconciledAt)
      .map((record) => record.reconciledAt!)
      .filter((value) => !Number.isNaN(new Date(value).getTime()))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    const date = formatDeliveryDate(order.completedAt) || formatDeliveryDate(completionDates[0])
    return {
      label: 'Delivered',
      supportingText: date ? `Completed ${date}` : undefined,
      badgeClassName: successBadge,
    }
  }

  if (delivery?.status === 'DISPATCHED')
    return {
      label: 'Dispatched',
      supportingText: 'Departure recorded',
      badgeClassName: infoBadge,
    }

  if (delivery?.status === 'READY')
    return {
      label: 'Ready',
      supportingText: delivery.runId
        ? `Assigned to Trip #${delivery.runId}`
        : 'Awaiting trip assignment',
      badgeClassName: infoBadge,
    }

  if (delivery?.status === 'DRAFT')
    return {
      label: 'Preparing',
      supportingText: 'Delivery draft',
      badgeClassName: neutralBadge,
    }

  if (order.status === 'PARTIALLY_DELIVERED') {
    const completedCount = relatedDeliveries.filter(
      (record) => record.status === 'RECONCILED',
    ).length
    return {
      label: 'Partial Delivery',
      supportingText:
        completedCount > 0
          ? completedCount < relatedDeliveries.length
            ? `${completedCount} of ${relatedDeliveries.length} completed`
            : `${completedCount} ${completedCount === 1 ? 'delivery' : 'deliveries'} completed`
          : 'More items to deliver',
      badgeClassName: warningBadge,
    }
  }

  return {
    label: 'Not Prepared',
    supportingText: order.status === 'CONFIRMED' ? 'Ready for delivery' : 'No delivery yet',
    badgeClassName: neutralBadge,
  }
}
