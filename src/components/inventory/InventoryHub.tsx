import { PageHeader } from '@/components/ui/ManagementPage'
import { InventoryItemCatalog } from './InventoryItemCatalog'
import type { InventoryNavigationTarget } from '@/features/logistics/stock-warnings'
import { useState } from 'react'
import { ArrowLeft, Settings, ShieldAlert } from 'lucide-react'
import { StockAlertSettings } from './StockAlertSettings'
import { QuarantinedStock } from './QuarantinedStock'
import { Button } from '@/components/ui/button'

export function InventoryHub({
  onOpenWarehouse,
  focusTarget,
}: {
  onOpenWarehouse?: (warehouseId: number) => void
  focusTarget?: InventoryNavigationTarget
} = {}) {
  const [view, setView] = useState<'catalog' | 'quarantine'>('catalog')
  const [stockItemId, setStockItemId] = useState<number>()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [previousTarget, setPreviousTarget] = useState(focusTarget)
  if (focusTarget !== previousTarget) {
    setPreviousTarget(focusTarget)
    if (focusTarget) setView('catalog')
  }
  return (
    <section aria-labelledby="inventory-heading" className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          id="inventory-heading"
          description="Browse products, check stock across warehouses, and manage inventory records."
        >
          Inventory
        </PageHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings aria-hidden="true" className="size-4" />
            Stock Alert Settings
          </Button>
          {view === 'catalog' ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStockItemId(undefined)
                setView('quarantine')
              }}
            >
              <ShieldAlert aria-hidden="true" className="size-4" />
              Quarantined Stock
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setView('catalog')}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to Products
            </Button>
          )}
        </div>
      </div>
      <div hidden={view !== 'catalog'}>
        <InventoryItemCatalog
          onOpenWarehouse={onOpenWarehouse}
          focusTarget={focusTarget}
          onOpenQuarantine={(id) => {
            setStockItemId(id)
            setView('quarantine')
          }}
        />
      </div>
      {view === 'quarantine' && (
        <section
          aria-labelledby="inventory-quarantine-heading"
          className="flex min-w-0 flex-col gap-3"
        >
          <h2 id="inventory-quarantine-heading" className="text-lg font-semibold">
            Quarantined Stock
          </h2>
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
        </section>
      )}
      {settingsOpen && <StockAlertSettings onClose={() => setSettingsOpen(false)} />}
    </section>
  )
}
