import type { IncomingDeliveryRecord } from './incoming-deliveries.types'
import type { PurchaseOrderRecord } from './purchase-orders.types'
import type { Warehouse } from './warehouses.types'

export function incomingOrderSchedulingIssue(status?: string) {
  if (status === 'CONFIRMED' || status === 'PARTIALLY_RECEIVED') return null
  if (status === 'RECEIVED')
    return {
      target: 'order' as const,
      title: 'Purchase Order Already Received',
      message:
        'All goods for this purchase order have already been recorded as received. No additional arrival can be scheduled from this order.',
    }
  if (status === 'DRAFT')
    return {
      target: 'order' as const,
      title: 'Purchase Order Not Confirmed',
      message: 'Confirm the purchase order before scheduling an arrival.',
    }
  if (status === 'CANCELLED')
    return {
      target: 'order' as const,
      title: 'Purchase Order Cancelled',
      message:
        'An arrival cannot be scheduled for a cancelled purchase order. View the purchase order for details.',
    }
  return {
    target: 'refresh' as const,
    title: 'Purchase Order Eligibility Unavailable',
    message:
      'The purchase order could not be verified. Open the purchase order or recheck eligibility before scheduling.',
  }
}

export function incomingSchedulingIssue({
  delivery,
  order,
  warehouse,
}: {
  delivery: IncomingDeliveryRecord
  order: PurchaseOrderRecord
  warehouse: Warehouse
}) {
  if (delivery.status !== 'DRAFT')
    return {
      target: 'refresh' as const,
      title: 'Delivery Changed',
      message:
        'This delivery is no longer a draft. Close this form and review the current delivery record.',
    }
  const issue = incomingOrderSchedulingIssue(order.status)
  if (issue) return issue
  if (!warehouse.isActive)
    return {
      target: 'warehouse' as const,
      title: 'Warehouse Unavailable',
      message:
        'The receiving warehouse is inactive. Review the delivery and choose an active warehouse before scheduling.',
    }
  if (!delivery.scheduledAt || !Number.isFinite(Date.parse(delivery.scheduledAt)))
    return {
      target: 'schedule' as const,
      title: 'Arrival Date Required',
      message:
        'This draft needs a valid arrival date before it can be scheduled. Review the delivery record.',
    }
  return null
}
