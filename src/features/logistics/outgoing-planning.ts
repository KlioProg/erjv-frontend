import { decimalString, parseOrderDecimal } from '@/lib/order-amounts'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { OutgoingPlanningOption } from './outgoing-deliveries.types'

export function outgoingPlanningMaximum(
  option?: OutgoingPlanningOption,
  limit?: string,
): string | null {
  const maximum = parseOrderDecimal(option?.maximumPlannableQuantity ?? '')
  const conflictLimit = parseOrderDecimal(limit ?? '')
  if (maximum === null) return null
  return decimalString(conflictLimit !== null && conflictLimit < maximum ? conflictLimit : maximum)
}

export function outgoingPlanningErrors(
  order: SalesOrderRecord,
  options: OutgoingPlanningOption[],
  quantities: Record<number, string>,
  limits: Record<number, string> = {},
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const [id, raw] of Object.entries(quantities)) {
    const quantity = parseOrderDecimal(raw || '0')
    const field = `quantity-${id}`
    const item = order.items.find((item) => item.id === Number(id))
    const option = options.find((option) => option.salesOrderItemId === Number(id))
    if (quantity === null) {
      errors[field] = 'Enter a nonnegative quantity with up to two decimal places.'
      continue
    }
    if (!item) {
      errors[field] =
        'This Sales Order line has changed. Review the current order before continuing.'
      continue
    }
    if (quantity === 0n) continue
    const maximum = parseOrderDecimal(outgoingPlanningMaximum(option, limits[item.id]) ?? '')
    if (!option || option.inventoryItemId !== item.inventoryItemId || maximum === null) {
      errors[field] = 'Planning availability is unavailable. Reload this order and warehouse.'
      continue
    }
    if (quantity > maximum)
      errors[field] =
        `Maximum plannable quantity is ${decimalString(maximum)}. Review this quantity.`
  }
  return errors
}

export function outgoingOrderRemaining(option?: OutgoingPlanningOption): string | null {
  if (!option) return null
  const remaining = parseOrderDecimal(option.remainingToPlanQuantity)
  return remaining === null ? null : decimalString(remaining)
}
