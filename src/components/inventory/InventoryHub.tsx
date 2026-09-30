import { useState, useMemo } from 'react'
import { Package, AlertTriangle, Archive } from 'lucide-react'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useAllProducts } from '@/features/products/products.hooks'
import { InventoryItemCatalog } from './InventoryItemCatalog'
import { LowStockList } from './LowStockList'
import { UnifiedNavbar, ArchiveNoticeBanner, type NavTabGroup } from '@/components/ui/UnifiedNavbar'

type InventorySubTab = 'catalog' | 'low-stock'
type ArchiveTab = 'ACTIVE' | 'ARCHIVED'

export function InventoryHub({ onOpenWarehouse }: { onOpenWarehouse?: (warehouseId: number) => void } = {}) {
  const [activeSubTab, setActiveSubTab] = useState<InventorySubTab>('catalog')
  const [archiveTab, setArchiveTab] = useState<ArchiveTab>('ACTIVE')

  const { data: stockItems = [] } = useStockItems()
  const { data: allProducts = [] } = useAllProducts()

  // Count low stock items (quantity <= 20)
  const lowStockCount = useMemo(() => {
    return stockItems.filter((s) => parseFloat(s.quantity || '0') <= 20).length
  }, [stockItems])

  // Count active vs archived products
  const activeProductsCount = useMemo(() => {
    return allProducts.filter((p) => p.isActive !== false).length
  }, [allProducts])

  const archivedProductsCount = useMemo(() => {
    return allProducts.filter((p) => p.isActive === false).length
  }, [allProducts])

  // Single unified navigation bar groups separated by a subtle vertical divider
  const navGroups: NavTabGroup<InventorySubTab | ArchiveTab>[] = [
    {
      id: 'views',
      value: activeSubTab,
      onChange: (val) => setActiveSubTab(val as InventorySubTab),
      tabs: [
        {
          value: 'catalog',
          label: 'Inventory',
          icon: <Package className="size-3.5" />,
        },
        {
          value: 'low-stock',
          label: 'Low-Stock Alerts',
          icon: <AlertTriangle className="size-3.5 text-amber-600 dark:text-[#ffb627]" />,
          count: lowStockCount > 0 ? lowStockCount : undefined,
          badgeVariant: 'destructive',
          title: `${lowStockCount} items at or below replenish threshold`,
        },
      ],
    },
    {
      id: 'archive-scope',
      value: archiveTab,
      onChange: (val) => setArchiveTab(val as ArchiveTab),
      tabs: [
        {
          value: 'ACTIVE',
          label: 'Active',
          count: activeProductsCount,
          badgeVariant: 'default',
        },
        {
          value: 'ARCHIVED',
          label: 'Archived',
          icon: <Archive className="size-3.5 text-amber-600 dark:text-[#ffb627]" />,
          count: archivedProductsCount,
          badgeVariant: archivedProductsCount > 0 ? 'amber' : 'default',
        },
      ],
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Single Unified Navbar: Views + Subtle Divider + Active/Archive */}
      <UnifiedNavbar groups={navGroups} />

      {/* Contextual Archive Banner when viewing archived records */}
      {archiveTab === 'ARCHIVED' && (
        <ArchiveNoticeBanner
          count={archivedProductsCount}
          entityName="products & stock records"
          onBackToActive={() => setArchiveTab('ACTIVE')}
        />
      )}

      {/* Sub-View Render Area */}
      <div className="animate-in fade-in-50 duration-150">
        {activeSubTab === 'catalog' && (
          <InventoryItemCatalog
            activeTab={archiveTab}
            onArchiveTabChange={setArchiveTab}
            hideArchiveNav={true}
            onOpenWarehouse={onOpenWarehouse}
          />
        )}
        {activeSubTab === 'low-stock' && <LowStockList />}
      </div>
    </div>
  )
}
