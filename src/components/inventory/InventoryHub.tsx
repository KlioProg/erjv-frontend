import { PageHeader } from '@/components/ui/ManagementPage'
import { InventoryItemCatalog } from './InventoryItemCatalog'
import type { InventoryNavigationTarget } from '@/features/logistics/stock-warnings'
import { useState } from 'react'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/AuthContext'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { QuarantinedStock } from './QuarantinedStock'
import { StockConditionReportModal } from './StockConditionReportModal'
import { StockAlertSettings } from './StockAlertSettings'

export function InventoryHub({
  onOpenWarehouse,
  focusTarget,
}: {
  onOpenWarehouse?: (warehouseId: number) => void
  focusTarget?: InventoryNavigationTarget
} = {}) {
  const [reportOpen, setReportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [quarantineOpen, setQuarantineOpen] = useState(false)
  const [productTab, setProductTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const { isAdmin, isManager, isStaff } = useAuth()
  const stocks = useStockItems()
  return (
    <section aria-labelledby="inventory-heading" className="flex min-w-0 flex-col gap-4">
      <PageHeader id="inventory-heading" description="Manage products and stock across warehouses.">
        Inventory
      </PageHeader>
      {quarantineOpen ? (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setQuarantineOpen(false)}>
              <ArrowLeft className="size-4" />
              Back to Products
            </Button>
            <h2 className="text-base font-semibold">Quarantined Stock</h2>
          </div>
          <QuarantinedStock />
        </div>
      ) : (
        <InventoryItemCatalog
          activeTab={productTab}
          onArchiveTabChange={setProductTab}
          onOpenWarehouse={onOpenWarehouse}
          focusTarget={focusTarget}
          navigationAction={
            <>
            {(isAdmin || isManager) && (
              <Button variant="ghost" size="sm" onClick={() => setSettingsOpen(true)}>
                Stock Alert Settings
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setQuarantineOpen(true)}>
              <ShieldAlert className="size-4" />
              Quarantined Stock
            </Button>
            </>
          }
          reportAction={
            (isAdmin || isManager || isStaff) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReportOpen(true)}
                disabled={stocks.isLoading || stocks.isError}
              >
                Report Stock Condition
              </Button>
            )
          }
        />
      )}
      {reportOpen && (
        <StockConditionReportModal
          open
          onClose={() => setReportOpen(false)}
          stocks={stocks.data ?? []}
          stocksLoading={stocks.isLoading}
          stocksError={stocks.isError}
        />
      )}
      {settingsOpen && <StockAlertSettings onClose={() => setSettingsOpen(false)} />}
    </section>
  )
}
