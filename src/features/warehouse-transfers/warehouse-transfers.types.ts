export type TransferStatus = 'DRAFT' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED'
export const transferStatuses: { value: TransferStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All Transfers' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'DISPATCHED', label: 'In Transit' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]
export type TransferLineInput = { inventoryItemId: number; quantity: string }
export const outcomeFields = [
  'receivedQuantity',
  'damagedQuantity',
  'returnedSellableQuantity',
  'returnedDamagedQuantity',
  'missingQuantity',
] as const
export type OutcomeField = (typeof outcomeFields)[number]
export type TransferOutcome = Record<OutcomeField, string> & {
  warehouseTransferItemId: number
  discrepancyReason?: string | null
}
export type TransferItem = TransferLineInput & {
  id: number
  warehouseTransferId: number
  sourceStockItemId: number | null
  destinationStockItemId: number | null
  discrepancyReason: string | null
} & Record<OutcomeField, string | null>
export type WarehouseTransfer = {
  id: number
  transferNumber: string
  revision: number
  status: TransferStatus
  sourceWarehouseId: number
  destinationWarehouseId: number
  scheduledDepartureAt: string | null
  notes: string | null
  items: TransferItem[]
}
export type CreateTransfer = {
  sourceWarehouseId: number
  destinationWarehouseId: number
  items: TransferLineInput[]
  scheduledDepartureAt?: string | null
  notes?: string | null
}
export type EditTransfer = Partial<CreateTransfer> & { expectedRevision: number }
export type TransferCommand =
  | { action: 'create'; payload: CreateTransfer }
  | { action: 'draft'; id: number; payload: EditTransfer }
  | { action: 'dispatch'; id: number; payload: { expectedRevision: number } }
  | { action: 'cancel'; id: number; payload: { expectedRevision: number; reason: string } }
  | {
      action: 'reconcile'
      id: number
      payload: { expectedRevision: number; items: TransferOutcome[] }
    }
