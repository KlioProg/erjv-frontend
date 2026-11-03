import { decimalLimitError } from '@/lib/decimal-limits'
import { parseOrderDecimal } from '@/lib/order-amounts'
import {
  outcomeFields,
  type CreateTransfer,
  type TransferItem,
  type TransferOutcome,
} from './warehouse-transfers.types'

export function transferDraftErrors(draft: Partial<CreateTransfer>): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const key of ['sourceWarehouseId', 'destinationWarehouseId'] as const)
    if (draft[key] !== undefined && (!Number.isSafeInteger(draft[key]) || draft[key]! < 1))
      errors[key] = 'Choose a warehouse.'
  if (
    draft.sourceWarehouseId !== undefined &&
    draft.sourceWarehouseId === draft.destinationWarehouseId
  )
    errors.destinationWarehouseId = 'Choose a different destination warehouse.'
  if (draft.items !== undefined) {
    if (draft.items.length < 1 || draft.items.length > 100)
      errors.items = 'Include 1–100 unique items.'
    const seen = new Set<number>()
    draft.items.forEach((item, index) => {
      if (
        !Number.isSafeInteger(item.inventoryItemId) ||
        item.inventoryItemId < 1 ||
        seen.has(item.inventoryItemId)
      )
        errors[`items.${index}.inventoryItemId`] = 'Choose a unique inventory item.'
      seen.add(item.inventoryItemId)
      const error = decimalLimitError(item.quantity, true)
      if (error) errors[`items.${index}.quantity`] = error
    })
  }
  if (
    draft.scheduledDepartureAt != null &&
    (!/(Z|[+-]\d{2}:\d{2})$/.test(draft.scheduledDepartureAt) ||
      !Number.isFinite(Date.parse(draft.scheduledDepartureAt)))
  )
    errors.scheduledDepartureAt = 'Choose a valid departure date and time.'
  return errors
}

export function transferReconciliationErrors(lines: TransferItem[], outcomes: TransferOutcome[]) {
  const errors: Record<string, string> = {}
  if (
    outcomes.length !== lines.length ||
    new Set(outcomes.map((item) => item.warehouseTransferItemId)).size !== lines.length
  )
    errors.items = 'Include every saved transfer line exactly once.'
  outcomes.forEach((item, index) => {
    const line = lines.find((line) => line.id === item.warehouseTransferItemId)
    if (!line) {
      errors.items = 'Include only saved transfer line IDs.'
      return
    }
    const values = outcomeFields.map((field) => parseOrderDecimal(item[field]))
    outcomeFields.forEach((field) => {
      const error = decimalLimitError(item[field])
      if (error) errors[`items.${index}.${field}`] = error
    })
    if (values.some((value) => value === null)) return
    const [received, damaged, sellable, returnedDamage, missing] = values as bigint[]
    if (received + sellable + returnedDamage + missing !== parseOrderDecimal(line.quantity))
      errors[`items.${index}.balance`] =
        'Received, returns and missing must equal the sent quantity. Damage is already included in received.'
    if (damaged > received)
      errors[`items.${index}.damagedQuantity`] = 'Damage cannot exceed received quantity.'
    if (damaged + sellable + returnedDamage + missing > 0n && !item.discrepancyReason?.trim())
      errors[`items.${index}.discrepancyReason`] = 'Explain the damage, return or missing quantity.'
  })
  return errors
}
