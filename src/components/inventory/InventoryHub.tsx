import { PageHeader } from '@/components/ui/ManagementPage'
import { InventoryItemCatalog } from './InventoryItemCatalog'
import type { InventoryNavigationTarget } from '@/features/logistics/stock-warnings'
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuarantinedStock } from './QuarantinedStock'
import { Button } from '@/components/ui/button'

export function InventoryHub({
  onOpenWarehouse,
  focusTarget,
}: {
  onOpenWarehouse?: (warehouseId: number) => void
  focusTarget?: InventoryNavigationTarget
} = {}) {
  const [view, setView] = useState('catalog')
  const [stockItemId, setStockItemId] = useState<number>()
  const [previousTarget, setPreviousTarget] = useState(focusTarget)
  if (focusTarget !== previousTarget) {
    setPreviousTarget(focusTarget)
    if (focusTarget) setView('catalog')
  }
  return (
    <section aria-labelledby="inventory-heading" className="flex min-w-0 flex-col gap-4">
      <PageHeader
        id="inventory-heading"
        description="Browse products, check stock across warehouses, and manage inventory records."
      >
        Inventory
      </PageHeader>
      <Tabs
        value={view}
        onValueChange={(value) => {
          setView(value)
          setStockItemId(undefined)
        }}
        className="min-w-0"
      >
        <TabsList aria-label="Inventory views">
          <TabsTrigger value="catalog">Products</TabsTrigger>
          <TabsTrigger value="quarantine">Quarantined Stock</TabsTrigger>
        </TabsList>
        <TabsContent value="catalog">
          <InventoryItemCatalog
            onOpenWarehouse={onOpenWarehouse}
            focusTarget={focusTarget}
            onOpenQuarantine={(id) => {
              setStockItemId(id)
              setView('quarantine')
            }}
          />
        </TabsContent>
        <TabsContent value="quarantine">
          {stockItemId !== undefined && (
            <Button variant="link" onClick={() => setStockItemId(undefined)}>
              Show all quarantine lots
            </Button>
          )}
          <QuarantinedStock
            key={stockItemId ?? 'all'}
            stockItemId={stockItemId}
            onOpenWarehouse={onOpenWarehouse}
          />
        </TabsContent>
      </Tabs>
    </section>
  )
}
