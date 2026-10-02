import type { SalesOrderRecord } from './sales-orders.types'
import type { OutgoingDeliveryRecord } from '../logistics/outgoing-deliveries.types'

const neutralBadge = 'border-border/70! bg-muted/20 text-muted-foreground'
const infoBadge = 'border-status-info-foreground/15! bg-status-info text-status-info-foreground'
const warningBadge =
  'border-status-warning-foreground/15! bg-status-warning text-status-warning-foreground'
const successBadge =
  'border-status-success-foreground/15! bg-status-success text-status-success-foreground'

function formatDeliveryDate(value: string | null | undefined, includeTime = false) {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
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
      rowClassName: '[&_td:first-child]:border-l-destructive/25!',
    }
  }

  if (order.status === 'DELIVERED') {
    const completionDates = relatedDeliveries
      .filter((record) => record.status === 'DELIVERED' && record.deliveredAt)
      .map((record) => record.deliveredAt!)
      .filter((value) => !Number.isNaN(new Date(value).getTime()))
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    const date = formatDeliveryDate(order.completedAt) || formatDeliveryDate(completionDates[0])
    return {
      label: 'Delivered',
      supportingText: date ? `Completed ${date}` : undefined,
      badgeClassName: successBadge,
      rowClassName: '[&_td:first-child]:border-l-status-success-foreground/35!',
    }
  }

  if (delivery?.status === 'DISPATCHED')
    return {
      label: 'In Transit',
      supportingText: 'On the way',
      badgeClassName: infoBadge,
      rowClassName: '[&_td:first-child]:border-l-status-info-foreground/35!',
    }

  if (delivery?.status === 'SCHEDULED')
    return {
      label: 'Scheduled',
      supportingText: formatDeliveryDate(delivery.scheduledAt, true),
      badgeClassName: infoBadge,
      rowClassName: '[&_td:first-child]:border-l-status-info-foreground/35!',
    }

  if (delivery?.status === 'DRAFT')
    return {
      label: 'Preparing',
      supportingText: 'Delivery draft',
      badgeClassName: neutralBadge,
      rowClassName: '',
    }

  if (order.status === 'PARTIALLY_DELIVERED') {
    const completedCount = relatedDeliveries.filter(
      (record) => record.status === 'DELIVERED',
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
      rowClassName: '[&_td:first-child]:border-l-status-warning-foreground/35!',
    }
  }

  return {
    label: 'Not Prepared',
    supportingText: order.status === 'CONFIRMED' ? 'Ready for delivery' : 'No delivery yet',
    badgeClassName: neutralBadge,
    rowClassName: '',
  }
}
