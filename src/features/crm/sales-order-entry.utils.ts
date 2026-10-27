import type { OrderFormValues, SalesOrderFormLine } from './sales-order-entry.types'
import type {
  CreateSalesOrderPayload,
  SalesOrderRecord,
  UpdateSalesOrderDraftPayload,
} from './sales-orders.types'
import type { InventoryItemResponse } from '../products/products.types'
import { parseOrderDecimal } from '../../lib/order-amounts.ts'
import { discountFields, savedLineDiscount } from '../../lib/order-line-pricing.ts'

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
      ...discountFields(
        line.discount ??
          savedLineDiscount(
            line.terms ?? {
              discountRate: values.discountRate ?? '0.00',
              discountAmount: '0.00',
            },
          ),
      ),
      taxRate: line.taxRate ?? line.terms?.taxRate ?? values.taxRate,
      ...(line.terms?.notes !== undefined ? { notes: line.terms.notes } : {}),
    })),
  }
}

export function salesDraftLines(
  order: SalesOrderRecord,
  products: InventoryItemResponse[],
): SalesOrderFormLine[] {
  return order.items.map((item, index) => {
    const product = products.find((candidate) => candidate.id === item.inventoryItemId)
    return {
      formId: index + 1,
      productId: item.inventoryItemId,
      name: product?.name ?? `Product #${item.inventoryItemId}`,
      variety: product?.variety,
      unit: product?.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: savedLineDiscount(item),
      taxRate: item.taxRate,
      terms: {
        discountRate: item.discountRate,
        discountAmount: item.discountAmount,
        taxRate: item.taxRate,
        notes: item.notes,
      },
    }
  })
}

export function buildSalesOrderDraftPayload(
  order: SalesOrderRecord,
  values: OrderFormValues,
): UpdateSalesOrderDraftPayload {
  const payload: UpdateSalesOrderDraftPayload = { expectedRevision: order.revision }
  if (values.clientId !== order.clientId) payload.clientId = values.clientId
  if (values.deliveryAddress !== order.deliveryAddress)
    payload.deliveryAddress = values.deliveryAddress
  if ((values.expectedAt?.slice(0, 10) ?? '') !== (order.expectedAt?.slice(0, 10) ?? ''))
    payload.expectedAt = values.expectedAt || null
  if ((values.externalReference ?? '') !== (order.externalReference ?? ''))
    payload.externalReference = values.externalReference || null
  if ((values.notes ?? '') !== (order.notes ?? '')) payload.notes = values.notes || null
  const items = buildSalesOrderPayload(values).items
  const itemsChanged =
    values.lines.length !== order.items.length ||
    values.lines.some((line, index) => {
      const saved = order.items[index]
      return (
        !saved ||
        line.productId !== saved.inventoryItemId ||
        parseOrderDecimal(line.quantity) !== parseOrderDecimal(saved.quantity) ||
        parseOrderDecimal(line.unitPrice) !== parseOrderDecimal(saved.unitPrice) ||
        items[index].notes !== saved.notes ||
        items[index].discountRate !== discountFields(savedLineDiscount(saved)).discountRate ||
        items[index].discountAmount !== discountFields(savedLineDiscount(saved)).discountAmount ||
        items[index].taxRate !== saved.taxRate
      )
    })
  if (itemsChanged) {
    payload.items = items
  }
  return payload
}
