import type {
  OutgoingDeliveryRecord,
} from './outgoing-deliveries.types'
import type { ReconcileRunMemberPayload } from './delivery-runs.types'
import type { SalesOrderRecord } from '../crm/sales-orders.types'
import { formatProductUnit } from '@/lib/product-unit'
import { parseStockCents, formatStockCents } from './stock-display'

export const reconciliationFields = [
  'deliveredQuantity',
  'returnedSellableQuantity',
  'returnedDamagedQuantity',
  'missingQuantity',
] as const
export type ReconciliationField = (typeof reconciliationFields)[number]
export type ReconciliationDraft = Record<ReconciliationField, string> & {
  discrepancyReason: string
}
export type CompletionRow = { id: number; name: string; unit: string; loadedQuantity: string }
export const blankReconciliation = (): ReconciliationDraft => ({
  deliveredQuantity: '',
  returnedSellableQuantity: '',
  returnedDamagedQuantity: '',
  missingQuantity: '',
  discrepancyReason: '',
})

export function outgoingCompletionRows(
  delivery: OutgoingDeliveryRecord,
  order: SalesOrderRecord,
  products: { id: number; name: string; unit?: string }[],
) {
  if (
    order.id !== delivery.salesOrderId ||
    !Array.isArray(order.items) ||
    !Array.isArray(delivery.items) ||
    !delivery.items.length
  )
    return []
  const seen = new Set<number>()
  const rows: CompletionRow[] = []
  for (const item of delivery.items) {
    const loaded = parseStockCents(item.loadedQuantity)
    const orderLine = order.items.find((line) => line.id === item.salesOrderItemId)
    if (
      !Number.isSafeInteger(item.id) ||
      item.id <= 0 ||
      seen.has(item.id) ||
      !orderLine ||
      loaded === null ||
      loaded <= 0n
    )
      return []
    seen.add(item.id)
    const product = products.find((product) => product.id === orderLine.inventoryItemId)
    rows.push({
      id: item.id,
      name: product?.name ?? `Product #${orderLine.inventoryItemId}`,
      unit: formatProductUnit(product?.unit, 'units'),
      loadedQuantity: item.loadedQuantity!,
    })
  }
  return rows
}

export function validateOutgoingCompletion(
  rows: CompletionRow[],
  drafts: Record<number, ReconciliationDraft>,
) {
  const errors: Record<number, Partial<Record<keyof ReconciliationDraft, string>>> = {}
  const payload: Pick<ReconcileRunMemberPayload, 'items'> = { items: [] }
  for (const row of rows) {
    const draft = drafts[row.id] ?? blankReconciliation()
    const values = reconciliationFields.map((field) =>
      parseStockCents(draft[field].trim() || '0.00'),
    )
    const issue: Partial<Record<keyof ReconciliationDraft, string>> = {}
    reconciliationFields.forEach((field, index) => {
      if (values[index] === null || values[index]! > 999_999_999_999n)
        issue[field] = 'Enter a non-negative quantity with at most two decimal places.'
    })
    if (
      values.every((value) => value !== null) &&
      values.reduce<bigint>((sum, value) => sum + value!, 0n) !==
        parseStockCents(row.loadedQuantity)
    )
      issue.deliveredQuantity = `All four quantities must total the loaded ${formatStockCents(parseStockCents(row.loadedQuantity))} ${row.unit}.`
    const reason = draft.discrepancyReason.trim()
    if (((values[2] ?? 0n) > 0n || (values[3] ?? 0n) > 0n) && !reason)
      issue.discrepancyReason = 'Explain damaged or missing goods.'
    if (Object.keys(issue).length) errors[row.id] = issue
    else
      payload.items.push({
        outgoingDeliveryItemId: row.id,
        deliveredQuantity: draft.deliveredQuantity.trim() || '0.00',
        returnedSellableQuantity: draft.returnedSellableQuantity.trim() || '0.00',
        returnedDamagedQuantity: draft.returnedDamagedQuantity.trim() || '0.00',
        missingQuantity: draft.missingQuantity.trim() || '0.00',
        ...(reason ? { discrepancyReason: reason } : {}),
      })
  }
  return {
    payload,
    errors,
    error: Object.keys(errors).length
      ? 'Review the reconciliation counts below. Every loaded item must be fully accounted for.'
      : undefined,
  }
}
