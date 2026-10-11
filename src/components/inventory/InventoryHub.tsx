import { InventoryItemCatalog } from './InventoryItemCatalog'
import type { InventoryFocusTarget } from '@/features/logistics/stock-warnings'

export function InventoryHub({
  onOpenWarehouse,
  focusTarget,
}: { onOpenWarehouse?: (warehouseId: number) => void; focusTarget?: InventoryFocusTarget } = {}) {
  return (
    <section aria-labelledby="inventory-heading" className="flex min-w-0 flex-col gap-4">
      <h1 id="inventory-heading" className="text-lg font-bold">
        Inventory
      </h1>
      <InventoryItemCatalog onOpenWarehouse={onOpenWarehouse} focusTarget={focusTarget} />
    </section>
  )
}
