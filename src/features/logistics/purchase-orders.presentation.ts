import type {
  PurchaseOrderItemRecord,
  PurchaseOrderRecord,
  PurchaseOrderStatus,
} from './purchase-orders.types'
import type { IncomingDeliveryRecord } from './incoming-deliveries.types'
import { formatStockCents, parseStockCents } from './stock-display.ts'
import type { LifecycleMilestone } from '../../components/ui/LifecycleProgress'
import type { StatusBadgeTone } from '../../components/ui/StatusBadge'

/** Purchase receipt state is independent of the customer-delivery lifecycle. */
export function getPurchaseOrderProgressDisplay(
  order: Pick<PurchaseOrderRecord, 'id' | 'status'>,
  deliveries: IncomingDeliveryRecord[],
  complete = true,
): { label: string; tone: StatusBadgeTone; explanation: string; milestones: LifecycleMilestone[] } {
  if (order.status === 'CANCELLED')
    return {
      label: 'Cancelled',
      tone: 'neutral',
      explanation:
        'This purchase order was cancelled. Its saved items remain available for review.',
      milestones: [{ id: 'cancelled', label: 'Cancelled', state: 'cancelled' }],
    }
  if (order.status === 'PARTIALLY_RECEIVED')
    return {
      label: 'Partially Received',
      tone: 'progress',
      explanation:
        'Some goods have been accepted. Review the remaining quantities and any damaged goods before scheduling another arrival.',
      milestones: [],
    }
  let label = 'Confirmed'
  let tone: StatusBadgeTone = 'info'
  let stage = 1
  let explanation = complete
    ? 'Schedule an arrival when the supplier delivery is arranged.'
    : 'Receipt progress is unavailable. Refresh the related incoming deliveries to review it.'
  if (order.status === 'DRAFT') {
    label = 'Draft'
    tone = 'neutral'
    stage = 0
    explanation = 'Review the supplier and ordered items before confirming.'
  } else if (order.status === 'RECEIVED') {
    label = 'Received'
    tone = 'success'
    stage = 3
    explanation =
      'This order is received. Actual accepted and damaged quantities remain available below.'
  } else if (
    complete &&
    deliveries.some(
      (record) => record.purchaseOrderId === order.id && record.status === 'SCHEDULED',
    )
  ) {
    label = 'Arrival Scheduled'
    stage = 2
    explanation = 'Arrival is scheduled. Return to Receive Goods when the supplier arrives.'
  }
  const labels = ['Draft', 'Confirmed', 'Arrival Scheduled', 'Received']
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

/** Details track receipt activity; scheduling remains context, not a receipt milestone. */
export function getPurchaseOrderDetailProgress(
  order: Pick<PurchaseOrderRecord, 'id' | 'status'>,
  deliveries: IncomingDeliveryRecord[],
  complete = true,
): ReturnType<typeof getPurchaseOrderProgressDisplay> {
  const saved = getPurchaseOrderProgressDisplay(order, [], complete)
  if (order.status === 'CANCELLED') return saved
  const linked = deliveries.filter((delivery) => delivery.purchaseOrderId === order.id)
  const scheduled = complete && linked.some((delivery) => delivery.status === 'SCHEDULED')
  const recorded =
    complete &&
    linked.some(
      (delivery) =>
        delivery.status === 'COMPLETED' &&
      Array.isArray(delivery.items) &&
      delivery.items.some((item) => (parseStockCents(item.receivedQuantity) ?? 0n) > 0n),
    )
  const receiving = order.status === 'PARTIALLY_RECEIVED' || recorded
  const stage = order.status === 'DRAFT' ? 0 : order.status === 'RECEIVED' ? 3 : receiving ? 2 : 1
  let explanation = saved.explanation
  if (order.status === 'RECEIVED') explanation = 'All ordered goods have been received.'
  else if (order.status !== 'DRAFT') {
    explanation = !complete
      ? 'Receiving details are unavailable. Review incoming deliveries before continuing.'
      : receiving
        ? 'Receiving has started. Review the remaining quantities below.'
        : 'No goods have been recorded as received.'
    if (scheduled) explanation += ' An arrival is scheduled.'
  }
  const labels =
    !complete && stage === 1
      ? ['Draft', 'Confirmed']
      : ['Draft', 'Confirmed', 'Receiving', 'Received']
  return {
    ...saved,
    explanation,
    milestones: labels.map((label, index) => ({
      id: String(index),
      label,
      state: stage === 3 || index < stage ? 'complete' : index === stage ? 'current' : 'upcoming',
    })),
  }
}

export const PURCHASE_ORDER_STATUS = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  CONFIRMED: { label: 'Confirmed', tone: 'info' },
  PARTIALLY_RECEIVED: { label: 'Partially Received', tone: 'progress' },
  RECEIVED: { label: 'Received', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'destructive' },
} as const

export function purchaseOrderActions(
  status: PurchaseOrderStatus,
  canManage: boolean,
  itemCount: number,
) {
  return {
    confirm: canManage && status === 'DRAFT' && itemCount > 0,
    cancel: canManage && (status === 'DRAFT' || status === 'CONFIRMED'),
  }
}

export function purchaseOrderDate(value: string | null): string {
  if (!value) return 'Not set'
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function purchaseMaterialsSummary(
  items: PurchaseOrderItemRecord[],
  names: Map<number, string>,
) {
  const materials = items.map(
    (item) =>
      `${names.get(item.inventoryItemId) ?? `Product #${item.inventoryItemId}`} (${formatStockCents(parseStockCents(item.quantity))})`,
  )
  return {
    preview: materials.slice(0, 2).join(', ') || 'No items listed',
    full: materials.join(', ') || 'No items listed',
    more: Math.max(0, materials.length - 2),
  }
}

/** Only backend-accepted goods count toward PO fulfillment; damage stays quarantined. */
export function purchaseReceivingProgress(
  order: Pick<PurchaseOrderRecord, 'id' | 'items'>,
  deliveries: IncomingDeliveryRecord[],
) {
  const received = new Map(order.items.map((item) => [item.id, 0n]))
  const seen = new Set<number>()
  let available = true
  for (const delivery of deliveries) {
    if (delivery.purchaseOrderId !== order.id || delivery.status !== 'COMPLETED') continue
    if (!Array.isArray(delivery.items)) {
      available = false
      break
    }
    for (const item of delivery.items) {
      const quantity = parseStockCents(item.acceptedQuantity)
      if (quantity === null || !received.has(item.purchaseOrderItemId) || seen.has(item.id)) {
        available = false
        break
      }
      seen.add(item.id)
      received.set(item.purchaseOrderItemId, received.get(item.purchaseOrderItemId)! + quantity)
    }
  }
  return order.items.map((item) => {
    const ordered = parseStockCents(item.quantity)
    const actual = available ? received.get(item.id)! : null
    return {
      item,
      ordered,
      received: actual,
      remaining: ordered !== null && actual !== null && actual <= ordered ? ordered - actual : null,
    }
  })
}
