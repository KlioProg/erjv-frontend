import { useState, useMemo } from 'react'
import {
  Package,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Tag,
  Boxes,
  RotateCcw,
  Archive,
  Layers,
} from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { InventoryItemModal } from '@/components/operations/InventoryItemModal'
import { StockAdjustModal } from '@/components/operations/StockAdjustModal'

export function InventoryItemCatalog() {
  const { data: allProducts = [], isLoading: isLoadingProducts } = useAllProducts()
  const { data: stockItems = [], isLoading: isLoadingStock } = useStockItems()
  const { isAdmin, isManager } = useAuth()

  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const [searchTerm, setSearchTerm] = useState('')

  // Modals state
  const [selectedProductForEdit, setSelectedProductForEdit] =
    useState<InventoryItemResponse | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [productToArchive, setProductToArchive] = useState<InventoryItemResponse | null>(null)
  const [productForAllocate, setProductForAllocate] = useState<InventoryItemResponse | null>(null)
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false)

  const deactivateProductMutation = useDeactivateProduct({
    onViewArchive: () => setActiveTab('ARCHIVED'),
  })
  const reactivateProductMutation = useReactivateProduct()

  // Calculate stock metrics per product
  const productStockMap = useMemo(() => {
    const map = new Map<number, { total: number; warehouseCount: number }>()
    stockItems.forEach((s) => {
      const entry = map.get(s.inventoryItemId) || { total: 0, warehouseCount: 0 }
      entry.total += parseFloat(s.quantity || '0')
      if (parseFloat(s.quantity || '0') > 0) {
        entry.warehouseCount += 1
      }
      map.set(s.inventoryItemId, entry)
    })
    return map
  }, [stockItems])

  const activeProducts = allProducts.filter((p) => p.isActive !== false)
  const archivedProducts = allProducts.filter((p) => p.isActive === false)
  const currentList = activeTab === 'ACTIVE' ? activeProducts : archivedProducts

  const filteredProducts = currentList.filter((p) => {
    const term = searchTerm.toLowerCase()
    return (
      p.name.toLowerCase().includes(term) ||
      (p.variety && p.variety.toLowerCase().includes(term)) ||
      (p.description && p.description.toLowerCase().includes(term))
    )
  })

  const handleCreateProduct = () => {
    setSelectedProductForEdit(null)
    setIsEditModalOpen(true)
  }

  const handleEditProduct = (prod: InventoryItemResponse) => {
    setSelectedProductForEdit(prod)
    setIsEditModalOpen(true)
  }

  const handleAllocateProduct = (prod: InventoryItemResponse) => {
    setProductForAllocate(prod)
    setIsAllocateModalOpen(true)
  }

  const confirmArchive = async () => {
    if (productToArchive) {
      const prod = productToArchive
      setProductToArchive(null)
      await deactivateProductMutation.mutateAsync(prod.id)
    }
  }

  const handleReactivate = (prod: InventoryItemResponse) => {
    reactivateProductMutation.mutate(prod)
  }

  const isLoading = isLoadingProducts || isLoadingStock

  return (
    <div className="flex flex-col gap-5">
      {/* Archive / Active Tabs */}
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Catalog Items"
        activeCount={activeProducts.length}
        archivedLabel="Archived Items"
        archivedCount={archivedProducts.length}
        activeIcon={<Package className="size-3.5" />}
        bannerDescription="Showing deactivated catalog items. Pricing history and warehouse stock linkages are preserved and can be reactivated anytime."
      />

      {/* Header controls and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search catalog by name, variety, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs rounded-xl"
          />
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

      {/* Main Table View */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Spinner className="mr-2 size-5" /> Loading inventory catalog items...
        </div>
      ) : filteredProducts.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="size-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">
              {activeTab === 'ACTIVE' ? 'No catalog items found' : 'No archived items found'}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm
                ? 'No items match your search filter.'
                : activeTab === 'ACTIVE'
                  ? 'Get started by registering your inventory products.'
                  : 'Archived catalog items will appear here and can be restored at any time.'}
            </p>
            {(isAdmin || isManager) && activeTab === 'ACTIVE' && !searchTerm && (
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
        <div className="rounded-2xl border border-border/80 overflow-hidden shadow-xs bg-card">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-bold text-foreground">Item & Variety</TableHead>
                <TableHead className="text-xs font-bold text-foreground text-right">
                  Wholesale Price
                </TableHead>
                <TableHead className="text-xs font-bold text-foreground text-center">
                  Total Allocated Units
                </TableHead>
                <TableHead className="text-xs font-bold text-foreground text-center">
                  Locations
                </TableHead>
                <TableHead className="text-xs font-bold text-foreground text-center">
                  Status
                </TableHead>
                {(isAdmin || isManager) && (
                  <TableHead className="text-xs font-bold text-foreground text-right w-20">
                    Actions
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((prod) => {
                const stockData = productStockMap.get(prod.id) || { total: 0, warehouseCount: 0 }
                const isArchived = prod.isActive === false

                return (
                  <TableRow
                    key={prod.id}
                    className={`hover:bg-muted/20 transition-colors ${
                      isArchived ? 'opacity-70 bg-muted/10' : ''
                    }`}
                  >
                    {/* Item & Description */}
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                            isArchived
                              ? 'bg-muted text-muted-foreground'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          <Package className="size-4" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-foreground truncate">
                              {prod.name}
                            </span>
                            {prod.variety && (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 bg-muted/60 text-muted-foreground font-semibold"
                              >
                                <Tag className="size-2.5 mr-1 text-primary" />
                                {prod.variety}
                              </Badge>
                            )}
                          </div>
                          {prod.description ? (
                            <span className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                              {prod.description}
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/60 italic mt-0.5">
                              No description provided
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    {/* Wholesale Price */}
                    <TableCell className="text-right">
                      <span className="text-xs font-extrabold text-foreground">
                        ₱
                        {Number(prod.unitPrice).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <span className="text-[10px] text-muted-foreground block font-medium">
                        per unit
                      </span>
                    </TableCell>

                    {/* Total Stock */}
                    <TableCell className="text-center">
                      <div className="inline-flex items-center gap-1.5 font-bold text-xs">
                        <Boxes className="size-3.5 text-primary" />
                        <span
                          className={
                            stockData.total === 0 ? 'text-rose-600 font-extrabold' : 'text-foreground'
                          }
                        >
                          {stockData.total.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-normal text-muted-foreground">units</span>
                      </div>
                    </TableCell>

                    {/* Locations Count */}
                    <TableCell className="text-center">
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-lg"
                      >
                        <Layers className="size-3 mr-1 text-muted-foreground" />
                        {stockData.warehouseCount} hubs
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold ${
                          isArchived
                            ? 'bg-muted text-muted-foreground border-border'
                            : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                        }`}
                      >
                        {isArchived ? 'Archived' : 'Active'}
                      </Badge>
                    </TableCell>

                    {/* Actions */}
                    {(isAdmin || isManager) && (
                      <TableCell className="text-right">
                        {isArchived ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleReactivate(prod)}
                            className="h-8 px-2.5 text-xs font-bold text-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl cursor-pointer"
                          >
                            <RotateCcw className="size-3 mr-1" />
                            Restore
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
                                <span className="sr-only">Actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="p-1">
                              <DropdownMenuItem
                                onClick={() => handleEditProduct(prod)}
                                className="gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-md"
                              >
                                <Edit2 className="size-3.5" />
                                Edit Details & Price
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleAllocateProduct(prod)}
                                className="gap-2 text-xs font-semibold text-primary cursor-pointer px-2 py-1.5 rounded-md"
                              >
                                <Plus className="size-3.5" />
                                Allocate to Warehouse
                              </DropdownMenuItem>
                              <DropdownMenuSeparator className="my-1" />
                              <DropdownMenuItem
                                onClick={() => setProductToArchive(prod)}
                                className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer px-2 py-1.5 rounded-md"
                              >
                                <Archive className="size-3.5" />
                                Archive Item
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit / Create Item Modal */}
      <InventoryItemModal
        item={selectedProductForEdit}
        open={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false)
          setSelectedProductForEdit(null)
        }}
      />

      {/* Unified Stock Allocation Modal */}
      <StockAdjustModal
        open={isAllocateModalOpen}
        inventoryItem={productForAllocate}
        onClose={() => {
          setIsAllocateModalOpen(false)
          setProductForAllocate(null)
        }}
      />

      {/* Archive Item Confirmation Modal */}
      <ConfirmDeleteModal
        open={!!productToArchive}
        onClose={() => setProductToArchive(null)}
        onConfirm={confirmArchive}
        title="Archive Inventory Item"
        description="Are you sure you want to archive this product? It will be safely removed from active order catalogs and intake forms, but all historical transactions and stock balances will be retained. You can restore it anytime."
        itemName={productToArchive?.name}
        itemDetails={
          productToArchive
            ? `Price: ₱${Number(productToArchive.unitPrice || 0).toFixed(2)}`
            : undefined
        }
        confirmText="Archive Item"
        variant="destructive"
      />
    </div>
  )
}
