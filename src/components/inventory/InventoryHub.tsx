import { PageHeader } from '@/components/ui/ManagementPage'
import { InventoryItemCatalog } from './InventoryItemCatalog'
import type { InventoryNavigationTarget } from '@/features/logistics/stock-warnings'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useAuth } from '@/features/auth/AuthContext'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { QuarantinedStock } from './QuarantinedStock'
import { StockConditionReportModal } from './StockConditionReportModal'
import { StockAlertSettings } from './StockAlertSettings'

export function InventoryHub({
  onOpenWarehouse,
  focusTarget,
  quarantine = false,
}: {
  onOpenWarehouse?: (warehouseId: number) => void
  focusTarget?: InventoryNavigationTarget
  quarantine?: boolean
} = {}) {
  const [reportOpen, setReportOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [productTab, setProductTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const { isAdmin, isManager, isStaff } = useAuth()
  const stocks = useStockItems()
  return (
    <section aria-labelledby="inventory-heading" className="flex min-w-0 flex-col gap-4">
      <PageHeader id="inventory-heading" description="Manage products and stock across warehouses.">
        {quarantine ? 'Quarantined Stock' : 'Inventory'}
      </PageHeader>
      {quarantine ? <QuarantinedStock /> : (
        <InventoryItemCatalog
          activeTab={productTab}
          onArchiveTabChange={setProductTab}
          onOpenWarehouse={onOpenWarehouse}
          focusTarget={focusTarget}
          toolsAction={
            (isAdmin || isManager || isStaff) && <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="sm">Tools</Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuGroup>
                {(isAdmin || isManager) && <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>Stock Alert Settings</DropdownMenuItem>}
                <DropdownMenuItem onSelect={() => setReportOpen(true)} disabled={stocks.isLoading || stocks.isError}>Report Stock Condition</DropdownMenuItem>
              </DropdownMenuGroup></DropdownMenuContent>
            </DropdownMenu>
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
