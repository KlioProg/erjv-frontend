import type { DispatchDeliveryRunPayload } from './delivery-runs.types'
import { parseStockCents } from './stock-display'
import { decimalString } from './purchase-pricing'

export interface RunLoadRow {
  key: string
  deliveryId: number
  deliveryNumber: string
  expectedRevision: number
  salesOrderItemId: number
  stockItemId: number
  productName: string
  unit: string
  plannedQuantity: string
  availableQuantity: string
}

/** One load per member, with availability checked across the entire physical run. */
export function validateRunLoad(
  members: { id: number; revision: number }[],
  rows: RunLoadRow[],
  quantities: Record<string, string>,
): Pick<DispatchDeliveryRunPayload, 'loads'> {
  if (!members.length || new Set(members.map((member) => member.id)).size !== members.length)
    throw Error('Every run member must be identified exactly once.')
  if (new Set(rows.map((row) => row.key)).size !== rows.length)
    throw Error('The saved loading plan contains duplicate lines. Refresh the run.')
  const totals = new Map<number, bigint>()
  const loads = members.map((member) => {
    const memberRows = rows.filter((row) => row.deliveryId === member.id)
    if (
      !memberRows.length ||
      new Set(memberRows.map((row) => row.salesOrderItemId)).size !== memberRows.length
    )
      throw Error('Every member needs a valid, unique saved product plan.')
    const items = memberRows.flatMap((row) => {
      const loaded = parseStockCents(quantities[row.key]?.trim() || '0')
      const planned = parseStockCents(row.plannedQuantity)
      const available = parseStockCents(row.availableQuantity)
      if (
        row.expectedRevision !== member.revision ||
        !Number.isSafeInteger(row.stockItemId) ||
        row.stockItemId < 1 ||
        planned === null ||
        planned <= 0n ||
        available === null
      )
        throw Error('The loading plan or source stock changed. Refresh and review the run.')
      if (loaded === null || loaded > 999_999_999_999n || loaded > planned)
        throw Error(`Enter a non-negative loaded quantity within the plan for ${row.productName}.`)
      if (loaded === 0n) return []
      totals.set(row.stockItemId, (totals.get(row.stockItemId) ?? 0n) + loaded)
      return [
        {
          salesOrderItemId: row.salesOrderItemId,
          stockItemId: row.stockItemId,
          loadedQuantity: decimalString(loaded),
        },
      ]
    })
    if (!items.length)
      throw Error(
        `Confirm at least one loaded product for ${memberRows[0].deliveryNumber}. Remove an unloaded member from the run before departure.`,
      )
    return { deliveryId: member.id, expectedRevision: member.revision, items }
  })
  if (rows.some((row) => !members.some((member) => member.id === row.deliveryId)))
    throw Error('The saved run membership changed. Refresh the run.')
  for (const row of rows)
    if ((totals.get(row.stockItemId) ?? 0n) > parseStockCents(row.availableQuantity)!)
      throw Error(`Combined loads exceed available warehouse stock for ${row.productName}.`)
  return { loads }
}
