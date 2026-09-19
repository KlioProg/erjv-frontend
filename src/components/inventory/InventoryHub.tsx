import { useState, useMemo } from 'react'
import {
  Warehouse as WarehouseIcon,
  Package,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import { InventoryStockList } from '@/components/operations/InventoryStockList'
import { InventoryItemCatalog } from './InventoryItemCatalog'
import { LowStockList } from './LowStockList'
import { InventoryItemModal } from '@/components/operations/InventoryItemModal'

type InventorySubTab = 'warehouse-stock' | 'catalog' | 'low-stock'

export function InventoryHub() {
  const [activeSubTab, setActiveSubTab] = useState<InventorySubTab>('warehouse-stock')
  const { data: stockItems = [] } = useStockItems()
  const { isAdmin, isManager } = useAuth()

  const [isRegisterProductOpen, setIsRegisterProductOpen] = useState(false)

  // Count low stock items (quantity <= 20)
  const lowStockCount = useMemo(() => {
    return stockItems.filter((s) => parseFloat(s.quantity || '0') <= 20).length
  }, [stockItems])

  return (
    <div className="flex flex-col gap-5">
      {/* Calm & Clean Sub-Navigation Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-2xl border border-border/60 self-start">
          <button
            type="button"
            onClick={() => setActiveSubTab('warehouse-stock')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
              activeSubTab === 'warehouse-stock'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <WarehouseIcon className="size-3.5 text-primary" />
            <span>Stock by Warehouse</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('catalog')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
              activeSubTab === 'catalog'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Package className="size-3.5 text-primary" />
            <span>Product Catalog</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('low-stock')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer select-none ${
              activeSubTab === 'low-stock'
                ? 'bg-card text-foreground shadow-xs font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="size-3.5 text-amber-600" />
            <span>Low-Stock Alerts</span>
            {lowStockCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 bg-rose-500/10 text-rose-600 border-rose-500/20 font-bold ml-0.5"
              >
                {lowStockCount}
              </Badge>
            )}
          </button>
        </div>

        {/* Single Clear Primary Action */}
        {(isAdmin || isManager) && (
          <Button
            size="sm"
            onClick={() => setIsRegisterProductOpen(true)}
            className="text-xs font-bold h-9 gap-1.5 rounded-xl cursor-pointer shadow-xs shrink-0 self-start sm:self-auto"
          >
            <Plus className="size-3.5" />
            <span>Register Product</span>
          </Button>
        )}
      </div>

      {/* Sub-View Render Area */}
      <div className="animate-in fade-in-50 duration-150">
        {activeSubTab === 'warehouse-stock' && <InventoryStockList />}
        {activeSubTab === 'catalog' && <InventoryItemCatalog />}
        {activeSubTab === 'low-stock' && <LowStockList />}
      </div>

      {/* Register Product Modal */}
      <InventoryItemModal
        item={null}
        open={isRegisterProductOpen}
        onClose={() => setIsRegisterProductOpen(false)}
      />
    </div>
  )
}
