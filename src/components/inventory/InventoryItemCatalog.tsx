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
  ArrowRight,
  ChevronDown,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
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
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'
import { useAuth } from '@/features/auth/AuthContext'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { InventoryItemModal } from '@/components/operations/InventoryItemModal'
import { StockAdjustModal } from '@/components/operations/StockAdjustModal'

export interface InventoryItemCatalogProps {
  activeTab?: 'ACTIVE' | 'ARCHIVED'
  onArchiveTabChange?: (tab: 'ACTIVE' | 'ARCHIVED') => void
  hideArchiveNav?: boolean
  onOpenWarehouse?: (warehouseId: number) => void
}

export function InventoryItemCatalog({
  activeTab: controlledActiveTab,
  onArchiveTabChange,
  hideArchiveNav = false,
  onOpenWarehouse,
}: InventoryItemCatalogProps = {}) {
  const { data: allProducts = [], isLoading: isLoadingProducts } = useAllProducts()
  const { data: stockItems = [], isLoading: isLoadingStock } = useStockItems()
  const { isAdmin, isManager } = useAuth()

  const [internalActiveTab, setInternalActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const activeTab = controlledActiveTab ?? internalActiveTab
  const handleTabChange = onArchiveTabChange ?? setInternalActiveTab

  const [searchTerm, setSearchTerm] = useState('')
  const [expandedProductIds, setExpandedProductIds] = useState<Set<number>>(() => new Set())

  // Modals state
  const [selectedProductForEdit, setSelectedProductForEdit] =
    useState<InventoryItemResponse | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [productToArchive, setProductToArchive] = useState<InventoryItemResponse | null>(null)
  const [productForAllocate, setProductForAllocate] = useState<InventoryItemResponse | null>(null)
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false)

  const deactivateProductMutation = useDeactivateProduct({
    onViewArchive: () => handleTabChange('ARCHIVED'),
  })
  const reactivateProductMutation = useReactivateProduct()

  // Calculate stock metrics per product
  const productStockMap = useMemo(() => {
    const map = new Map<number, { total: number; warehouseCount: number; allocations: StockItemWithRelations[] }>()
    stockItems.forEach((s) => {
      const entry = map.get(s.inventoryItemId) || { total: 0, warehouseCount: 0, allocations: [] }
      entry.total += parseFloat(s.quantity || '0')
      entry.warehouseCount += 1
      entry.allocations.push(s)
      map.set(s.inventoryItemId, entry)
    })
    return map
  }, [stockItems])

  const toggleProductLocations = (productId: number) => {
    setExpandedProductIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const activeProducts = useMemo(() => allProducts.filter((p) => p.isActive !== false), [allProducts])
  const archivedProducts = useMemo(() => allProducts.filter((p) => p.isActive === false), [allProducts])
  const currentList = activeTab === 'ACTIVE' ? activeProducts : archivedProducts

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) return currentList
    return currentList.filter((p) => {
      return (
        p.name.toLowerCase().includes(term) ||
        (p.variety && p.variety.toLowerCase().includes(term)) ||
        (p.description && p.description.toLowerCase().includes(term))
      )
    })
  }, [currentList, searchTerm])

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

  // Column definitions for the reusable DataTable component
  const columns: ColumnDef<InventoryItemResponse>[] = [
      {
        id: 'name',
        header: 'Product',
        sortable: true,
        sortKey: 'name',
        cell: ({ row }) => {
          const isArchived = row.isActive === false
          return (
            <div className="flex items-start gap-3 py-0.5">
              <div
                className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  isArchived ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                }`}
              >
                <Package className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground truncate">{row.name}</span>
                  {row.variety && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-muted/60 text-muted-foreground font-semibold"
                    >
                      <Tag className="size-2.5 mr-1 text-primary" />
                      {row.variety}
                    </Badge>
                  )}
                </div>
                {row.description ? (
                  <span className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                    {row.description}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground/60 italic mt-0.5">
                    No description provided
                  </span>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'unitPrice',
        header: 'Wholesale Price',
        align: 'right',
        sortable: true,
        sortKey: 'unitPrice',
        cell: ({ row }) => (
          <div className="text-right">
            <span className="text-xs font-extrabold text-foreground">
              ₱
              {Number(row.unitPrice).toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-[10px] text-muted-foreground block font-medium">per unit</span>
          </div>
        ),
      },
      {
        id: 'totalStock',
        header: 'Total Stock',
        align: 'center',
        sortable: true,
        sortKey: (row) => productStockMap.get(row.id)?.total ?? 0,
        cell: ({ row }) => {
          const stockData = productStockMap.get(row.id) || { total: 0, warehouseCount: 0 }
          return (
            <div className="inline-flex items-center justify-center gap-1.5 font-bold text-xs">
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
          )
        },
      },
      {
        id: 'locations',
        header: 'Locations',
        align: 'center',
        sortable: true,
        sortKey: (row) => productStockMap.get(row.id)?.warehouseCount ?? 0,
        cell: ({ row }) => {
          const warehouseCount = productStockMap.get(row.id)?.warehouseCount ?? 0
          if (warehouseCount === 0) {
            return <span className="text-xs text-muted-foreground">0 Warehouses</span>
          }
          const isExpanded = expandedProductIds.has(row.id)
          return (
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleProductLocations(row.id)}
              aria-expanded={isExpanded}
              aria-controls={`inventory-locations-${row.id}`}
              aria-label={`${isExpanded ? 'Hide' : 'Show'} stock by location for ${row.name}`}
              className="h-7 gap-1.5 rounded-lg px-2 text-[11px] font-semibold"
            >
              {warehouseCount} {warehouseCount === 1 ? 'Warehouse' : 'Warehouses'}
              <ChevronDown className={`size-3.5 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        align: 'center',
        cell: ({ row }) => {
          const isArchived = row.isActive === false
          const totalStock = productStockMap.get(row.id)?.total || 0
          const status = isArchived ? 'Archived' : totalStock <= 0 ? 'Out of Stock' : totalStock <= 20 ? 'Low Stock' : 'In Stock'
          return (
            <Badge
              variant="outline"
              className={`text-[10px] font-bold ${
                isArchived ? 'bg-muted text-muted-foreground border-border'
                  : totalStock <= 0 ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                    : totalStock <= 20 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              }`}
            >
              {status}
            </Badge>
          )
        },
      },
      ...(isAdmin || isManager
        ? [
            {
              id: 'actions',
              header: 'Actions',
              align: 'right' as const,
              width: 80,
              cell: ({ row }: { row: InventoryItemResponse }) => {
                const isArchived = row.isActive === false
                return (
                  <div className="text-right">
                    {isArchived ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleReactivate(row)}
                        className="h-7.5 px-2.5 text-xs font-bold text-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl cursor-pointer"
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
                            onClick={() => handleEditProduct(row)}
                            className="gap-2 text-xs cursor-pointer px-2 py-1.5 rounded-md"
                          >
                            <Edit2 className="size-3.5" />
                            Edit Details & Price
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleAllocateProduct(row)}
                            className="gap-2 text-xs font-semibold text-primary cursor-pointer px-2 py-1.5 rounded-md"
                          >
                            <Plus className="size-3.5" />
                            Allocate to Warehouse
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="my-1" />
                          <DropdownMenuItem
                            onClick={() => setProductToArchive(row)}
                            className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer px-2 py-1.5 rounded-md"
                          >
                            <Archive className="size-3.5" />
                            Archive Item
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                )
              },
            },
          ]
        : []),
  ]

  const renderProductLocations = (product: InventoryItemResponse) => {
    const stockData = productStockMap.get(product.id)
    if (!expandedProductIds.has(product.id) || !stockData?.allocations.length) return null

    return (
      <div
        id={`inventory-locations-${product.id}`}
        role="region"
        aria-label={`Stock by location for ${product.name}`}
        className="border-l-2 border-primary/40 bg-muted/20 px-4 py-3 sm:pl-8"
      >
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Stock by Location</p>
        <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card">
          {[...stockData.allocations]
            .sort((a, b) => a.warehouse.name.localeCompare(b.warehouse.name))
            .map((stock) => (
              <div key={stock.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <WarehouseIcon className="size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    {onOpenWarehouse ? (
                      <Button
                        variant="link"
                        onClick={() => onOpenWarehouse(stock.warehouseId)}
                        className="h-auto max-w-full truncate p-0 text-left text-xs font-semibold"
                      >
                        {stock.warehouse.name}
                      </Button>
                    ) : (
                      <p className="truncate text-xs font-semibold">{stock.warehouse.name}</p>
                    )}
                    {stock.warehouse.address && <p className="truncate text-[11px] text-muted-foreground">{stock.warehouse.address}</p>}
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <span className="whitespace-nowrap text-xs font-bold">{Number(stock.quantity).toLocaleString()} units</span>
                  {onOpenWarehouse && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenWarehouse(stock.warehouseId)}
                      aria-label={`View inventory in ${stock.warehouse.name}`}
                      className="h-7 gap-1 px-2 text-xs text-primary"
                    >
                      View <ArrowRight className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </div>
        <p className="mt-2 text-right text-xs font-bold">Total: {stockData.total.toLocaleString()} units</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Archive / Active Tabs (Only shown if not hidden by parent UnifiedNavbar) */}
      {!hideArchiveNav && (
        <ArchiveTabNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeLabel="Active Catalog Items"
          activeCount={activeProducts.length}
          archivedLabel="Archived Items"
          archivedCount={archivedProducts.length}
          activeIcon={<Package className="size-3.5" />}
          bannerDescription="Showing deactivated catalog items. Pricing history and warehouse stock linkages are preserved and can be reactivated anytime."
        />
      )}

      {/* Header controls and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search product, variety, or description..."
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

      {/* Reusable DataTable Component */}
      <DataTable
        data={filteredProducts}
        columns={columns}
        renderExpandedRow={renderProductLocations}
        isLoading={isLoading}
        loadingMessage="Loading inventory catalog items..."
        pagination={true}
        pageSizeOptions={[10, 25, 50, 100]}
        rowClassName={(row) => (row.isActive === false ? 'opacity-75 bg-muted/10' : '')}
      />

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
