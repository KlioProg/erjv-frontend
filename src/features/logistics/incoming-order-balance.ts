import type { PurchaseOrderRecord } from './purchase-orders.types'
import type { IncomingDeliveryRecord } from './incoming-deliveries.types'
import { purchaseReceivingProgress } from './purchase-orders.presentation.ts'
import { decimalString } from '../../lib/order-amounts.ts'

/** Header-only drafts and schedules do not consume goods; completed accepted stock does. */
export function incomingOrderRemainingQuantity(
  order: Pick<PurchaseOrderRecord, 'id' | 'items'>,
  deliveries: IncomingDeliveryRecord[],
): string | null {
  const progress = purchaseReceivingProgress(order, deliveries)
  return progress.some((line) => line.remaining === null)
    ? null
    : decimalString(progress.reduce((sum, line) => sum + line.remaining!, 0n))
}
