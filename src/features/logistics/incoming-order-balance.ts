import type { PurchaseOrderRecord } from './purchase-orders.types'
import type { IncomingDeliveryRecord } from './incoming-deliveries.types'
import { remainingDeliveryQuantity, sumDeliveryQuantities } from './delivery-quantities.ts'

/** Draft, scheduled and completed shipments all consume the arrangement balance. */
export function incomingOrderRemainingQuantity(
  order: Pick<PurchaseOrderRecord, 'id' | 'items'>,
  deliveries: IncomingDeliveryRecord[],
): string | null {
  const arrangedItems = deliveries
    .filter((delivery) => delivery.purchaseOrderId === order.id && delivery.status !== 'CANCELLED')
    .flatMap((delivery) => delivery.items)
  const remaining = order.items.map((item) =>
    remainingDeliveryQuantity(
      item.quantity,
      arrangedItems
        .filter((arranged) => arranged.purchaseOrderItemId === item.id)
        .map((arranged) => arranged.receivedQuantity),
    ),
  )
  return remaining.some((quantity) => quantity === null)
    ? null
    : sumDeliveryQuantities(remaining as string[])
}
