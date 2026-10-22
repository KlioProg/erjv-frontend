import type {
  PurchaseOrderItemRecord,
  PurchaseOrderRecord,
  PurchaseOrderStatus,
} from './purchase-orders.types'
import type { IncomingDeliveryRecord } from './incoming-deliveries.types'
import { formatStockCents, parseStockCents } from './stock-display.ts'

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

/** Only completed incoming transactions represent physically received stock. */
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
      const quantity = parseStockCents(item.receivedQuantity)
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
