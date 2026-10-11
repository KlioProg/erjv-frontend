import type { OrderFormValues } from './sales-order-entry.types'
import type { CreateSalesOrderPayload } from './sales-orders.types'

export function buildSalesOrderPayload(values: OrderFormValues): CreateSalesOrderPayload {
  return {
    clientId: values.clientId,
    deliveryAddress: values.deliveryAddress,
    expectedAt: values.expectedAt,
    externalReference: values.externalReference,
    notes: values.notes,
    items: values.lines.map((line) => ({
      inventoryItemId: line.productId,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountRate: values.discountRate,
      taxRate: values.taxRate,
      ...(line.allocations?.length
        ? {
            allocations: line.allocations.map(({ stockItemId, quantity }) => ({
              stockItemId: stockItemId!,
              quantity,
            })),
          }
        : {}),
    })),
  }
}
