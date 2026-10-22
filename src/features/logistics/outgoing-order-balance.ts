import type { SalesOrderRecord } from '../crm/sales-orders.types'
import type {
  OutgoingDeliveryRecord,
  OutgoingDeliveryLineCommand,
} from './outgoing-deliveries.types'
import type { StockItem } from './stock-items.types'
import type { Warehouse } from './warehouses.types'
import { remainingDeliveryQuantity, sumDeliveryQuantities } from './delivery-quantities.ts'
import { availableStock, decimalString, parseOrderDecimal } from '../../lib/order-amounts.ts'

export function canPrepareOutgoing(order: Pick<SalesOrderRecord, 'status'>) {
  return order.status === 'CONFIRMED' || order.status === 'PARTIALLY_DELIVERED'
}

export type OutgoingSourceBalance = {
  stock: StockItem
  warehouse: Warehouse
  remaining: string | null
}

export function outgoingOrderBalances(
  order: SalesOrderRecord,
  deliveries: OutgoingDeliveryRecord[],
  stocks: StockItem[],
  warehouses: Warehouse[],
) {
  const arranged = deliveries
    .filter((delivery) => delivery.salesOrderId === order.id && delivery.status !== 'CANCELLED')
    .flatMap((delivery) => delivery.items)
  return order.items.map((item) => {
    const itemLines = arranged.filter((line) => line.salesOrderItemId === item.id)
    const quantities = itemLines.map((line) => line.quantity)
    const committed = sumDeliveryQuantities(quantities)
    const remaining = remainingDeliveryQuantity(item.quantity, quantities)
    const sources: OutgoingSourceBalance[] = stocks
      .filter((stock) => stock.inventoryItemId === item.inventoryItemId)
      .flatMap((stock) => {
        const warehouse = warehouses.find(
          (candidate) => candidate.id === stock.warehouseId && candidate.isActive,
        )
        if (!warehouse) return []
        const available = availableStock(stock)
        const orderRemaining = remaining === null ? null : parseOrderDecimal(remaining)
        return [{
          stock,
          warehouse,
          remaining:
            orderRemaining === null
              ? null
              : decimalString(available < orderRemaining ? available : orderRemaining),
        }]
      })
    return { item, committed, remaining, sources }
  })
}

export type OutgoingItemBalance = ReturnType<typeof outgoingOrderBalances>[number]

export function remainingOutgoingItemCount(balances: OutgoingItemBalance[]) {
  return balances.filter(
    (balance) => balance.remaining !== null && (parseOrderDecimal(balance.remaining) ?? 0n) > 0n,
  ).length
}

export function outgoingLinesForSources(
  balance: OutgoingItemBalance,
  selected: Array<{ stockItemId: number; quantity: string }>,
): OutgoingDeliveryLineCommand[] {
  const total = selected.reduce(
    (sum, line) => sum + (parseOrderDecimal(line.quantity) ?? 0n),
    0n,
  )
  const orderRemaining = balance.remaining === null ? null : parseOrderDecimal(balance.remaining)
  if (orderRemaining === null || total > orderRemaining)
    throw new Error('Shipment quantity exceeds the remaining sales order quantity.')

  const seen = new Set<number>()
  return selected.map(({ stockItemId, quantity }) => {
    const source = balance.sources.find(({ stock }) => stock.id === stockItemId)
    const parsed = parseOrderDecimal(quantity)
    const capacity = source?.remaining === null ? null : parseOrderDecimal(source?.remaining ?? '')
    if (!source || parsed === null || parsed <= 0n || capacity === null || parsed > capacity)
      throw new Error('A selected stock source is no longer available at the requested quantity.')
    if (seen.has(stockItemId))
      throw new Error('Choose each stock source only once per order item.')
    seen.add(stockItemId)
    return {
      salesOrderItemId: balance.item.id,
      stockItemId,
      quantity: decimalString(parsed),
    }
  })
}

export function outgoingLinesForAvailableSources(
  balance: OutgoingItemBalance,
): OutgoingDeliveryLineCommand[] {
  let pending = balance.remaining === null ? 0n : parseOrderDecimal(balance.remaining) ?? 0n
  const lines: OutgoingDeliveryLineCommand[] = []
  for (const source of balance.sources) {
    if (pending <= 0n || source.remaining === null) continue
    const capacity = parseOrderDecimal(source.remaining)
    if (capacity === null || capacity <= 0n) continue
    const quantity = capacity < pending ? capacity : pending
    lines.push({
      salesOrderItemId: balance.item.id,
      stockItemId: source.stock.id,
      quantity: decimalString(quantity),
    })
    pending -= quantity
  }
  return lines
}
