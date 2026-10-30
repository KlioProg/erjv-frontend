import type { SalesOrderRecord } from '../crm/sales-orders.types'
import type {
  OutgoingDeliveryRecord,
} from './outgoing-deliveries.types'
import type { RunLoad } from './delivery-runs.types'
import type { StockItemWithInventoryItem } from './stock-items.types'
import { formatStockCents, parseStockCents } from './stock-display'
import { formatProductUnit } from '@/lib/product-unit'

export type DispatchPlanRow = {
  salesOrderItemId: number
  stockItemId: number
  productName: string
  unit: string
  plannedQuantity: string
  availableQuantity: string
}

/** Resolve every plan line against the current order and the saved source warehouse. */
export function buildDispatchPlan(
  delivery: OutgoingDeliveryRecord,
  order: SalesOrderRecord,
  stocks: StockItemWithInventoryItem[],
): { rows: DispatchPlanRow[]; error?: string } {
  const unavailable = {
    rows: [],
    error:
      'The saved plan could not be matched to current order lines and warehouse stock. Refresh the shipment before dispatching.',
  }
  if (
    order.id !== delivery.salesOrderId ||
    !Array.isArray(order.items) ||
    !Array.isArray(delivery.plannedItems) ||
    delivery.plannedItems.length === 0
  )
    return unavailable
  const rows: DispatchPlanRow[] = []
  const seen = new Set<number>()
  for (const plan of delivery.plannedItems) {
    const orderLines = order.items.filter((line) => line.id === plan.salesOrderItemId)
    const quantity = parseStockCents(plan.plannedQuantity)
    if (
      orderLines.length !== 1 ||
      orderLines[0].salesOrderId !== order.id ||
      seen.has(plan.salesOrderItemId) ||
      quantity === null ||
      quantity <= 0n
    )
      return unavailable
    seen.add(plan.salesOrderItemId)
    const matches = stocks.filter(
      (stock) =>
        stock.warehouseId === delivery.warehouseId &&
        stock.inventoryItemId === orderLines[0].inventoryItemId,
    )
    if (
      matches.length !== 1 ||
      !Number.isSafeInteger(matches[0].id) ||
      matches[0].id <= 0 ||
      matches[0].inventoryItem?.id !== orderLines[0].inventoryItemId ||
      parseStockCents(matches[0].availableQuantity) === null
    )
      return unavailable
    const stock = matches[0]
    rows.push({
      salesOrderItemId: plan.salesOrderItemId,
      stockItemId: stock.id,
      productName: stock.inventoryItem.name,
      unit: formatProductUnit(stock.inventoryItem.unit, 'units'),
      plannedQuantity: plan.plannedQuantity,
      availableQuantity: stock.availableQuantity!,
    })
  }
  return { rows }
}

export function validateDispatchLoad(rows: DispatchPlanRow[], values: Record<number, string>) {
  const errors: Record<number, string> = {}
  const items: RunLoad['items'] = []
  const totals = new Map<number, bigint>()
  for (const row of rows) {
    const raw = (values[row.salesOrderItemId] ?? '').trim()
    const loaded = raw ? parseStockCents(raw) : 0n
    if (loaded === null) {
      errors[row.salesOrderItemId] =
        'Enter zero or a positive quantity with up to two decimal places.'
    } else if (loaded > parseStockCents(row.plannedQuantity)!) {
      errors[row.salesOrderItemId] =
        `Loaded quantity exceeds the planned ${formatStockCents(parseStockCents(row.plannedQuantity))} ${row.unit}.`
    } else if (loaded > 0n) {
      items.push({
        salesOrderItemId: row.salesOrderItemId,
        stockItemId: row.stockItemId,
        loadedQuantity: raw,
      })
      totals.set(row.stockItemId, (totals.get(row.stockItemId) ?? 0n) + loaded)
    }
  }
  for (const row of rows) {
    if ((totals.get(row.stockItemId) ?? 0n) > parseStockCents(row.availableQuantity)!)
      errors[row.salesOrderItemId] =
        `Loaded quantities exceed the available ${formatStockCents(parseStockCents(row.availableQuantity))} ${row.unit} at this warehouse.`
  }
  return {
    items,
    errors,
    error: Object.keys(errors).length
      ? 'Review the actual loaded quantities below.'
      : items.length === 0
        ? 'Enter at least one positive actual loaded quantity. Leave other lines blank or enter zero to skip them.'
        : undefined,
  }
}
