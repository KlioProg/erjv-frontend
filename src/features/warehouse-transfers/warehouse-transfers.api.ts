import { apiClient, requireRevision } from '@/lib/api-client'
import { parseOrderDecimal } from '@/lib/order-amounts'
import { decimalLimitError, requireDecimalLimit } from '@/lib/decimal-limits'
import {
  outcomeFields,
  type TransferCommand,
  type WarehouseTransfer,
} from './warehouse-transfers.types'
import { transferDraftErrors } from './warehouse-transfers.validation'

export function validateTransfer(data: WarehouseTransfer): WarehouseTransfer {
  const id = (value: number) => Number.isSafeInteger(value) && value > 0
  if (
    !data ||
    !id(data.id) ||
    !id(data.revision) ||
    !id(data.sourceWarehouseId) ||
    !id(data.destinationWarehouseId) ||
    data.sourceWarehouseId === data.destinationWarehouseId ||
    typeof data.transferNumber !== 'string' ||
    !['DRAFT', 'DISPATCHED', 'COMPLETED', 'CANCELLED'].includes(data.status) ||
    !(data.notes === null || typeof data.notes === 'string') ||
    !(
      data.scheduledDepartureAt === null ||
      (typeof data.scheduledDepartureAt === 'string' &&
        Number.isFinite(Date.parse(data.scheduledDepartureAt)))
    ) ||
    !Array.isArray(data.items) ||
    !data.items.length ||
    data.items.length > 100 ||
    new Set(data.items.map((item) => item.id)).size !== data.items.length ||
    new Set(data.items.map((item) => item.inventoryItemId)).size !== data.items.length ||
    data.items.some(
      (item) =>
        !id(item.id) ||
        !id(item.inventoryItemId) ||
        item.warehouseTransferId !== data.id ||
        !!decimalLimitError(item.quantity, true) ||
        outcomeFields.some((field) =>
          data.status === 'COMPLETED'
            ? typeof item[field] !== 'string' || parseOrderDecimal(item[field]!) === null
            : item[field] !== null,
        ),
    )
  )
    throw Error(
      'The server returned an incomplete transfer. Reload and review the saved transfer before continuing.',
    )
  return data
}

export async function fetchTransfer(id: number, signal?: AbortSignal) {
  requireRevision(id)
  const { data } = await apiClient.get<WarehouseTransfer>(`/warehouse-transfers/${id}`, { signal })
  if (data.id !== id) throw Error('The returned transfer does not match the requested record.')
  return validateTransfer(data)
}

export async function writeTransfer(command: TransferCommand) {
  const payload = command.payload
  if (command.action !== 'create') {
    requireRevision(command.id)
    requireRevision(command.payload.expectedRevision)
  }
  if (command.action === 'create' || command.action === 'draft') {
    const errors = transferDraftErrors(
      command.action === 'create'
        ? {
            ...command.payload,
            sourceWarehouseId: command.payload.sourceWarehouseId ?? 0,
            destinationWarehouseId: command.payload.destinationWarehouseId ?? 0,
            items: command.payload.items ?? [],
          }
        : command.payload,
    )
    if (Object.keys(errors).length) throw Error(Object.values(errors).join(' '))
  }
  if (command.action === 'cancel' && !command.payload.reason.trim())
    throw Error('Enter a cancellation reason.')
  if (command.action === 'reconcile') {
    const { items } = command.payload
    if (
      !items.length ||
      new Set(items.map((item) => item.warehouseTransferItemId)).size !== items.length
    )
      throw Error('Include every saved transfer line exactly once.')
    for (const item of items) {
      requireRevision(item.warehouseTransferItemId)
      for (const field of outcomeFields) requireDecimalLimit(item[field], field)
      if (parseOrderDecimal(item.damagedQuantity)! > parseOrderDecimal(item.receivedQuantity)!)
        throw Error('Damage cannot exceed received quantity.')
      if (
        outcomeFields.slice(1).some((field) => parseOrderDecimal(item[field])! > 0n) &&
        !item.discrepancyReason?.trim()
      )
        throw Error('Explain the damage, return or missing quantity.')
    }
  }
  // No automatic retries: an uncertain response requires reviewing authoritative state.
  const { data } =
    command.action === 'create'
      ? await apiClient.post<WarehouseTransfer>('/warehouse-transfers', payload)
      : await apiClient.patch<WarehouseTransfer>(
          `/warehouse-transfers/${command.id}/${command.action}`,
          payload,
        )
  validateTransfer(data)
  if (command.action !== 'create' && data.id !== command.id)
    throw Error('The server did not confirm the requested transfer.')
  const validState =
    command.action === 'dispatch'
      ? ['DISPATCHED', 'COMPLETED']
      : command.action === 'reconcile'
        ? ['COMPLETED']
        : command.action === 'cancel'
          ? ['CANCELLED']
          : ['DRAFT']
  if (!validState.includes(data.status))
    throw Error('The server did not confirm the action. Reload the transfer before continuing.')
  return data
}
