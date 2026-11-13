import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'
import { parseStockCents } from './stock-display.ts'

export function hasValidOutgoingPlan(delivery: Pick<OutgoingDeliveryRecord, 'warehouseId' | 'plannedItems'>) {
  return Number.isSafeInteger(delivery.warehouseId) && Number(delivery.warehouseId) > 0 &&
    !!delivery.plannedItems?.length && delivery.plannedItems.every((item) => (parseStockCents(item.plannedQuantity) ?? 0n) > 0n)
}

// Preparation checks mirror draft readiness validation, not stock availability.
export function outgoingPreparationIssue(
  delivery: OutgoingDeliveryRecord,
  orderStatus?: string,
  warehouseActive?: boolean,
) {
  if (!['DRAFT', 'READY'].includes(delivery.status)) return null
  if (!orderStatus)
    return {
      target: 'refresh' as const,
      title: 'Sales Order Unavailable',
      message:
        'The sales order could not be verified. Refresh the linked record before continuing.',
    }
  if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(orderStatus))
    return {
      target: 'order' as const,
      title: 'Sales Order Needs Attention',
      message:
        orderStatus === 'DRAFT'
          ? 'Confirm the sales order before preparing this delivery.'
          : orderStatus === 'CANCELLED'
            ? 'This sales order is cancelled. Its delivery cannot be prepared.'
            : orderStatus === 'DELIVERED'
              ? 'This sales order has already been delivered. Its delivery cannot be prepared.'
              : 'This sales order is not eligible for delivery preparation. Review its current status.',
    }
  if (delivery.warehouseId == null || warehouseActive === false)
    return {
      target: 'delivery' as const,
      title: 'Source Warehouse Required',
      message:
        'Select an active source warehouse in Edit Delivery before marking this draft ready.',
    }
  if (warehouseActive === undefined)
    return {
      target: 'refresh' as const,
      title: 'Source Warehouse Unavailable',
      message:
        'The source warehouse could not be verified. Refresh the linked details before continuing.',
    }
  if (!hasValidOutgoingPlan(delivery))
    return {
      target: 'delivery' as const,
      title: 'Preparation Incomplete',
      message: delivery.status === 'READY'
        ? 'This Ready delivery has no valid planned quantities. Review its plan before trip assignment or departure. Reopen an unassigned delivery as a draft to correct it.'
        : 'Add planned quantities in Edit Delivery before marking this draft ready.',
    }
  return null
}
