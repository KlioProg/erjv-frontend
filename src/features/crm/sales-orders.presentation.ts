import type { SalesOrderRecord } from './sales-orders.types'
import type { OutgoingDeliveryRecord } from '../logistics/outgoing-deliveries.types'
import { parseStockCents } from '../logistics/stock-display.ts'

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
      remaining: ordered !== null && delivered !== null && delivered <= ordered ? ordered - delivered : null,
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
      label: 'In Transit',
      supportingText: 'On the way',
      badgeClassName: infoBadge,
    }

  if (delivery?.status === 'READY')
    return {
      label: 'Ready',
      supportingText: delivery.runId ? `Run #${delivery.runId}` : 'Awaiting run assignment',
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
