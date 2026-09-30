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
import { OverflowValue } from '@/components/ui/OverflowValue'
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
import { getErrorMessage } from '@/lib/api-client'
import { formatStockCents, parseStockCents, stockSortKey } from '@/features/logistics/stock-display'

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
  const productsQuery = useAllProducts()
  const stockQuery = useStockItems()
  const allProducts = useMemo(() => productsQuery.data ?? [], [productsQuery.data])
  const stockItems = useMemo(() => stockQuery.data ?? [], [stockQuery.data])
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

  const deactivateProductMutation = useDeactivateProduct({
    onViewArchive: () => handleTabChange('ARCHIVED'),
  })
  const reactivateProductMutation = useReactivateProduct()

  // Calculate stock metrics per product
  const productStockMap = useMemo(() => {
    const map = new Map<number, { totalCents: bigint | null; warehouseCount: number; allocations: StockItemWithRelations[] }>()
    stockItems.forEach((s) => {
      const entry = map.get(s.inventoryItemId) || { totalCents: 0n, warehouseCount: 0, allocations: [] }
      const quantity = parseStockCents(s.quantity)
      entry.totalCents = entry.totalCents === null || quantity === null ? null : entry.totalCents + quantity
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
        String(p.name ?? '').toLowerCase().includes(term) ||
        String(p.variety ?? '').toLowerCase().includes(term) ||
        String(p.description ?? '').toLowerCase().includes(term)
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

  const isLoading = productsQuery.isLoading || stockQuery.isLoading

  const renderStatusBadge = (product: InventoryItemResponse) => {
    const total = productStockMap.get(product.id)?.totalCents ?? (productStockMap.has(product.id) ? null : 0n)
    const isArchived = product.isActive === false
    const status = isArchived ? 'Archived' : total === null ? 'Unknown' : total <= 0n ? 'Out of Stock' : total <= 2000n ? 'Low Stock' : 'In Stock'
    return (
      <Badge
        variant="outline"
        className={`max-w-full text-[10px] font-bold ${
          isArchived ? 'bg-muted text-muted-foreground border-border'
            : total === null ? 'text-muted-foreground border-border'
              : total <= 0n ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                : total <= 2000n ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
        }`}
      >
        {status}
      </Badge>
    )
  }

  const renderProductActions = (product: InventoryItemResponse) => product.isActive === false ? (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => handleReactivate(product)}
      className="h-7.5 shrink-0 px-2.5 text-xs font-bold text-emerald-600 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl"
    >
      <RotateCcw className="size-3 mr-1" />
      Restore
    </Button>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${product.name}`} className="size-8 shrink-0 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="p-1">
        <DropdownMenuItem onClick={() => handleEditProduct(product)} className="gap-2 text-xs px-2 py-1.5 rounded-md">
          <Edit2 className="size-3.5" />
          Edit Details & Price
        </DropdownMenuItem>
        <DropdownMenuSeparator className="my-1" />
        <DropdownMenuItem onClick={() => setProductToArchive(product)} className="gap-2 text-xs text-destructive focus:text-destructive px-2 py-1.5 rounded-md">
          <Archive className="size-3.5" />
          Archive Item
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  // Column definitions for the reusable DataTable component
  const columns: ColumnDef<InventoryItemResponse>[] = [
      {
        id: 'name',
        header: 'Product',
        width: '42%',
        sortable: true,
        sortKey: 'name',
        cell: ({ row }) => {
          const isArchived = row.isActive === false
          return (
            <div className="flex min-w-0 items-start gap-2 py-0.5 sm:gap-3">
              <div
                className={`hidden p-2 rounded-xl shrink-0 mt-0.5 sm:block ${
                  isArchived ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary'
                }`}
              >
                <Package className="size-4" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <OverflowValue value={row.name} className="text-xs font-bold text-foreground" />
                {row.variety && (
                  <Badge variant="outline" className="mt-1 flex max-w-full self-start bg-muted/60 px-1.5 py-0 text-[10px] font-semibold text-muted-foreground">
                    <Tag className="mr-1 size-2.5 shrink-0 text-primary" />
                    <OverflowValue value={row.variety} />
                  </Badge>
                )}
                {row.description ? (
                  <OverflowValue value={row.description} className="mt-0.5 hidden text-[11px] text-muted-foreground lg:block" />
                ) : (
                  <span className="mt-0.5 hidden text-[10px] italic text-muted-foreground/60 lg:block">
                    No description provided
                  </span>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-1 md:hidden">
                  {renderStatusBadge(row)}
                  {(isAdmin || isManager) && renderProductActions(row)}
                </div>
              </div>
            </div>
          )
        },
      },
      {
        id: 'unitPrice',
        header: 'Wholesale Price',
        width: '16%',
        className: 'hidden lg:table-cell',
        headerClassName: 'hidden lg:table-cell',
        align: 'right',
        sortable: true,
        sortKey: 'unitPrice',
        cell: ({ row }) => (
          <div className="min-w-0 text-right">
            <OverflowValue
              value={Number.isFinite(Number(row.unitPrice)) && Number(row.unitPrice) >= 0
                ? `₱${Number(row.unitPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '—'}
              fullValue={row.unitPrice}
              className="text-right text-xs font-extrabold text-foreground tabular-nums"
            />
            <span className="text-[10px] text-muted-foreground block font-medium">per unit</span>
          </div>
        ),
      },
      {
        id: 'totalStock',
        header: <><span className="sm:hidden">Stock</span><span className="hidden sm:inline">Total Stock</span></>,
        width: '14%',
        align: 'center',
        sortable: true,
        sortKey: (row) => stockSortKey(productStockMap.get(row.id)?.totalCents ?? (productStockMap.has(row.id) ? null : 0n)),
        cell: ({ row }) => {
          const total = productStockMap.get(row.id)?.totalCents ?? (productStockMap.has(row.id) ? null : 0n)
          return (
            <div className="flex min-w-0 items-center justify-center gap-1 text-xs font-bold">
              <Boxes className="hidden size-3.5 shrink-0 text-primary lg:block" />
              <OverflowValue
                value={formatStockCents(total)}
                tooltipSuffix="units"
                className={total === 0n ? 'text-center font-extrabold tabular-nums text-rose-600' : 'text-center tabular-nums text-foreground'}
              />
              <span className="hidden shrink-0 text-[10px] font-normal text-muted-foreground xl:inline">units</span>
            </div>
          )
        },
      },
      {
        id: 'locations',
        header: <><span className="sm:hidden">Loc.</span><span className="hidden sm:inline">Locations</span></>,
        width: '15%',
        align: 'center',
        sortable: true,
        sortKey: (row) => productStockMap.get(row.id)?.warehouseCount ?? 0,
        cell: ({ row }) => {
          const warehouseCount = productStockMap.get(row.id)?.warehouseCount ?? 0
          if (warehouseCount === 0) {
            return <span className="text-xs text-muted-foreground"><span className="sm:hidden">0 loc.</span><span className="hidden sm:inline">0 Warehouses</span></span>
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
              className="h-7 max-w-full gap-1 rounded-lg px-1.5 text-[11px] font-semibold sm:px-2"
            >
              <span className="sm:hidden">{warehouseCount} loc.</span>
              <span className="hidden sm:inline">{warehouseCount} {warehouseCount === 1 ? 'Warehouse' : 'Warehouses'}</span>
              <ChevronDown className={`size-3.5 shrink-0 transition-transform duration-150 ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          )
        },
      },
      {
        id: 'status',
        header: 'Status',
        width: '9%',
        className: 'hidden md:table-cell',
        headerClassName: 'hidden md:table-cell',
        align: 'center',
        cell: ({ row }) => renderStatusBadge(row),
      },
      ...(isAdmin || isManager
        ? [
            {
              id: 'actions',
              header: 'Actions',
              align: 'right' as const,
              width: '4%',
              className: 'hidden md:table-cell',
              headerClassName: 'hidden md:table-cell',
              cell: ({ row }: { row: InventoryItemResponse }) => renderProductActions(row),
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
        aria-label={`Stock by location for ${String(product.name ?? 'product')}`}
        className="min-w-0 border-l-2 border-primary/40 bg-muted/20 px-3 py-3 sm:px-4 sm:pl-8"
      >
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Stock by Location</p>
        <div className="divide-y divide-border/60 rounded-lg border border-border/70 bg-card">
          {[...stockData.allocations]
            .sort((a, b) => String(a.warehouse?.name ?? '').localeCompare(String(b.warehouse?.name ?? '')))
            .map((stock) => (
              <div key={stock.id} className="flex min-w-0 flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <WarehouseIcon className="size-4 shrink-0 text-primary" />
                  <OverflowValue
                    value={stock.warehouse?.name}
                    onActivate={onOpenWarehouse ? () => onOpenWarehouse(stock.warehouseId) : undefined}
                    className="h-auto p-0 text-left text-xs font-semibold"
                  />
                </div>
                <div className="flex min-w-0 items-center justify-between gap-2 pl-6 sm:justify-end sm:pl-0">
                  <OverflowValue
                    value={formatStockCents(parseStockCents(stock.quantity))}
                    fullValue={parseStockCents(stock.quantity) === null ? stock.quantity : undefined}
                    tooltipSuffix="units"
                    className="text-xs font-bold tabular-nums sm:max-w-44 sm:text-right"
                  />
                  <span className="shrink-0 text-xs text-muted-foreground">units</span>
                  {onOpenWarehouse && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenWarehouse(stock.warehouseId)}
                      aria-label={`View inventory in ${String(stock.warehouse?.name ?? 'warehouse')}`}
                      className="h-7 shrink-0 gap-1 px-2 text-xs text-primary"
                    >
                      View <ArrowRight className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </div>
        <div className="mt-2 flex min-w-0 items-center justify-end gap-1 text-xs font-bold">
          <span className="shrink-0">Total:</span>
          <OverflowValue value={formatStockCents(stockData.totalCents)} tooltipSuffix="units" className="text-right tabular-nums" />
          <span className="shrink-0">units</span>
        </div>
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

      {(productsQuery.isError || stockQuery.isError) && (
        <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive">
          Inventory could not be loaded: {getErrorMessage(productsQuery.error ?? stockQuery.error)}
          <Button variant="link" size="sm" onClick={() => {
            if (productsQuery.isError) void productsQuery.refetch()
            if (stockQuery.isError) void stockQuery.refetch()
          }}>Retry</Button>
        </div>
      )}
      {/* Reusable DataTable Component */}
      {!productsQuery.isError && !stockQuery.isError && (
      <DataTable
        data={filteredProducts}
        columns={columns}
        renderExpandedRow={renderProductLocations}
        isLoading={isLoading}
        loadingMessage="Loading inventory catalog items..."
        pagination={true}
        pageSizeOptions={[10, 25, 50, 100]}
        tableClassName="table-fixed w-full [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3.5 sm:[&_th]:px-3.5"
        rowClassName={(row) => (row.isActive === false ? 'opacity-75 bg-muted/10' : '')}
      />
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
