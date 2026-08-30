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
} from 'lucide-react'
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
import { useProducts, useDeactivateProduct } from '@/features/products/products.hooks'
import { useStockItems, useDeleteStockItem } from '@/features/logistics/stock-items.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import { InventoryItemModal } from './InventoryItemModal'
import { StockAdjustModal } from './StockAdjustModal'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export function InventoryStockList() {
  const { data: products = [], isLoading: isLoadingProducts } = useProducts()
  const { data: stockItems = [], isLoading: isLoadingStock } = useStockItems()
  const { data: warehouses = [] } = useWarehouses()
  const deactivateProductMutation = useDeactivateProduct()
  const deleteStockMutation = useDeleteStockItem()
  const { isOwner, isAdmin } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL')

  // Modals state
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false)
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<InventoryItemResponse | null>(null)
  const [selectedStockForAdjust, setSelectedStockForAdjust] = useState<StockItemWithRelations | null>(null)
  const [selectedProductForAllocate, setSelectedProductForAllocate] = useState<InventoryItemResponse | null>(null)
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

  // Filter products
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))

    if (selectedWarehouseFilter === 'ALL') return matchesSearch

    const whId = parseInt(selectedWarehouseFilter, 10)
    const hasStockInWh = stockItems.some(
      (s) => s.inventoryItemId === p.id && s.warehouseId === whId && parseFloat(s.quantity) > 0
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
      await deactivateProductMutation.mutateAsync(productToDelete.id)
      setProductToDelete(null)
    }
  }

  const handleAdjustStock = (stock: StockItemWithRelations) => {
    setSelectedProductForAllocate(null)
    setSelectedStockForAdjust(stock)
    setIsAdjustModalOpen(true)
  }

  const handleAllocateStock = (prod: InventoryItemResponse) => {
    setSelectedStockForAdjust(null)
    setSelectedProductForAllocate(prod)
    setIsAdjustModalOpen(true)
  }

  const handleRemoveStockAllocation = (
    stock: StockItemWithRelations,
    prodName: string,
    whName: string
  ) => {
    setStockToDelete({ stock, prodName, whName })
  }

  const confirmRemoveStock = async () => {
    if (stockToDelete) {
      await deleteStockMutation.mutateAsync(stockToDelete.stock.id)
      setStockToDelete(null)
    }
  }

  const isLoading = isLoadingProducts || isLoadingStock

  return (
    <div className="flex flex-col gap-5">
      {/* Header controls and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search product name, SKU, barcode..."
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

        {(isOwner || isAdmin) && (
          <div className="flex items-center gap-2">
            <Button onClick={handleCreateProduct} size="sm" className="gap-1.5 shadow-xs font-semibold cursor-pointer">
              <Plus className="size-4" />
              Register Product SKU
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
            <h3 className="text-sm font-semibold text-foreground">No catalog items found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm || selectedWarehouseFilter !== 'ALL'
                ? 'No products match your search filter or selected warehouse.'
                : 'Get started by creating your wholesale and retail inventory products.'}
            </p>
            {(isOwner || isAdmin) && !searchTerm && selectedWarehouseFilter === 'ALL' && (
              <Button onClick={handleCreateProduct} size="sm" variant="outline" className="mt-4 gap-1.5 cursor-pointer">
                <Plus className="size-3.5" />
                Register First Product SKU
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredProducts.map((prod) => {
            const stockInHubs = stockItems.filter((s) => s.inventoryItemId === prod.id)
            const totalStockUnits = productStockMap.get(prod.id) || 0

            return (
              <Card
                key={prod.id}
                className="overflow-hidden border-border/80 shadow-xs hover:border-primary/40 transition-all rounded-2xl"
              >
                <div className="p-5">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    {/* Product Basic Info */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
                        <Package className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-foreground truncate">
                            {prod.name}
                          </h4>
                          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 bg-muted/50 border-border text-foreground font-bold">
                            <Tag className="size-2.5 mr-1 text-primary" />
                            {prod.sku}
                          </Badge>
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
                          ₱{prod.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {(isOwner || isAdmin) && (
                        <div className="flex items-center gap-1.5">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-foreground cursor-pointer"
                              >
                                <MoreVertical className="size-4" />
                                <span className="sr-only">Product options</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditProduct(prod)}
                                className="gap-2 text-xs cursor-pointer"
                              >
                                <Edit2 className="size-3.5" />
                                Edit SKU & Pricing
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAllocateStock(prod)}
                                className="gap-2 text-xs font-semibold text-primary cursor-pointer"
                              >
                                <Plus className="size-3.5" />
                                Allocate Stock to Warehouse
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteProduct(prod)}
                                className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                                Delete / Deactivate Product
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
                        const wh = stock.warehouse || warehouses.find((w) => w.id === stock.warehouseId)
                        const whDisplayName = wh?.name || `Warehouse #${stock.warehouseId}`

                        return (
                          <div
                            key={stock.id}
                            className="flex items-center justify-between p-3.5 rounded-2xl bg-card border border-border/80 shadow-2xs hover:border-primary/40 transition-all gap-3"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-xs font-bold text-foreground truncate block leading-tight" title={whDisplayName}>
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
                                  onClick={() => handleRemoveStockAllocation(stock, prod.name, whDisplayName)}
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

      {/* Product Delete Confirmation Modal */}
      <ConfirmDeleteModal
        open={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={confirmDeleteProduct}
        title="Delete Product from Active Catalog"
        description="Are you sure you want to delete this product SKU? It will be deactivated and no longer available for point-of-sale checkout or warehouse intake."
        itemName={productToDelete?.name}
        itemDetails={productToDelete ? `SKU: ${productToDelete.sku} • ₱${productToDelete.unitPrice.toFixed(2)} / unit` : undefined}
        confirmText="Delete Product SKU"
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
        itemDetails={stockToDelete ? `Facility: ${stockToDelete.whName} • Current: ${parseFloat(stockToDelete.stock.quantity).toLocaleString()} units` : undefined}
        confirmText="Remove Allocation"
        variant="destructive"
      />
    </div>
  )
}
