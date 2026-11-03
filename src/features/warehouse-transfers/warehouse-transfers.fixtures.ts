import type { WarehouseTransfer } from './warehouse-transfers.types'
export function transferFixture(): WarehouseTransfer {
  return {
    id: 7,
    revision: 1,
    transferNumber: 'WT-000007',
    status: 'DRAFT',
    sourceWarehouseId: 1,
    destinationWarehouseId: 2,
    scheduledDepartureAt: null,
    notes: null,
    items: [
      {
        id: 71,
        warehouseTransferId: 7,
        inventoryItemId: 10,
        quantity: '10.00',
        sourceStockItemId: null,
        destinationStockItemId: null,
        receivedQuantity: null,
        damagedQuantity: null,
        returnedSellableQuantity: null,
        returnedDamagedQuantity: null,
        missingQuantity: null,
        discrepancyReason: null,
      },
    ],
  }
}
