import { useState } from 'react'
import {
  Boxes,
  Search,
  Plus,
  ArrowUpDown,
  Barcode,
  Warehouse as WarehouseIcon,
  PackageCheck,
  MoreVertical,
  Edit2,
  Trash2,
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useProducts, useDeactivateProduct } from '@/features/products/products.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
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
  const { isOwner, isAdmin } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL')

  // Modals state
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false)
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<InventoryItemResponse | null>(null)
  const [selectedStockForAdjust, setSelectedStockForAdjust] = useState<StockItemWithRelations | null>(null)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<InventoryItemResponse | null>(null)

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
    setSelectedStockForAdjust(stock)
    setIsAdjustModalOpen(true)
  }

  const isLoading = isLoadingProducts || isLoadingStock

  return (
    <div className="flex flex-col gap-5">
      {/* Top Controls Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-card/80 p-3 rounded-2xl border border-border/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
          {/* Search Input */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search products, SKU codes, categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9.5 h-10 text-xs font-medium rounded-xl"
            />
          </div>

          {/* Warehouse Filter Selector */}
          <select
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
            className="h-10 rounded-xl border border-input bg-background px-3 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ALL">All Warehouses & Storage Hubs</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id.toString()}>
                {wh.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Button */}
        {(isOwner || isAdmin) && (
          <Button
            onClick={handleCreateProduct}
            size="sm"
            className="h-10 px-4 gap-2 rounded-xl font-bold shadow-xs transition-transform active:scale-95"
          >
            <Plus className="size-4" />
            Register Product SKU
          </Button>
        )}
      </div>

      {/* Main Product Catalog & Multi-Depot Inventory Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
          <Spinner className="size-7 text-primary" />
          <span className="text-xs font-semibold">Loading Inventory Catalog & Multi-Warehouse Stock from Database...</span>
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Boxes className="size-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-base font-bold text-foreground">No inventory items found in database</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {searchTerm
                ? 'No catalog items match your search filter or selected warehouse.'
                : 'Register your first product SKU directly into the database to track stock, pricing, and distribution.'}
            </p>
            {(isOwner || isAdmin) && !searchTerm && (
              <Button onClick={handleCreateProduct} size="sm" className="mt-4 gap-1.5 rounded-xl font-semibold">
                <Plus className="size-3.5" />
                Register Product SKU
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredProducts.map((prod) => {
            const totalUnits = productStockMap.get(prod.id) || 0
            const stockInHubs = stockItems.filter((s) => s.inventoryItemId === prod.id)
            const is50kg = prod.name.includes('50kg') || prod.sku.includes('50KG')
            const is25kg = prod.name.includes('25kg') || prod.sku.includes('25KG')
            const isOil = prod.name.toLowerCase().includes('oil') || prod.sku.includes('OIL')
            const isSugar = prod.name.toLowerCase().includes('sugar') || prod.sku.includes('SUG')
            const isFlour = prod.name.toLowerCase().includes('flour') || prod.sku.includes('FLR')

            return (
              <Card
                key={prod.id}
                className="overflow-hidden border-border/80 bg-card hover:border-primary/50 transition-all duration-200 shadow-2xs rounded-2xl"
              >
                <div className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
                  {/* Left Column: Product Info & EXPANDED SKU Display */}
                  <div className="flex flex-col gap-3 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-extrabold text-foreground tracking-tight leading-tight">
                        {prod.name}
                      </h4>
                      {isOil && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/20 font-bold text-[10px] px-2 py-0.5 rounded-md">
                          Cooking Oil / Liquid
                        </Badge>
                      )}
                      {isSugar && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/20 font-bold text-[10px] px-2 py-0.5 rounded-md">
                          Refined Sugar
                        </Badge>
                      )}
                      {isFlour && (
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/20 font-bold text-[10px] px-2 py-0.5 rounded-md">
                          Bakery Flour
                        </Badge>
                      )}
                      {!isOil && !isSugar && !isFlour && is50kg && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 font-bold text-[10px] px-2 py-0.5 rounded-md">
                          50kg Wholesale Sack
                        </Badge>
                      )}
                      {!isOil && !isSugar && !isFlour && is25kg && (
                        <Badge variant="outline" className="bg-teal-500/10 text-teal-700 border-teal-500/20 font-bold text-[10px] px-2 py-0.5 rounded-md">
                          25kg Retail Sack
                        </Badge>
                      )}
                    </div>

                    {/* EXPANDED PROMINENT SKU DISPLAY */}
                    <div className="flex items-center gap-2">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/80 border border-border/90 text-foreground font-mono text-xs font-bold tracking-wider shadow-2xs">
                        <Barcode className="size-4 text-primary shrink-0" />
                        <span className="select-all">{prod.sku}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium">
                        ID: #{prod.id.toString().padStart(4, '0')}
                      </span>
                    </div>

                    {prod.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {prod.description}
                      </p>
                    )}
                  </div>

                  {/* Right Column: LARGE UNIT PRICE & Total Stock Badge */}
                  <div className="flex flex-row lg:flex-col items-start lg:items-end justify-between w-full lg:w-auto gap-4 pt-4 lg:pt-0 border-t lg:border-t-0 border-border/60">
                    {/* LARGE HIGH-CONTRAST UNIT PRICE */}
                    <div className="flex flex-col items-start lg:items-end">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Wholesale Unit Price
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                          ₱{prod.unitPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs font-bold text-muted-foreground">
                          / unit
                        </span>
                      </div>
                    </div>

                    {/* Aggregate Stock Counter & Action Controls */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold text-xs">
                        <PackageCheck className="size-3.5" />
                        <span>{totalUnits.toLocaleString()} Units in Warehouses</span>
                      </div>

                      {(isOwner || isAdmin) && (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditProduct(prod)}
                            className="h-7 px-2.5 text-xs font-semibold rounded-lg"
                          >
                            <Edit2 className="size-3 mr-1" />
                            Edit
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-muted-foreground hover:text-foreground rounded-lg"
                              >
                                <MoreVertical className="size-3.5" />
                                <span className="sr-only">Product actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => handleEditProduct(prod)}
                                className="gap-2 text-xs"
                              >
                                <Edit2 className="size-3.5" />
                                Edit Specifications
                              </DropdownMenuItem>
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
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/90 flex items-center gap-1.5">
                      <WarehouseIcon className="size-3.5 text-primary" />
                      Warehouse Stock Allocation & Adjustments
                    </span>
                  </div>

                  {stockInHubs.length === 0 ? (
                    <div className="text-xs text-muted-foreground italic py-1">
                      No stock units allocated yet. Click Adjust to receive inventory units into a warehouse.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                      {stockInHubs.map((stock) => (
                        <div
                          key={stock.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-card border border-border/80 shadow-2xs hover:border-primary/40 transition-colors"
                        >
                          <div className="min-w-0 pr-2">
                            <span className="text-xs font-bold text-foreground truncate block">
                              {stock.warehouse?.name || `Warehouse #${stock.warehouseId}`}
                            </span>
                            <span className="text-xs font-extrabold text-primary block mt-0.5">
                              {parseFloat(stock.quantity).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">units</span>
                            </span>
                          </div>

                          {(isOwner || isAdmin) && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleAdjustStock(stock)}
                              className="h-7 px-2 text-[11px] font-bold rounded-lg gap-1 shrink-0"
                            >
                              <ArrowUpDown className="size-3 text-primary" />
                              Adjust
                            </Button>
                          )}
                        </div>
                      ))}
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

      {/* Stock Adjust Modal */}
      <StockAdjustModal
        stockItem={selectedStockForAdjust}
        open={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
      />

      {/* Themed Confirm Delete Modal */}
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
    </div>
  )
}
