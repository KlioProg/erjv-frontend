import type { PurchaseOrderRecord } from './purchase-orders.types'
import type {
  IncomingDeliveryRecord,
  CompleteIncomingDeliveryPayload,
} from './incoming-deliveries.types'
import { parseStockCents } from './stock-display'
import { decimalString } from './purchase-pricing'

export type IncomingReceiptCounts = Record<number, { received: string; damaged: string }>

/** Only persisted accepted quantities establish how much good stock is still outstanding. */
export function incomingReceiptLines(
  order: Pick<PurchaseOrderRecord, 'id' | 'items'>,
  receipts: IncomingDeliveryRecord[],
  deliveryId: number,
) {
  const totals = new Map<number, bigint>()
  const itemIds = new Set<number>()
  const receiptIds = new Set<number>()
  const orderItems = Array.isArray(order.items) ? order.items : []
  const knownLines = new Set(orderItems.map((item) => item.id))
  let available = knownLines.size === orderItems.length
  for (const receipt of receipts) {
    if (
      receipt.id === deliveryId ||
      receipt.purchaseOrderId !== order.id ||
      receipt.status !== 'COMPLETED'
    )
      continue
    if (!Array.isArray(receipt.items) || receiptIds.has(receipt.id)) {
      available = false
      break
    }
    receiptIds.add(receipt.id)
    for (const item of receipt.items) {
      const accepted = parseStockCents(item.acceptedQuantity)
      if (
        accepted === null ||
        !knownLines.has(item.purchaseOrderItemId) ||
        !Number.isSafeInteger(item.id) ||
        itemIds.has(item.id)
      ) {
        available = false
        break
      }
      itemIds.add(item.id)
      totals.set(item.purchaseOrderItemId, (totals.get(item.purchaseOrderItemId) ?? 0n) + accepted)
    }
  }
  return orderItems.map((item) => {
    const ordered = parseStockCents(item.quantity)
    const accepted = totals.get(item.id) ?? 0n
    return {
      item,
      outstanding: available && ordered !== null && accepted <= ordered ? ordered - accepted : null,
    }
  })
}

export function validateIncomingReceipt(
  lines: ReturnType<typeof incomingReceiptLines>,
  counts: IncomingReceiptCounts,
) {
  const items: CompleteIncomingDeliveryPayload['items'] = []
  const errors: Record<number, { received?: string; damaged?: string }> = {}
  for (const { item, outstanding } of lines) {
    const received = parseStockCents(counts[item.id]?.received.trim() || '0')
    const damaged = parseStockCents(counts[item.id]?.damaged.trim() || '0')
    const issues: { received?: string; damaged?: string } = {}
    if (received === null) issues.received = 'Use a nonnegative quantity with up to two decimals.'
    if (damaged === null) issues.damaged = 'Use a nonnegative quantity with up to two decimals.'
    else if (received !== null && damaged > received)
      issues.damaged = 'Damaged goods cannot exceed received goods.'
    if (received !== null && damaged !== null && received > 0n && damaged <= received) {
      if (outstanding === null)
        issues.received = 'The outstanding quantity is unavailable. Reload current receipts.'
      else if (received - damaged > outstanding)
        issues.received = 'Accepted goods exceed the remaining purchase order quantity.'
      if (
        !Number.isSafeInteger(item.id) ||
        item.id <= 0 ||
        items.some((line) => line.purchaseOrderItemId === item.id)
      )
        issues.received = 'Purchase order products are unavailable or repeated. Close and reload.'
      if (!Object.keys(issues).length)
        items.push({
          purchaseOrderItemId: item.id,
          receivedQuantity: decimalString(received),
          damagedQuantity: decimalString(damaged),
        })
    }
    if (Object.keys(issues).length) errors[item.id] = issues
  }
  return { items, errors }
}
