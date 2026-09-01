import { useState } from 'react'
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
} from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export function InventoryStockList() {
  const { data: allProducts = [], isLoading: isLoadingProducts } = useAllProducts()
  const { data: stockItems = [], isLoading: isLoadingStock } = useStockItems()
  const { data: warehouses = [] } = useWarehouses()
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const deactivateProductMutation = useDeactivateProduct({ onViewArchive: () => setActiveTab('ARCHIVED') })
  const reactivateProductMutation = useReactivateProduct()
  const deleteStockMutation = useDeleteStockItem()
  const { isOwner, isAdmin } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL')

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
  const productStockMap = new Map<number, number>()
  stockItems.forEach((s) => {
    const current = productStockMap.get(s.inventoryItemId) || 0
    productStockMap.set(s.inventoryItemId, current + parseFloat(s.quantity))
  })

  const activeProducts = allProducts.filter((p) => p.isActive !== false)
  const archivedProducts = allProducts.filter((p) => p.isActive === false)
  const currentProductList = activeTab === 'ACTIVE' ? activeProducts : archivedProducts

  // Filter products
  const filteredProducts = currentProductList.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.variety && p.variety.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))

    if (selectedWarehouseFilter === 'ALL') return matchesSearch

    const whId = parseInt(selectedWarehouseFilter, 10)
    const hasStockInWh = stockItems.some(
      (s) => s.inventoryItemId === p.id && s.warehouseId === whId && parseFloat(s.quantity) > 0,
    )
    return matchesSearch && hasStockInWh
  })

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

  return (
    <div className="flex flex-col gap-5">
      {/* Catalog Archive / Active Tabs */}
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Products"
        activeCount={activeProducts.length}
        archivedLabel="Archived Products"
        archivedCount={archivedProducts.length}
        activeIcon={<Package className="size-3.5" />}
        bannerDescription="Showing deactivated products catalog. Historical stock records and pricing specifications are safely preserved and can be reactivated anytime."
      />

      {/* Header controls and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search product name or variety..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              variant={selectedWarehouseFilter === 'ALL' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSelectedWarehouseFilter('ALL')}
              className="h-8 text-xs font-semibold cursor-pointer"
            >
              All Warehouses
            </Button>
            {warehouses.map((wh) => (
              <Button
                key={wh.id}
                variant={selectedWarehouseFilter === String(wh.id) ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedWarehouseFilter(String(wh.id))}
                className="h-8 text-xs whitespace-nowrap cursor-pointer"
              >
                {wh.name.split(' ')[0]}
              </Button>
            ))}
          </div>
        </div>

        {(isOwner || isAdmin) && activeTab === 'ACTIVE' && (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCreateProduct}
              size="sm"
              className="gap-1.5 shadow-xs font-semibold cursor-pointer"
            >
              <Plus className="size-4" />
              Register Product
            </Button>
          </div>
        )}
      </div>

      {/* Main Product Cards & Stock Breakdowns */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Spinner className="mr-2 size-5" /> Loading catalog and stock balances...
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="size-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">
              {activeTab === 'ACTIVE' ? 'No catalog items found' : 'No deactivated products found'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm || selectedWarehouseFilter !== 'ALL'
                ? 'No products match your search filter or selected warehouse.'
                : activeTab === 'ACTIVE'
                  ? archivedProducts.length > 0
                    ? `All catalog items are currently archived (${archivedProducts.length} total).`
                    : 'Get started by creating your wholesale and retail inventory products.'
                  : 'Archived inventory items will appear here and can be reactivated at any time.'}
            </p>
            {!searchTerm &&
              selectedWarehouseFilter === 'ALL' &&
              activeTab === 'ACTIVE' &&
              archivedProducts.length > 0 && (
                <Button
                  onClick={() => setActiveTab('ARCHIVED')}
                  size="sm"
                  variant="outline"
                  className="mt-3 gap-1.5 cursor-pointer text-xs"
                >
                  <Archive className="size-3.5 text-amber-600" />
                  View Archived Products ({archivedProducts.length})
                </Button>
              )}
            {(isOwner || isAdmin) &&
              !searchTerm &&
              selectedWarehouseFilter === 'ALL' &&
              activeTab === 'ACTIVE' &&
              archivedProducts.length === 0 && (
                <Button
                  onClick={handleCreateProduct}
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1.5 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  Register First Product
                </Button>
              )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredProducts.map((prod) => {
            const isArchived = prod.isActive === false
            const stockInHubs = stockItems.filter((s) => s.inventoryItemId === prod.id)
            const totalStockUnits = productStockMap.get(prod.id) || 0

            return (
              <Card
                key={prod.id}
                className={`overflow-hidden border-border/80 shadow-xs hover:border-primary/40 transition-all rounded-2xl ${
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
                          <Boxes className="size-3.5 text-primary" />
                          <span>
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

                      {(isOwner || isAdmin) && (
                        <div className="flex items-center gap-1.5">
                          {isArchived ? (
                            (() => {
                              const isReactivatingThis =
                                reactivateProductMutation.isPending &&
                                (typeof reactivateProductMutation.variables === 'number'
                                  ? reactivateProductMutation.variables === prod.id
                                  : (reactivateProductMutation.variables as InventoryItemResponse | undefined)?.id === prod.id)

                              return (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleReactivateProduct(prod)}
                                  disabled={isReactivatingThis}
                                  className="h-9 px-4 gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/30 rounded-xl shadow-2xs cursor-pointer transition-all duration-150"
                                >
                                  {isReactivatingThis ? (
                                    <Spinner className="size-3.5 text-emerald-600 animate-spin" />
                                  ) : (
                                    <RotateCcw className="size-3.5 transition-transform duration-200 group-hover:-rotate-45" />
                                  )}
                                  <span>{isReactivatingThis ? 'Reactivating...' : 'Reactivate Product'}</span>
                                </Button>
                              )
                            })()
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg hover:bg-muted active:scale-90 transition-all duration-150"
                                >
                                  <MoreVertical className="size-4" />
                                  <span className="sr-only">Product options</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="p-1">
                                <DropdownMenuItem
                                  onClick={() => handleEditProduct(prod)}
                                  className="gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-md active:scale-95 transition-transform"
                                >
                                  <Edit2 className="size-3.5" />
                                  Edit Product & Pricing
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleAllocateStock(prod)}
                                  className="gap-2 text-xs font-semibold text-primary cursor-pointer px-2 py-1.5 rounded-md active:scale-95 transition-transform"
                                >
                                  <Plus className="size-3.5" />
                                  Allocate Stock to Warehouse
                                </DropdownMenuItem>
                                <DropdownMenuSeparator className="my-1" />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteProduct(prod)}
                                  className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer px-2 py-1.5 rounded-md active:scale-95 transition-transform"
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

                    {(isOwner || isAdmin) && stockInHubs.length > 0 && (
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
                      {(isOwner || isAdmin) && (
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

                        return (
                          <div
                            key={stock.id}
                            className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs hover:border-primary/40 transition-all gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <span
                                className="text-xs font-bold text-foreground truncate block leading-tight"
                                title={whDisplayName}
                              >
                                {whDisplayName}
                              </span>
                              <div className="flex items-baseline gap-1.5 mt-1.5">
                                <span className="text-sm font-extrabold text-primary tracking-tight">
                                  {parseFloat(stock.quantity).toLocaleString()}
                                </span>
                                <span className="text-[11px] font-medium text-muted-foreground">
                                  units
                                </span>
                              </div>
                            </div>

                            {(isOwner || isAdmin) && (
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleAdjustStock(stock)}
                                  className="h-7.5 px-2.5 text-[11px] font-bold rounded-xl gap-1 cursor-pointer"
                                >
                                  <ArrowUpDown className="size-3 text-primary" />
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
          })}
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
        description={`Are you sure you want to remove the inventory allocation of this product from ${stockToDelete?.whName}? The product will no longer be tracked at this facility until re-allocated.`}
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
