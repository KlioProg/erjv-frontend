import {
  DataTableExpandedSection,
  DataTableExpandToggle,
} from '@/components/ui/DataTableExpandedSection'
import { formatProductUnit } from '@/lib/product-unit'
import { PageToolbar } from '@/components/ui/ManagementPage'
import { useState, useMemo, useEffect, useRef } from 'react'
import { Package, Plus, Search, Tag, ArrowRight, Warehouse as WarehouseIcon } from 'lucide-react'
import {
  buildStockWarnings,
  filterStockWarnings,
  stockCondition,
  stockConditionForItem,
  stockConditionRank,
  type InventoryNavigationTarget,
  type InventoryWarningTarget,
  type StockWarningFilter,
} from '@/features/logistics/stock-warnings'
import { cn } from '@/lib/utils'
import { StockIndicator } from './StockIndicator'
import { InventoryWholesalePrice } from './InventoryWholesalePrice'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTableActions } from '@/components/ui/DataTableActions'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import {
  useAllProducts,
  useDeactivateProduct,
  useReactivateProduct,
} from '@/features/products/products.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import {
  buildCatalogStockMap,
  filterCatalogProducts,
} from '@/features/products/products.catalog.utils'
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
  focusTarget?: InventoryNavigationTarget
}

export function InventoryItemCatalog({
  activeTab: controlledActiveTab,
  onArchiveTabChange,
  hideArchiveNav = false,
  onOpenWarehouse,
  focusTarget: navigationTarget,
}: InventoryItemCatalogProps = {}) {
  const focusTarget =
    navigationTarget && 'productId' in navigationTarget ? navigationTarget : undefined
  const [warningScope, setWarningScope] = useState<InventoryWarningTarget | null>(
    navigationTarget && 'warningFilter' in navigationTarget ? navigationTarget : null,
  )
  const warehousesQuery = useWarehouses()
  const warehouses = useMemo(
    () => (warehousesQuery.data ?? []).filter((item) => item.isActive),
    [warehousesQuery.data],
  )
  const productsQuery = useAllProducts()
  const stockQuery = useStockItems()
  const allProducts = useMemo(() => productsQuery.data ?? [], [productsQuery.data])
  const stockItems = useMemo(() => stockQuery.data ?? [], [stockQuery.data])
  const { isAdmin, isManager } = useAuth()

  const [internalActiveTab, setInternalActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const activeTab = controlledActiveTab ?? internalActiveTab
  const handleTabChange = (tab: 'ACTIVE' | 'ARCHIVED') => {
    setSelectedPage(1)
    setSearchTerm('')
    setWarningScope(null)
    if (onArchiveTabChange) onArchiveTabChange(tab)
    else setInternalActiveTab(tab)
  }

  const [searchTerm, setSearchTerm] = useState('')
  const [expandedProductIds, setExpandedProductIds] = useState<Set<number>>(
    () => new Set(focusTarget ? [focusTarget.productId] : []),
  )
  const [selectedPage, setSelectedPage] = useState<number | null>(null)
  const [pageSize, setPageSize] = useState(10)
  const focusApplied = useRef(false)

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
  const productStockMap = useMemo(() => buildCatalogStockMap(stockItems), [stockItems])

  const toggleProductLocations = (productId: number) => {
    setExpandedProductIds((current) => {
      const next = new Set(current)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  const activeProducts = useMemo(
    () => allProducts.filter((p) => p.isActive !== false),
    [allProducts],
  )
  const archivedProducts = useMemo(
    () => allProducts.filter((p) => p.isActive === false),
    [allProducts],
  )
  const currentList = activeTab === 'ACTIVE' ? activeProducts : archivedProducts

  const warningLocations = useMemo(
    () =>
      filterStockWarnings(
        buildStockWarnings(allProducts, stockItems, warehouses),
        warningScope ?? { warningFilter: 'ALL' },
      ),
    [allProducts, stockItems, warehouses, warningScope],
  )
  const warningProductIds = useMemo(
    () => new Set(warningLocations.map((warning) => warning.productId)),
    [warningLocations],
  )

  const filteredProducts = useMemo(
    () =>
      [...filterCatalogProducts(currentList, searchTerm)]
        .filter((product) => !warningScope || warningProductIds.has(product.id))
        .sort((a, b) => {
          const quantity = (id: number) =>
            productStockMap.get(id)?.totalCents ?? (productStockMap.has(id) ? null : 0n)
          return (
            stockConditionRank[stockCondition(quantity(a.id))] -
              stockConditionRank[stockCondition(quantity(b.id))] ||
            a.name.localeCompare(b.name) ||
            a.id - b.id
          )
        }),
    [currentList, searchTerm, productStockMap, warningScope, warningProductIds],
  )

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
      await deactivateProductMutation.mutateAsync(prod.id)
      setProductToArchive(null)
    }
  }

  const handleReactivate = (prod: InventoryItemResponse) => {
    reactivateProductMutation.mutate(prod)
  }

  const isLoading =
    productsQuery.isLoading ||
    stockQuery.isLoading ||
    Boolean(warningScope && warehousesQuery.isLoading)

  const targetIndex = focusTarget
    ? filteredProducts.findIndex((product) => product.id === focusTarget.productId)
    : -1
  const page = selectedPage ?? (targetIndex >= 0 ? Math.floor(targetIndex / pageSize) + 1 : 1)
  const targetProduct = focusTarget
    ? allProducts.find((product) => product.id === focusTarget.productId && product.isActive)
    : undefined
  const targetStock = focusTarget
    ? stockItems.find(
        (stock) =>
          stock.inventoryItemId === focusTarget.productId &&
          stock.warehouseId === focusTarget.warehouseId,
      )
    : undefined
  useEffect(() => {
    if (!focusTarget || isLoading || focusApplied.current) return
    const element = document.getElementById(
      `inventory-location-${focusTarget.productId}-${focusTarget.warehouseId}`,
    )
    if (!element) return
    const frame = requestAnimationFrame(() => {
      element.focus({ preventScroll: true })
      element.scrollIntoView({ block: 'center', behavior: 'instant' })
      focusApplied.current = true
    })
    return () => cancelAnimationFrame(frame)
  }, [focusTarget, isLoading, filteredProducts, stockItems, page])

  const renderProductActions = (product: InventoryItemResponse) => (
    <DataTableActions
      onEdit={product.isActive !== false ? () => handleEditProduct(product) : undefined}
      onArchive={product.isActive !== false ? () => setProductToArchive(product) : undefined}
      onRestore={product.isActive === false ? () => handleReactivate(product) : undefined}
      isPending={deactivateProductMutation.isPending || reactivateProductMutation.isPending}
    />
  )

  // Column definitions for the reusable DataTable component
  const columns: ColumnDef<InventoryItemResponse>[] = [
    {
      id: 'name',
      header: 'Product',
      width: '40%',
      sortable: true,
      sortKey: 'name',
      cell: ({ row }) => {
        return (
          <div className="flex min-w-0 items-start gap-2 py-0.5 sm:gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
                <OverflowValue
                  value={row.name}
                  className="text-sm font-medium leading-5 text-foreground"
                />
                {row.variety && (
                  <Badge
                    variant="outline"
                    className="flex max-w-[50%] shrink-0 bg-secondary px-1.5 py-0 text-xs font-semibold leading-tight text-muted-foreground"
                  >
                    <Tag className="mr-1 size-3 shrink-0 text-muted-foreground" />
                    <OverflowValue value={row.variety} />
                  </Badge>
                )}
              </div>
              {row.description ? (
                <OverflowValue
                  value={row.description}
                  className="mt-0.5 hidden text-xs leading-tight text-muted-foreground lg:block"
                />
              ) : (
                <span className="mt-0.5 hidden text-xs leading-tight text-muted-foreground lg:block">
                  No description provided
                </span>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-1 md:hidden">
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
      cell: ({ row }) => <InventoryWholesalePrice product={row} canEdit={isAdmin || isManager} />,
    },
    {
      id: 'totalStock',
      header: (
        <>
          <span className="sm:hidden">Stock</span>
          <span className="hidden sm:inline">Total Stock</span>
        </>
      ),
      width: '14%',
      align: 'center',
      sortable: true,
      sortKey: (row) =>
        stockSortKey(
          productStockMap.get(row.id)?.totalCents ?? (productStockMap.has(row.id) ? null : 0n),
        ),
      cell: ({ row }) => {
        const total =
          productStockMap.get(row.id)?.totalCents ?? (productStockMap.has(row.id) ? null : 0n)
        return (
          <div className="flex min-w-0 items-center justify-center gap-1 text-sm font-normal">
            {row.isActive && (
              <StockIndicator
                condition={stockCondition(total)}
                label="Out of stock across all locations"
              />
            )}
            {row.isActive &&
              total !== null &&
              total > 0n &&
              productStockMap
                .get(row.id)
                ?.allocations.some((stock) => parseStockCents(stock.quantity) === 0n) && (
                <StockIndicator
                  condition="OUT"
                  label="Out of stock at some locations. Expand Locations for details."
                />
              )}
            <OverflowValue
              value={formatStockCents(total)}
              tooltipSuffix={formatProductUnit(row.unit, 'units')}
              className={
                total === 0n
                  ? 'text-center font-medium tabular-nums text-destructive'
                  : 'text-center tabular-nums text-foreground'
              }
            />
            <span className="hidden shrink-0 text-xs font-normal text-muted-foreground xl:inline">
              {formatProductUnit(row.unit, 'units')}
            </span>
          </div>
        )
      },
    },
    {
      id: 'locations',
      header: (
        <>
          <span className="sm:hidden">Loc.</span>
          <span className="hidden sm:inline">Locations</span>
        </>
      ),
      width: '16%',
      align: 'center',
      sortable: true,
      sortKey: (row) => productStockMap.get(row.id)?.warehouseCount ?? 0,
      cell: ({ row }) => {
        const warehouseCount = productStockMap.get(row.id)?.warehouseCount ?? 0
        if (warehouseCount === 0) {
          return (
            <span className="text-xs text-muted-foreground">
              <span className="sm:hidden">0 loc.</span>
              <span className="hidden sm:inline">0 Warehouses</span>
            </span>
          )
        }
        const isExpanded = Boolean(warningScope) || expandedProductIds.has(row.id)
        return (
          <DataTableExpandToggle
            disabled={Boolean(warningScope)}
            onToggle={() => toggleProductLocations(row.id)}
            expanded={isExpanded}
            controls={`inventory-locations-${row.id}`}
            ariaLabel={`${isExpanded ? 'Hide' : 'Show'} stock by location for ${row.name}`}
          >
            <span className="sm:hidden">{warehouseCount} loc.</span>
            <span className="hidden sm:inline">
              {warehouseCount} {warehouseCount === 1 ? 'Warehouse' : 'Warehouses'}
            </span>
          </DataTableExpandToggle>
        )
      },
    },
    ...(isAdmin || isManager
      ? [
          {
            id: 'actions',
            header: 'Actions',
            align: 'right' as const,
            className: 'hidden w-24 whitespace-nowrap md:table-cell pointer-coarse:w-28',
            headerClassName: 'hidden w-24 md:table-cell pointer-coarse:w-28',
            cell: ({ row }: { row: InventoryItemResponse }) => renderProductActions(row),
          },
        ]
      : []),
  ]

  const renderProductLocations = (product: InventoryItemResponse) => {
    const stockData = productStockMap.get(product.id)
    if ((!warningScope && !expandedProductIds.has(product.id)) || !stockData?.allocations.length)
      return null

    return (
      <DataTableExpandedSection
        id={`inventory-locations-${product.id}`}
        title="Stock by location"
        ariaLabel={`Stock by location for ${String(product.name ?? 'product')}`}
      >
        <div className="divide-y divide-border">
          {[...stockData.allocations]
            .filter(
              (stock) =>
                !warningScope ||
                warningLocations.some(
                  (warning) =>
                    warning.productId === product.id && warning.warehouseId === stock.warehouseId,
                ),
            )
            .sort((a, b) =>
              String(a.warehouse?.name ?? '').localeCompare(String(b.warehouse?.name ?? '')),
            )
            .map((stock) => (
              <div
                key={stock.id}
                id={`inventory-location-${product.id}-${stock.warehouseId}`}
                tabIndex={-1}
                aria-label={`Stock location ${stock.warehouse?.name || `Warehouse #${stock.warehouseId}`} for ${product.name}`}
                className={cn(
                  'grid min-h-11 min-w-0 gap-x-4 gap-y-1 py-1 sm:grid-cols-[minmax(0,1fr)_18rem] sm:items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  stockConditionForItem(stock) === 'OUT' &&
                    product.isActive &&
                    'bg-destructive/5',
                  focusTarget?.productId === product.id &&
                    focusTarget.warehouseId === stock.warehouseId &&
                    'ring-2 ring-ring',
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <WarehouseIcon className="size-4 shrink-0 text-muted-foreground" />
                  <OverflowValue
                    value={stock.warehouse?.name || `Warehouse #${stock.warehouseId}`}
                    onActivate={
                      onOpenWarehouse ? () => onOpenWarehouse(stock.warehouseId) : undefined
                    }
                    className="h-auto min-h-8 p-0 text-left text-sm font-medium pointer-coarse:min-h-11"
                  />
                </div>
                <div className="grid min-w-0 grid-cols-[1rem_minmax(0,1fr)_minmax(0,4rem)_auto] items-center gap-2 pl-6 sm:pl-0">
                  {product.isActive && (
                    <StockIndicator
                      condition={stockConditionForItem(stock)}
                      label={`${stockConditionForItem(stock) === 'LOW' ? 'Low stock' : 'Out of stock'} at ${stock.warehouse?.name || `Warehouse #${stock.warehouseId}`}`}
                    />
                  )}
                  <OverflowValue
                    value={formatStockCents(parseStockCents(stock.quantity))}
                    fullValue={
                      parseStockCents(stock.quantity) === null ? stock.quantity : undefined
                    }
                    tooltipSuffix={formatProductUnit(product.unit, 'units')}
                    className="col-start-2 text-right text-sm font-normal tabular-nums"
                  />
                  <span className="col-start-3 min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {formatProductUnit(product.unit, 'units')}
                  </span>
                  {onOpenWarehouse && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenWarehouse(stock.warehouseId)}
                      aria-label={`View inventory in ${String(stock.warehouse?.name ?? 'warehouse')}`}
                      className="col-start-4 h-8 shrink-0 gap-1 px-2 text-[13px] text-primary-text pointer-coarse:min-h-11"
                    >
                      View <ArrowRight className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </DataTableExpandedSection>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Archive / Active Tabs (Only shown if not hidden by parent UnifiedNavbar) */}
      {!hideArchiveNav && (
        <ArchiveTabNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          activeLabel="Active"
          activeCount={activeProducts.length}
          archivedLabel="Archived"
          archivedCount={archivedProducts.length}
          activeIcon={<Package className="size-3.5" />}
          bannerDescription="Showing deactivated catalog items. Pricing history and warehouse stock linkages are preserved and can be reactivated anytime."
        />
      )}

      {warningScope && (
        <section aria-label="Stock warning filters" className="flex flex-wrap items-center gap-2">
          <Select
            value={warningScope.warningFilter}
            onValueChange={(value) => {
              setWarningScope({ ...warningScope, warningFilter: value as StockWarningFilter })
              setSelectedPage(1)
            }}
          >
            <SelectTrigger aria-label="Warning status" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL">All stock warnings</SelectItem>
                <SelectItem value="OUT">Out of stock</SelectItem>
                <SelectItem value="LOW">Low stock</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          {warehouses.length > 1 && (
            <Select
              value={
                warningScope.warehouseId === undefined ? 'ALL' : String(warningScope.warehouseId)
              }
              onValueChange={(value) => {
                setWarningScope({
                  ...warningScope,
                  warehouseId: value === 'ALL' ? undefined : Number(value),
                })
                setSelectedPage(1)
              }}
            >
              <SelectTrigger aria-label="Warning warehouse" className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="ALL">All Warehouses</SelectItem>
                  {warehouses.map((warehouse) => (
                    <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                      {warehouse.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setWarningScope(null)
              setSelectedPage(1)
            }}
          >
            Clear warning filters
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Warnings use physical stock at each active warehouse. Product totals include all
            warehouses. Low-stock detection requires configured reorder thresholds.
          </p>
        </section>
      )}
      {/* Header controls and Search */}
      <PageToolbar>
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search inventory"
            placeholder="Search product, variety, or description..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setSelectedPage(1)
            }}
            className="pl-9 h-9 text-[13px]"
          />
        </div>

        {(isAdmin || isManager) && activeTab === 'ACTIVE' && (
          <Button
            onClick={handleCreateProduct}
            size="sm"
            className="gap-1.5 font-medium cursor-pointer shrink-0"
          >
            <Plus className="size-4" />
            Register Product
          </Button>
        )}
      </PageToolbar>

      {(productsQuery.isError ||
        stockQuery.isError ||
        (warningScope && warehousesQuery.isError)) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive"
        >
          Inventory could not be loaded:{' '}
          {getErrorMessage(productsQuery.error ?? stockQuery.error ?? warehousesQuery.error)}
          <Button
            variant="link"
            size="sm"
            onClick={() => {
              if (productsQuery.isError) void productsQuery.refetch()
              if (stockQuery.isError) void stockQuery.refetch()
              if (warningScope && warehousesQuery.isError) void warehousesQuery.refetch()
            }}
          >
            Retry
          </Button>
        </div>
      )}
      {focusTarget &&
        !isLoading &&
        !productsQuery.isError &&
        !stockQuery.isError &&
        (!targetProduct || !targetStock) && (
          <p role="status" className="text-xs text-muted-foreground">
            {!targetProduct
              ? 'This product is archived or no longer available. Browse active inventory below.'
              : 'This stock location is no longer available. Review the current locations below.'}
          </p>
        )}
      {/* Reusable DataTable Component */}
      {!productsQuery.isError &&
        !stockQuery.isError &&
        !(warningScope && warehousesQuery.isError) && (
          <DataTable
            appearance="management"
            emptyContent={
              warningScope ? (
                <p role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {searchTerm
                    ? 'No warning items match your search.'
                    : warningScope.warningFilter === 'LOW'
                      ? 'No low-stock items can be identified without configured reorder thresholds.'
                      : warningScope.warningFilter === 'OUT'
                        ? 'No out-of-stock items for the selected warehouses.'
                        : warningScope.warehouseId
                          ? 'No warnings for the selected warehouse.'
                          : 'No stock warnings.'}
                </p>
              ) : undefined
            }
            data={filteredProducts}
            columns={columns}
            renderExpandedRow={renderProductLocations}
            isLoading={isLoading}
            loadingMessage="Loading inventory catalog items..."
            pagination={true}
            page={page}
            onPageChange={setSelectedPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            tableClassName="table-fixed w-full"
            rowClassName={(row) => {
              const total =
                productStockMap.get(row.id)?.totalCents ?? (productStockMap.has(row.id) ? null : 0n)
              const condition = stockCondition(total)
              return row.isActive === false
                ? 'opacity-75 bg-background'
                : condition === 'OUT'
                  ? 'bg-destructive/5 hover:bg-destructive/10'
                  : condition === 'LOW'
                    ? 'bg-status-warning/60 hover:bg-status-warning'
                    : ''
            }}
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
