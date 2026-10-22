import type { SalesOrderRecord } from '../crm/sales-orders.types'
import type {
  OutgoingDeliveryRecord,
  OutgoingDeliveryLineCommand,
} from './outgoing-deliveries.types'
import type { StockItem } from './stock-items.types'
import type { Warehouse } from './warehouses.types'
import { remainingDeliveryQuantity, sumDeliveryQuantities } from './delivery-quantities.ts'
import { decimalString, parseOrderDecimal } from '../../lib/order-amounts.ts'

export function canPrepareOutgoing(order: Pick<SalesOrderRecord, 'status'>) {
  return order.status === 'CONFIRMED' || order.status === 'PARTIALLY_DELIVERED'
}

/** The backend counts every delivery except CANCELLED, including saved drafts. */
export function outgoingOrderBalances(
  order: SalesOrderRecord,
  deliveries: OutgoingDeliveryRecord[],
) {
  const arranged = deliveries
    .filter((delivery) => delivery.salesOrderId === order.id && delivery.status !== 'CANCELLED')
    .flatMap((delivery) => delivery.items)
  return order.items.map((item) => {
    const ids = new Set(item.allocations.map((allocation) => allocation.id))
    const quantities = arranged
      .filter((line) => ids.has(line.salesOrderAllocationId))
      .map((line) => line.quantity)
    return {
      item,
      committed: sumDeliveryQuantities(quantities),
      remaining: remainingDeliveryQuantity(item.quantity, quantities),
      sources: item.allocations.map((allocation) => ({
        allocation,
        remaining: allocation.releasedAt
          ? null
          : remainingDeliveryQuantity(
              allocation.quantity,
              arranged
                .filter((line) => line.salesOrderAllocationId === allocation.id)
                .map((line) => line.quantity),
            ),
      })),
    }
  })
}

export type OutgoingItemBalance = ReturnType<typeof outgoingOrderBalances>[number]

export function remainingOutgoingItemCount(balances: OutgoingItemBalance[]) {
  return balances.filter(
    (balance) => balance.remaining !== null && (parseOrderDecimal(balance.remaining) ?? 0n) > 0n,
  ).length
}

/** Confirmed-order reservations already include these sources: do not deduct them again. */
export function outgoingSourceCapacity(
  balance: OutgoingItemBalance,
  warehouseId: number,
  stocks: StockItem[],
  warehouses: Warehouse[],
) {
  if (!warehouses.some((warehouse) => warehouse.id === warehouseId && warehouse.isActive))
    return null
  const sources = balance.sources.filter(({ allocation }) =>
    stocks.some(
      (stock) =>
        stock.id === allocation.stockItemId &&
        stock.warehouseId === warehouseId &&
        stock.inventoryItemId === balance.item.inventoryItemId,
    ),
  )
  let capacity = 0n
  for (const source of sources) {
    const stock = stocks.find((record) => record.id === source.allocation.stockItemId)!
    const remaining = source.remaining === null ? null : parseOrderDecimal(source.remaining)
    const physical = parseOrderDecimal(stock.quantity)
    if (remaining === null || physical === null) return null
    capacity += remaining < physical ? remaining : physical
  }
  const orderRemaining = balance.remaining === null ? null : parseOrderDecimal(balance.remaining)
  return orderRemaining === null
    ? null
    : decimalString(capacity < orderRemaining ? capacity : orderRemaining)
}

/** Uses only persisted allocation IDs within this delivery's one selected warehouse. */
export function outgoingLinesForQuantity(
  balance: OutgoingItemBalance,
  warehouseId: number,
  quantity: string,
  stocks: StockItem[],
): OutgoingDeliveryLineCommand[] {
  let pending = parseOrderDecimal(quantity) ?? 0n
  const lines: OutgoingDeliveryLineCommand[] = []
  for (const source of [...balance.sources].sort((a, b) => a.allocation.id - b.allocation.id)) {
    const stock = stocks.find(
      (record) =>
        record.id === source.allocation.stockItemId &&
        record.warehouseId === warehouseId &&
        record.inventoryItemId === balance.item.inventoryItemId,
    )
    const remaining = source.remaining === null ? null : parseOrderDecimal(source.remaining)
    const physical = stock ? parseOrderDecimal(stock.quantity) : null
    if (!stock || remaining === null || physical === null || pending === 0n) continue
    const capacity = remaining < physical ? remaining : physical
    const take = pending < capacity ? pending : capacity
    if (take > 0n)
      lines.push({ salesOrderAllocationId: source.allocation.id, quantity: decimalString(take) })
    pending -= take
  }
  if (pending > 0n)
    throw new Error(
      'The selected warehouse no longer has enough allocated stock. Review the refreshed quantities.',
    )
  return lines
}
