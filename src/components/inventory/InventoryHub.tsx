import { PageHeader } from '@/components/ui/ManagementPage'
import { InventoryItemCatalog } from './InventoryItemCatalog'
import type { InventoryNavigationTarget } from '@/features/logistics/stock-warnings'

export function InventoryHub({
  onOpenWarehouse,
  focusTarget,
}: {
  onOpenWarehouse?: (warehouseId: number) => void
  focusTarget?: InventoryNavigationTarget
} = {}) {
  return (
    <section aria-labelledby="inventory-heading" className="flex min-w-0 flex-col gap-4">
      <PageHeader
        id="inventory-heading"
        description="Browse products, check stock across warehouses, and manage inventory records."
      >
        Inventory
      </PageHeader>
      <InventoryItemCatalog onOpenWarehouse={onOpenWarehouse} focusTarget={focusTarget} />
    </section>
  )
}
