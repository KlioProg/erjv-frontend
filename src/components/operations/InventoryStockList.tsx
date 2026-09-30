import { useState, useMemo } from 'react'
import {
  Package,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Boxes,
  ArrowUpDown,
  Tag,
  Warehouse as WarehouseIcon,
  Archive,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  Table as TableIcon,
  LayoutGrid,
} from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import {
  useAllProducts,
  useDeactivateProduct,
  useReactivateProduct,
} from '@/features/products/products.hooks'
import { useStockItems, useDeleteStockItem } from '@/features/logistics/stock-items.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import { InventoryItemModal } from './InventoryItemModal'
import { StockAdjustModal } from './StockAdjustModal'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { StockItemWithRelations, WarehouseSummary } from '@/features/logistics/stock-items.types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export interface InventoryStockListProps {
  onNavigateToLowStock?: () => void
  activeTab?: 'ACTIVE' | 'ARCHIVED'
  onArchiveTabChange?: (tab: 'ACTIVE' | 'ARCHIVED') => void
  hideArchiveNav?: boolean
}

interface FlatWarehouseStockItem {
  id: number
  stock: StockItemWithRelations
  product?: InventoryItemResponse
  warehouse?: WarehouseSummary
  availableUnits: number
  allocatedUnits: number
  totalUnits: number
  reorderLevel: number
  status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'
  updatedAt: string
}

export function InventoryStockList({
  onNavigateToLowStock,
  activeTab: controlledActiveTab,
  onArchiveTabChange,
  hideArchiveNav = false,
}: InventoryStockListProps = {}) {
  const { data: allProducts = [], isLoading: isLoadingProducts } = useAllProducts()
  const { data: stockItems = [], isLoading: isLoadingStock } = useStockItems()
  const { data: warehouses = [] } = useWarehouses()

  const [internalActiveTab, setInternalActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const activeTab = controlledActiveTab ?? internalActiveTab
  const handleTabChange = onArchiveTabChange ?? setInternalActiveTab

  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table')

  const deactivateProductMutation = useDeactivateProduct({
    onViewArchive: () => handleTabChange('ARCHIVED'),
  })
  const reactivateProductMutation = useReactivateProduct()
  const deleteStockMutation = useDeleteStockItem()
  const { isAdmin, isManager } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL')

  // Compute all low stock allocations (quantity <= 20) across facilities
  const lowStockAllocations = useMemo(() => {
    return stockItems
      .map((stock) => {
        const qty = parseFloat(stock.quantity || '0')
        const prod = allProducts.find((p) => p.id === stock.inventoryItemId)
        const wh = warehouses.find((w) => w.id === stock.warehouseId)
        return {
          id: stock.id,
          stock,
          qty,
          isOut: qty <= 0,
          isCritical: qty > 0 && qty <= 10,
          prodName: prod?.name || `Item #${stock.inventoryItemId}`,
          prodVariety: prod?.variety,
          whName: wh?.name ? wh.name.split(' ')[0] : `WH #${stock.warehouseId}`,
        }
      })
      .filter((item) => item.qty <= 20)
      .sort((a, b) => a.qty - b.qty)
  }, [stockItems, allProducts, warehouses])

  // Contextual low stock for the currently selected warehouse filter
  const contextualLowStock = useMemo(() => {
    if (selectedWarehouseFilter === 'ALL') return lowStockAllocations
    const whId = parseInt(selectedWarehouseFilter, 10)
    return lowStockAllocations.filter((item) => item.stock.warehouseId === whId)
  }, [lowStockAllocations, selectedWarehouseFilter])

  // Modals state
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false)
  const [selectedProductForEdit, setSelectedProductForEdit] =
    useState<InventoryItemResponse | null>(null)
  const [selectedStockForAdjust, setSelectedStockForAdjust] =
    useState<StockItemWithRelations | null>(null)
  const [selectedProductForAllocate, setSelectedProductForAllocate] =
    useState<InventoryItemResponse | null>(null)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<InventoryItemResponse | null>(null)
  const [stockToDelete, setStockToDelete] = useState<{
    stock: StockItemWithRelations
    prodName: string
    whName: string
  } | null>(null)

  // Map total units per product across all warehouses
  const productStockMap = useMemo(() => {
    const map = new Map<number, number>()
    stockItems.forEach((s) => {
      const current = map.get(s.inventoryItemId) || 0
      map.set(s.inventoryItemId, current + parseFloat(s.quantity))
    })
    return map
  }, [stockItems])

  const activeProducts = useMemo(() => allProducts.filter((p) => p.isActive !== false), [allProducts])
  const archivedProducts = useMemo(() => allProducts.filter((p) => p.isActive === false), [allProducts])
  const currentProductList = activeTab === 'ACTIVE' ? activeProducts : archivedProducts
  const currentProductIdSet = useMemo(
    () => new Set(currentProductList.map((p) => p.id)),
    [currentProductList],
  )

  // Filter products for Card View
  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    return currentProductList.filter((p) => {
      const matchesSearch =
        !term ||
        p.name.toLowerCase().includes(term) ||
        (p.variety && p.variety.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term))

      if (selectedWarehouseFilter === 'ALL') return matchesSearch

      const whId = parseInt(selectedWarehouseFilter, 10)
      const hasStockInWh = stockItems.some(
        (s) => s.inventoryItemId === p.id && s.warehouseId === whId && parseFloat(s.quantity) > 0,
      )
      return matchesSearch && hasStockInWh
    })
  }, [currentProductList, searchTerm, selectedWarehouseFilter, stockItems])

  // Flattened stock items for the Table View
  const flatStockItems = useMemo<FlatWarehouseStockItem[]>(() => {
    const term = searchTerm.toLowerCase().trim()

    return stockItems
      .filter((s) => currentProductIdSet.has(s.inventoryItemId))
      .filter((s) => {
        if (selectedWarehouseFilter === 'ALL') return true
        return s.warehouseId === parseInt(selectedWarehouseFilter, 10)
      })
      .map((s) => {
        const product = allProducts.find((p) => p.id === s.inventoryItemId)
        const warehouse = warehouses.find((w) => w.id === s.warehouseId) || s.warehouse
        const total = parseFloat(s.quantity || '0')
        const allocated = parseFloat(s.reservedQuantity || '0')
        const available = Math.max(0, total - allocated)
        const reorderLevel = 20

        let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK'
        if (total <= 0) {
          status = 'OUT_OF_STOCK'
        } else if (total <= reorderLevel) {
          status = 'LOW_STOCK'
        }

        return {
          id: s.id,
          stock: s,
          product,
          warehouse,
          availableUnits: available,
          allocatedUnits: allocated,
          totalUnits: total,
          reorderLevel,
          status,
          updatedAt: s.updatedAt || s.createdAt || '',
        }
      })
      .filter((item) => {
        if (!term) return true
        const prodName = item.product?.name?.toLowerCase() || ''
        const prodVariety = item.product?.variety?.toLowerCase() || ''
        const whName = item.warehouse?.name?.toLowerCase() || ''
        return prodName.includes(term) || prodVariety.includes(term) || whName.includes(term)
      })
  }, [stockItems, currentProductIdSet, selectedWarehouseFilter, allProducts, warehouses, searchTerm])

  const handleCreateProduct = () => {
    setSelectedProductForEdit(null)
    setIsCatalogModalOpen(true)
  }

  const handleEditProduct = (prod: InventoryItemResponse) => {
    setSelectedProductForEdit(prod)
    setIsCatalogModalOpen(true)
  }

  const handleDeleteProduct = (prod: InventoryItemResponse) => {
    setProductToDelete(prod)
  }

  const confirmDeleteProduct = async () => {
    if (productToDelete) {
      const prod = productToDelete
      setProductToDelete(null)
      await deactivateProductMutation.mutateAsync(prod.id)
    }
  }

  const handleReactivateProduct = (prodOrId: InventoryItemResponse | number) => {
    reactivateProductMutation.mutate(prodOrId)
  }

  const handleAdjustStock = (stock: StockItemWithRelations) => {
    setSelectedStockForAdjust(stock)
    setSelectedProductForAllocate(null)
    setIsAdjustModalOpen(true)
  }

  const handleAllocateStock = (prod: InventoryItemResponse) => {
    setSelectedProductForAllocate(prod)
    setSelectedStockForAdjust(null)
    setIsAdjustModalOpen(true)
  }

  const handleRemoveStockAllocation = (
    stock: StockItemWithRelations,
    prodName: string,
    whName: string,
  ) => {
    setStockToDelete({ stock, prodName, whName })
  }

  const confirmRemoveStock = async () => {
    if (stockToDelete) {
      const stock = stockToDelete
      setStockToDelete(null)
      await deleteStockMutation.mutateAsync(stock.stock.id)
    }
  }

  const isLoading = isLoadingProducts || isLoadingStock

  // Column definitions for Warehouse Stock DataTable
  const tableColumns = useMemo<ColumnDef<FlatWarehouseStockItem>[]>(() => {
    return [
      {
        id: 'product',
        header: 'Item & Variety',
        sortable: true,
        sortKey: (row) => row.product?.name || '',
        cell: ({ row }) => (
          <div className="flex items-start gap-3 py-0.5">
            <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-primary/10 text-primary">
              <Package className="size-4" />
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-foreground truncate">
                  {row.product?.name || `Item #${row.stock.inventoryItemId}`}
                </span>
                {row.product?.variety && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 bg-muted/60 text-muted-foreground font-semibold"
                  >
                    <Tag className="size-2.5 mr-1 text-primary" />
                    {row.product.variety}
                  </Badge>
                )}
              </div>
              {row.product?.unitPrice && (
                <span className="text-[11px] text-muted-foreground mt-0.5">
                  ₱{Number(row.product.unitPrice).toFixed(2)} / unit
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        id: 'warehouse',
        header: 'Warehouse / Location',
        sortable: true,
        sortKey: (row) => row.warehouse?.name || '',
        cell: ({ row }) => (
          <div>
            <div className="flex items-center gap-1.5">
              <WarehouseIcon className="size-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs font-semibold text-foreground">
                {row.warehouse?.name || `Warehouse #${row.stock.warehouseId}`}
              </span>
            </div>
            {row.warehouse?.address && (
              <span className="text-[10px] text-muted-foreground block truncate max-w-xs mt-0.5">
                {row.warehouse.address}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'availableUnits',
        header: 'Available Units',
        align: 'right',
        sortable: true,
        sortKey: 'availableUnits',
        cell: ({ row }) => (
          <div className="text-right">
            <span
              className={`text-xs font-bold ${
                row.availableUnits === 0 ? 'text-rose-600' : 'text-foreground'
              }`}
            >
              {row.availableUnits.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground block">units</span>
          </div>
        ),
      },
      {
        id: 'allocatedUnits',
        header: 'Allocated Units',
        align: 'right',
        sortable: true,
        sortKey: 'allocatedUnits',
        cell: ({ row }) => (
          <div className="text-right">
            <span className="text-xs font-semibold text-muted-foreground">
              {row.allocatedUnits.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground/70 block">units</span>
          </div>
        ),
      },
      {
        id: 'totalUnits',
        header: 'Total Units',
        align: 'right',
        sortable: true,
        sortKey: 'totalUnits',
        cell: ({ row }) => (
          <div className="text-right">
            <div className="inline-flex items-center gap-1 font-extrabold text-xs">
              <Boxes className="size-3 text-primary" />
              <span
                className={
                  row.totalUnits === 0
                    ? 'text-rose-600'
                    : row.totalUnits <= row.reorderLevel
                      ? 'text-amber-600 dark:text-[#ffb627]'
                      : 'text-foreground'
                }
              >
                {row.totalUnits.toLocaleString()}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground block">units</span>
          </div>
        ),
      },
      {
        id: 'reorderLevel',
        header: 'Reorder Level',
        align: 'center',
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 rounded-lg">
            {row.reorderLevel} units
          </Badge>
        ),
      },
      {
        id: 'status',
        header: 'Stock Status',
        align: 'center',
        sortable: true,
        sortKey: 'status',
        cell: ({ row }) => {
          if (row.status === 'OUT_OF_STOCK') {
            return (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                <span className="size-1.5 rounded-full bg-rose-600 dark:bg-rose-400 shrink-0" />
                Out of Stock
              </span>
            )
          }
          if (row.status === 'LOW_STOCK') {
            return (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-[#ffb627] border border-amber-500/25">
                <span className="size-1.5 rounded-full bg-amber-600 dark:bg-[#ffb627] shrink-0" />
                Low Stock
              </span>
            )
          }
          return (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/25">
              <span className="size-1.5 rounded-full bg-emerald-600 dark:bg-emerald-500 shrink-0" />
              In Stock
            </span>
          )
        },
      },
      ...(isAdmin || isManager
        ? [
            {
              id: 'actions',
              header: 'Actions',
              align: 'right' as const,
              width: 130,
              cell: ({ row }: { row: FlatWarehouseStockItem }) => (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAdjustStock(row.stock)}
                    className="h-7 px-2 text-[11px] font-bold rounded-lg gap-1 cursor-pointer bg-background hover:bg-muted/70 text-foreground border-border/80 shadow-2xs"
                  >
                    <ArrowUpDown className="size-3 text-muted-foreground" />
                    Adjust
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleRemoveStockAllocation(
                        row.stock,
                        row.product?.name || `Item #${row.stock.inventoryItemId}`,
                        row.warehouse?.name || `WH #${row.stock.warehouseId}`,
                      )
                    }
                    className="size-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer"
                    title="Remove allocation"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ),
            },
          ]
        : []),
    ]
  }, [isAdmin, isManager])

  return (
    <div className="flex flex-col gap-4">
      {/* Catalog Archive / Active Tabs (Only shown if not hidden by parent UnifiedNavbar) */}
      {!hideArchiveNav && (
        <ArchiveTabNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeLabel="Active Products"
          activeCount={activeProducts.length}
          archivedLabel="Archived Products"
          archivedCount={archivedProducts.length}
          activeIcon={<Package className="size-3.5" />}
          bannerDescription="Showing deactivated products catalog. Historical stock records and pricing specifications are safely preserved and can be reactivated anytime."
        />
      )}

      {/* Header controls, Search & View Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search product name or variety..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={selectedWarehouseFilter === 'ALL' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedWarehouseFilter('ALL')}
              className="h-8 text-xs font-semibold cursor-pointer rounded-xl"
            >
              All Warehouses
            </Button>
            {warehouses.map((wh) => (
              <Button
                key={wh.id}
                variant={selectedWarehouseFilter === String(wh.id) ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedWarehouseFilter(String(wh.id))}
                className="h-8 text-xs whitespace-nowrap cursor-pointer rounded-xl"
              >
                {wh.name.split(' ')[0]}
              </Button>
            ))}
          </div>

          {/* High-visibility compact low-stock message */}
          {activeTab === 'ACTIVE' && contextualLowStock.length > 0 && (
            <button
              type="button"
              onClick={onNavigateToLowStock}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-600 dark:text-[#ffb627] bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-xl cursor-pointer transition-all shrink-0 self-start sm:self-center shadow-2xs group"
              title="Click to view depleted items in Low-Stock Alerts"
            >
              <AlertTriangle className="size-3.5 text-amber-600 dark:text-[#ffb627] shrink-0" />
              <span>
                {contextualLowStock.length}{' '}
                {contextualLowStock.length === 1 ? 'item low' : 'items low'}
              </span>
              <ChevronRight className="size-3 text-amber-600 dark:text-[#ffb627] transition-transform group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {/* View Mode Switcher: Table vs Cards */}
          <div className="flex items-center p-0.5 rounded-xl bg-muted/60 border border-border/70 shadow-2xs">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              className={`h-7 px-2.5 text-xs font-bold gap-1.5 cursor-pointer rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-background shadow-2xs' : 'text-muted-foreground'
              }`}
              title="Table View"
            >
              <TableIcon className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Table</span>
            </Button>
            <Button
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className={`h-7 px-2.5 text-xs font-bold gap-1.5 cursor-pointer rounded-lg transition-all ${
                viewMode === 'cards' ? 'bg-background shadow-2xs' : 'text-muted-foreground'
              }`}
              title="Card View"
            >
              <LayoutGrid className="size-3.5 text-primary" />
              <span className="hidden sm:inline">Cards</span>
            </Button>
          </div>

          {(isAdmin || isManager) && activeTab === 'ACTIVE' && (
            <Button
              onClick={handleCreateProduct}
              size="sm"
              className="gap-1.5 shadow-xs font-semibold cursor-pointer shrink-0"
            >
              <Plus className="size-4" />
              Register Product
            </Button>
          )}
        </div>
      </div>

      {/* Main View: Table Mode or Card Mode */}
      {viewMode === 'table' ? (
        <DataTable
          data={flatStockItems}
          columns={tableColumns}
          isLoading={isLoading}
          loadingMessage="Loading warehouse stock inventory records..."
          pagination={true}
          pageSizeOptions={[10, 25, 50, 100]}
          emptyContent={
            <Card className="border-dashed bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <WarehouseIcon className="size-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-sm font-semibold text-foreground">
                  No warehouse stock records found
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {searchTerm || selectedWarehouseFilter !== 'ALL'
                    ? 'No stock allocations match your search filter or selected warehouse.'
                    : 'Allocate products to warehouse facilities to track real-time stock balances.'}
                </p>
              </CardContent>
            </Card>
          }
        />
      ) : (
        /* Card Mode */
        <div className="flex flex-col gap-4">
          {filteredProducts.length === 0 ? (
            <Card className="border-dashed bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Package className="size-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-sm font-semibold text-foreground">
                  {activeTab === 'ACTIVE'
                    ? 'No catalog items found'
                    : 'No deactivated products found'}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {searchTerm || selectedWarehouseFilter !== 'ALL'
                    ? 'No products match your search filter or selected warehouse.'
                    : activeTab === 'ACTIVE'
                      ? 'Get started by creating your wholesale and retail inventory products.'
                      : 'Archived inventory items will appear here and can be reactivated at any time.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredProducts.map((prod) => {
              const isArchived = prod.isActive === false
              const stockInHubs = stockItems.filter((s) => s.inventoryItemId === prod.id)
              const totalStockUnits = productStockMap.get(prod.id) || 0

              return (
                <Card
                  key={prod.id}
                  className={`group overflow-hidden border-border/80 shadow-xs hover:border-primary/40 transition-all rounded-2xl ${
                    isArchived ? 'opacity-75 bg-muted/20 border-dashed' : ''
                  }`}
                >
                  <div className="p-5">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      {/* Product Basic Info */}
                      <div className="flex items-start gap-3.5 min-w-0 flex-1">
                        <div
                          className={`flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-2xs ${
                            isArchived
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          <Package className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-foreground truncate">
                              {prod.name}
                            </h4>
                            {prod.variety && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-2 py-0.5 bg-muted/50 border-border text-foreground font-semibold"
                              >
                                <Tag className="size-2.5 mr-1 text-primary" />
                                {prod.variety}
                              </Badge>
                            )}
                          </div>
                          {prod.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {prod.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stock Overview & Price */}
                      <div className="flex items-center gap-6 self-end sm:self-center">
                        <div className="text-right">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                            Total Stock (All Hubs)
                          </span>
                          <div className="flex items-center justify-end gap-1.5 font-extrabold text-foreground text-sm">
                            <Boxes
                              className={`size-3.5 ${
                                totalStockUnits === 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : totalStockUnits <= 20
                                    ? 'text-amber-600 dark:text-[#ffb627]'
                                    : 'text-primary'
                              }`}
                            />
                            <span
                              className={
                                totalStockUnits === 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : totalStockUnits <= 20
                                    ? 'text-amber-600 dark:text-[#ffb627]'
                                    : 'text-foreground'
                              }
                            >
                              {totalStockUnits.toLocaleString()}{' '}
                              <span className="text-xs font-normal text-muted-foreground">units</span>
                            </span>
                          </div>
                        </div>

                        <div className="text-right pl-4 border-l border-border/60">
                          <span className="text-[10px] text-muted-foreground uppercase font-semibold block">
                            Wholesale Price
                          </span>
                          <span className="text-sm font-bold text-foreground block">
                            ₱
                            {prod.unitPrice.toLocaleString('en-US', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </div>

                        {(isAdmin || isManager) && (
                          <div className="flex items-center gap-1.5">
                            {isArchived ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleReactivateProduct(prod)}
                                className="group h-8 px-3 gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl cursor-pointer"
                              >
                                <RotateCcw className="size-3.5 text-emerald-600" />
                                <span>Reactivate</span>
                              </Button>
                            ) : (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg hover:bg-muted"
                                  >
                                    <MoreVertical className="size-4" />
                                    <span className="sr-only">Product options</span>
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="p-1">
                                  <DropdownMenuItem
                                    onClick={() => handleEditProduct(prod)}
                                    className="gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-md"
                                  >
                                    <Edit2 className="size-3.5" />
                                    Edit Product & Pricing
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleAllocateStock(prod)}
                                    className="gap-2 text-xs font-semibold text-primary cursor-pointer px-2 py-1.5 rounded-md"
                                  >
                                    <Plus className="size-3.5" />
                                    Allocate Stock to Warehouse
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="my-1" />
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteProduct(prod)}
                                    className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer px-2 py-1.5 rounded-md"
                                  >
                                    <Archive className="size-3.5" />
                                    Archive Product
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Warehouse Breakdown Sub-Panel */}
                  <div className="bg-muted/30 border-t border-border/60 px-5 py-3.5">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 flex items-center gap-1.5">
                        <WarehouseIcon className="size-3.5 text-primary" />
                        Warehouse Stock Allocation & Adjustments
                      </span>

                      {(isAdmin || isManager) && stockInHubs.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAllocateStock(prod)}
                          className="h-6.5 px-2.5 text-[11px] font-bold text-primary hover:text-primary/90 hover:bg-primary/10 rounded-lg gap-1 cursor-pointer"
                        >
                          <Plus className="size-3 text-primary" />
                          Allocate to Warehouse
                        </Button>
                      )}
                    </div>

                    {stockInHubs.length === 0 ? (
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-card border border-dashed border-border/80 text-xs">
                        <span className="text-muted-foreground font-medium">
                          No stock units allocated to any warehouse facility yet.
                        </span>
                        {(isAdmin || isManager) && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleAllocateStock(prod)}
                            className="h-7 text-xs font-bold gap-1 cursor-pointer"
                          >
                            <Plus className="size-3.5 text-primary" />
                            Allocate Stock to Warehouse
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {stockInHubs.map((stock) => {
                          const wh =
                            stock.warehouse || warehouses.find((w) => w.id === stock.warehouseId)
                          const whDisplayName = wh?.name || `Warehouse #${stock.warehouseId}`
                          const qtyNum = parseFloat(stock.quantity || '0')
                          const isOut = qtyNum <= 0
                          const isLow = qtyNum > 0 && qtyNum <= 20

                          return (
                            <div
                              key={stock.id}
                              className={`flex items-center justify-between p-3.5 rounded-2xl border bg-card shadow-2xs transition-all gap-3 ${
                                isOut
                                  ? 'border-rose-400 dark:border-rose-600 ring-1 ring-rose-400/30'
                                  : isLow
                                    ? 'border-amber-400 dark:border-amber-600 ring-1 ring-amber-400/30'
                                    : 'border-border/80 hover:border-primary/40'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className="text-xs font-bold text-foreground truncate leading-tight"
                                    title={whDisplayName}
                                  >
                                    {whDisplayName}
                                  </span>
                                  {isOut ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                      <span className="size-1.5 rounded-full bg-rose-600 dark:bg-rose-400 shrink-0" />
                                      Out of Stock
                                    </span>
                                  ) : isLow ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-[#ffb627] border border-amber-500/25">
                                      <span className="size-1.5 rounded-full bg-amber-600 dark:bg-[#ffb627] shrink-0" />
                                      Low Stock
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-baseline gap-1.5 mt-1.5">
                                  <span
                                    className={`text-base font-extrabold tracking-tight ${
                                      isOut
                                        ? 'text-rose-600 dark:text-rose-400'
                                        : isLow
                                          ? 'text-amber-600 dark:text-[#ffb627]'
                                          : 'text-foreground'
                                    }`}
                                  >
                                    {qtyNum.toLocaleString()}
                                  </span>
                                  <span className="text-[11px] font-medium text-muted-foreground">
                                    units
                                  </span>
                                </div>
                              </div>

                              {(isAdmin || isManager) && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleAdjustStock(stock)}
                                    className="h-7.5 px-2.5 text-[11px] font-bold rounded-xl gap-1.5 cursor-pointer bg-background hover:bg-muted/70 text-foreground border-border/80 shadow-2xs"
                                  >
                                    <ArrowUpDown className="size-3 text-muted-foreground" />
                                    Adjust
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleRemoveStockAllocation(stock, prod.name, whDisplayName)
                                    }
                                    className="size-7.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl cursor-pointer"
                                    title={`Remove allocation from ${whDisplayName}`}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </Card>
              )
            })
          )}
        </div>
      )}

      {/* Catalog Item Modal */}
      <InventoryItemModal
        item={selectedProductForEdit}
        open={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
      />

      {/* Stock Adjust & Allocation Modal */}
      <StockAdjustModal
        stockItem={selectedStockForAdjust}
        inventoryItem={selectedProductForAllocate}
        open={isAdjustModalOpen}
        onClose={() => {
          setIsAdjustModalOpen(false)
          setSelectedStockForAdjust(null)
          setSelectedProductForAllocate(null)
        }}
      />

      {/* Product Archive Confirmation Modal */}
      <ConfirmDeleteModal
        open={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={confirmDeleteProduct}
        title="Archive Product from Active Catalog"
        description="Are you sure you want to archive this product? It will be removed from active point-of-sale checkout and warehouse intake. All existing inventory records and price history remain preserved, and you can restore it anytime from the Archived Products tab."
        itemName={productToDelete?.name}
        itemDetails={
          productToDelete
            ? `₱${Number(productToDelete.unitPrice || 0).toFixed(2)} / unit`
            : undefined
        }
        confirmText="Archive Product"
        variant="destructive"
      />

      {/* Remove Warehouse Stock Allocation Confirmation Modal */}
      <ConfirmDeleteModal
        open={!!stockToDelete}
        onClose={() => setStockToDelete(null)}
        onConfirm={confirmRemoveStock}
        title="Remove Stock Allocation from Warehouse"
        description={`Are you sure you want to remove the inventory allocation of this product from ${stockToDelete?.whName}? Note: Items that already have delivery receipts or stock movement history cannot be deleted to preserve audit integrity and should stay at 0 units (Out of Stock).`}
        itemName={stockToDelete?.prodName}
        itemDetails={
          stockToDelete
            ? `Facility: ${stockToDelete.whName} • Current: ${parseFloat(stockToDelete.stock.quantity).toLocaleString()} units`
            : undefined
        }
        confirmText="Remove Allocation"
        variant="destructive"
      />
    </div>
  )
}
