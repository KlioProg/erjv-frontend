import type { PurchaseOrderRecord } from './purchase-orders.types'
import type {
  CompleteIncomingDeliveryPayload,
  IncomingDeliveryRecord,
} from './incoming-deliveries.types'
import { purchaseReceivingProgress } from './purchase-orders.presentation'
import { parseStockCents, formatStockCents } from './stock-display'
import { decimalString } from '@/lib/order-amounts'
import { formatProductUnit } from '@/lib/product-unit'

export type ReceiptRow = {
  id: number
  name: string
  unit: string
  ordered: string
  previouslyReceived: string | null
  outstanding: string | null
}
export type ReceiptDraft = { received: string; damaged: string }

export function incomingReceiptRows(
  order: PurchaseOrderRecord,
  history: IncomingDeliveryRecord[],
  products: { id: number; name: string; unit?: string }[],
): ReceiptRow[] {
  if (!Array.isArray(order.items)) return []
  const progress = purchaseReceivingProgress(order, history)
  return progress.map(({ item, remaining }) => {
    const receipts = history
      .filter(
        (delivery) => delivery.purchaseOrderId === order.id && delivery.status === 'COMPLETED',
      )
      .flatMap((delivery) => delivery.items ?? [])
      .filter((line) => line.purchaseOrderItemId === item.id)
    const actual = receipts.map((receipt) => parseStockCents(receipt.receivedQuantity))
    const product = products.find((product) => product.id === item.inventoryItemId)
    return {
      id: item.id,
      name: product?.name ?? `Product #${item.inventoryItemId}`,
      unit: formatProductUnit(product?.unit, 'units'),
      ordered: item.quantity,
      previouslyReceived: actual.some((value) => value === null)
        ? null
        : decimalString(actual.reduce<bigint>((sum, value) => sum + value!, 0n)),
      outstanding: remaining === null ? null : decimalString(remaining),
    }
  })
}

export function validateIncomingReceipt(
  rows: ReceiptRow[],
  drafts: Record<number, ReceiptDraft>,
  noReceipt: boolean,
  reason: string,
) {
  const errors: Record<number, { received?: string; damaged?: string }> = {}
  const payload: CompleteIncomingDeliveryPayload = { items: [] }
  if (noReceipt)
    return {
      payload: { items: [], noReceiptReason: reason.trim() },
      errors,
      error: reason.trim() ? undefined : 'Explain why no goods were received.',
    }
  for (const row of rows) {
    const draft = drafts[row.id]
    const raw = draft?.received.trim() ?? ''
    const damagedRaw = draft?.damaged.trim() ?? ''
    const received = raw ? parseStockCents(raw) : 0n
    const damaged = damagedRaw ? parseStockCents(damagedRaw) : 0n
    const outstanding = parseStockCents(row.outstanding)
    const issue: { received?: string; damaged?: string } = {}
    if (received === null || received > 999_999_999_999n)
      issue.received =
        'Enter a non-negative quantity up to 9,999,999,999.99 with at most two decimal places.'
    if (damaged === null || damaged > 999_999_999_999n)
      issue.damaged = 'Enter a non-negative damaged quantity with at most two decimal places.'
    if (received !== null && damaged !== null && damaged > received)
      issue.damaged = 'Damaged quantity cannot exceed the quantity received now.'
    if (outstanding === null)
      issue.received = 'The outstanding balance is unavailable. Refresh this delivery.'
    else if (received !== null && damaged !== null && received - damaged > outstanding)
      issue.received = `The good quantity (received minus damaged) exceeds the outstanding ${formatStockCents(outstanding)} ${row.unit}.`
    if (Object.keys(issue).length) errors[row.id] = issue
    else if (received !== null && received > 0n)
      payload.items.push({
        purchaseOrderItemId: row.id,
        receivedQuantity: raw,
        damagedQuantity: damagedRaw || '0.00',
      })
  }
  return {
    payload,
    errors,
    error: Object.keys(errors).length
      ? 'Review the receipt quantities below.'
      : payload.items.length === 0
        ? 'Enter at least one received quantity, or select “No goods received” and provide a reason.'
        : undefined,
  }
}
