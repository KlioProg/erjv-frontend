import { useRecordsById } from '@/lib/use-records-by-id'
import { useStockItemByPair } from '@/features/logistics/stock-items.hooks'
import type { StockItemWithWarehouse } from '@/features/logistics/stock-items.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { useResourcePage } from '@/lib/use-cursor-page'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
import { StockPagingControls } from '@/components/inventory/StockPagingControls'
import {
  DataTableExpandedSection,
  DataTableExpandToggle,
} from '@/components/ui/DataTableExpandedSection'
import { formatProductUnit } from '@/lib/product-unit'
import { PageToolbar } from '@/components/ui/ManagementPage'
import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { Package, Plus, Search, Tag, ArrowRight, Warehouse as WarehouseIcon } from 'lucide-react'
import {
  buildStockWarnings,
  filterStockWarnings,
  stockCondition,
  stockConditionForItem,
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
  useProduct,
  useDeactivateProduct,
  useReactivateProduct,
} from '@/features/products/products.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import {
  buildCatalogStockMap,
} from '@/features/products/products.catalog.utils'
import { useAuth } from '@/features/auth/AuthContext'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { InventoryItemModal } from '@/components/operations/InventoryItemModal'
import { getErrorMessage } from '@/lib/api-client'
import {
  availableStockCents,
  formatStockCents,
  parseStockCents,
  stockSortKey,
} from '@/features/logistics/stock-display'

export interface InventoryItemCatalogProps {
  activeTab?: 'ACTIVE' | 'ARCHIVED'
  onArchiveTabChange?: (tab: 'ACTIVE' | 'ARCHIVED') => void
  hideArchiveNav?: boolean
  onOpenWarehouse?: (warehouseId: number) => void
  focusTarget?: InventoryNavigationTarget
  reportAction?: ReactNode
  navigationAction?: ReactNode
}

export function InventoryItemCatalog({
  activeTab: controlledActiveTab,
  onArchiveTabChange,
  hideArchiveNav = false,
  onOpenWarehouse,
  focusTarget: navigationTarget,
  reportAction,
  navigationAction,
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
  const [internalActiveTab, setInternalActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const activeTab = controlledActiveTab ?? internalActiveTab
  const [searchTerm, setSearchTerm] = useState('')
  const productsQuery = useResourcePage<InventoryItemResponse>('/inventory-items', {
    includeInactive: activeTab === 'ARCHIVED' ? 'only' : 'false',
    ...(searchTerm.trim() ? { q: searchTerm.trim() } : {}),
  }, true, warningScope)
  const focusedProductQuery = useProduct(focusTarget?.productId ?? 0)
  const allProducts = useMemo(() => {
    const items = productsQuery.items
    const focused = focusedProductQuery.data
    return focusTarget &&
      focused?.id === focusTarget.productId &&
      !searchTerm.trim() &&
      focused.isActive === (activeTab === 'ACTIVE') &&
      !items.some((item) => item.id === focused.id)
      ? [...items, focused]
      : items
  }, [productsQuery.items, focusedProductQuery.data, focusTarget, searchTerm, activeTab])
  const stockQuery = useStockItems()
  const stockItems = useMemo(() => stockQuery.data ?? [], [stockQuery.data])
  const { isAdmin, isManager } = useAuth()

  const handleTabChange = (tab: 'ACTIVE' | 'ARCHIVED') => {
    setSelectedPage(1)
    setSearchTerm('')
    setWarningScope(null)
    if (onArchiveTabChange) onArchiveTabChange(tab)
    else setInternalActiveTab(tab)
  }

  const [expandedProductIds, setExpandedProductIds] = useState<Set<number>>(
    () => new Set(focusTarget ? [focusTarget.productId] : []),
  )
  const [selectedPage, setSelectedPage] = useState<number | null>(null)
  const pageSize = productsQuery.pageSize
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

  const stockComplete = !stockQuery.hasNextPage && !stockQuery.isPending && !stockQuery.isError

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

  const filteredProducts = currentList.filter((product) => !warningScope || warningProductIds.has(product.id))

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
    productsQuery.isFetching ||
    Boolean(focusTarget && focusedProductQuery.isLoading) ||
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
      sortable: false,
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
      sortable: false,
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
      sortable: false,
      sortKey: (row) =>
        stockSortKey(
          stockComplete
            ? (productStockMap.get(row.id)?.totalCents ?? (productStockMap.has(row.id) ? null : 0n))
            : null,
        ),
      cell: ({ row }) => {
        const total = stockComplete
          ? (productStockMap.get(row.id)?.totalCents ?? (productStockMap.has(row.id) ? null : 0n))
          : null
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
                ?.allocations.some((stock) => stockConditionForItem(stock) === 'OUT') && (
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
      sortable: false,
      sortKey: (row) => (stockComplete ? (productStockMap.get(row.id)?.warehouseCount ?? 0) : null),
      cell: ({ row }) => {
        const warehouseCount = productStockMap.get(row.id)?.warehouseCount ?? 0
        if (warehouseCount === 0 && stockComplete) {
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
            <span className="sm:hidden">
              {warehouseCount}
              {stockComplete ? '' : '+'} loc.
            </span>
            <span className="hidden sm:inline">
              {warehouseCount}
              {stockComplete ? '' : '+'} {warehouseCount === 1 ? 'Warehouse' : 'Warehouses'}
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

  const renderProductLocations = (product: InventoryItemResponse) =>
    warningScope || expandedProductIds.has(product.id)
      ? <ProductLocations product={product} warningScope={warningScope} warningLocations={warningLocations} focusTarget={focusTarget} onOpenWarehouse={onOpenWarehouse} />
      : null

  return (
    <div className="flex flex-col gap-4">
      {/* Archive / Active Tabs (Only shown if not hidden by parent UnifiedNavbar) */}
      {!hideArchiveNav && (
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <ArchiveTabNav
            activeTab={activeTab}
            onTabChange={handleTabChange}
            activeLabel="Active"

            archivedLabel="Archived"

            activeIcon={<Package className="size-3.5" />}
            bannerDescription="Showing deactivated catalog items. Pricing history and warehouse stock linkages are preserved and can be reactivated anytime."
          />
          {navigationAction && (
            <div className="justify-self-start sm:justify-self-end">{navigationAction}</div>
          )}
        </div>
      )}

      {warningScope && (
        <section aria-label="Stock warning filters" className="flex flex-wrap items-center gap-2">
          <p className="w-full text-xs text-muted-foreground">Warning filters apply to this product page and loaded stock records.</p>
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
            Warnings use available stock at each active warehouse. Product totals include all
            warehouses once all stock records are loaded. Low-stock detection requires configured
            reorder thresholds.
          </p>
        </section>
      )}
      {/* Header controls and Search */}
      <PageToolbar>
        <div className="relative flex-1 w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search inventory"
            placeholder="Search product names..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setSelectedPage(1)
            }}
            className="pl-9 h-9 text-[13px]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {reportAction}
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
        </div>
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
              if (productsQuery.isError) void productsQuery.reload()
              if (stockQuery.isError) void stockQuery.reload()
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
        !focusedProductQuery.isError &&
        !stockQuery.isError &&
        (!targetProduct || (!targetStock && stockComplete)) && (
          <p role="status" className="text-xs text-muted-foreground">
            {!targetProduct
              ? 'This product is archived or no longer available. Browse active inventory below.'
              : 'This stock location is no longer available. Review the current locations below.'}
          </p>
        )}
      {focusTarget && focusedProductQuery.isError && (
        <p role="alert" className="text-xs text-destructive">
          The selected product could not be loaded.{' '}
          <Button variant="link" onClick={() => void focusedProductQuery.refetch()}>
            Retry selected product
          </Button>
        </p>
      )}
      <CursorPageControls {...productsQuery} label="Product" />
      <StockPagingControls {...stockQuery} />
      {/* Reusable DataTable Component */}
      {!productsQuery.isError &&
        !stockQuery.isError &&
        !(warningScope && warehousesQuery.isError) && (
          <DataTable
            appearance="management"
            emptyContent={
              warningScope ? (
                <p role="status" className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {!stockComplete
                    ? 'No warning items in loaded stock records. Load more stock records to continue checking.'
                    : searchTerm
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
            pagination={false}
            manualSorting
            tableClassName="table-fixed w-full"
            rowClassName={(row) => {
              const total = stockComplete
                ? (productStockMap.get(row.id)?.totalCents ??
                  (productStockMap.has(row.id) ? null : 0n))
                : null
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

function ProductLocations({ product, warningScope, warningLocations, focusTarget, onOpenWarehouse }: {
  product: InventoryItemResponse
  warningScope: InventoryWarningTarget | null
  warningLocations: ReturnType<typeof buildStockWarnings>
  focusTarget?: InventoryNavigationTarget & { productId: number }
  onOpenWarehouse?: (id: number) => void
}) {
  const query = useResourcePage<StockItemWithWarehouse>(`/stock-items/inventory-items/${product.id}`)
  const pair = useStockItemByPair(focusTarget?.productId === product.id ? product.id : undefined, focusTarget?.warehouseId)
  const targetWarehouses = useRecordsById<Warehouse>('/warehouses', [pair.data?.warehouseId])
  const selected = pair.data && targetWarehouses.data[0] ? { ...pair.data, warehouse: targetWarehouses.data[0] } : undefined
  const allocations = selected && !query.items.some(item => item.id === selected.id) ? [...query.items, selected] : query.items
  const appliedFocus = useRef(false)
  useEffect(() => {
    if (appliedFocus.current || focusTarget?.productId !== product.id || query.isFetching) return
    const element = document.getElementById(`inventory-location-${product.id}-${focusTarget.warehouseId}`)
    if (!element) return
    const frame = requestAnimationFrame(() => {
      element.focus({ preventScroll: true })
      element.scrollIntoView({ block: 'center', behavior: 'instant' })
      appliedFocus.current = true
    })
    return () => cancelAnimationFrame(frame)
  }, [focusTarget, product.id, query.isFetching, query.data, pair.data, targetWarehouses.data])
  return (
      <>
      <DataTableExpandedSection
        id={`inventory-locations-${product.id}`}
        title="Stock by location"
        ariaLabel={`Stock by location for ${String(product.name ?? 'product')}`}
        isLoading={query.isFetching}
        isEmpty={!query.isFetching && !query.isError && allocations.length === 0}
        emptyContent="No stock records at this location."
        errorContent={query.isError ? <p role="alert">Stock locations could not be loaded. <Button variant="link" onClick={() => void query.reload()}>Retry locations</Button></p> : undefined}
      >
        <div className="divide-y divide-border">
          {allocations
            .filter(
              (stock) =>
                !warningScope ||
                warningLocations.some(
                  (warning) =>
                    warning.productId === product.id && warning.warehouseId === stock.warehouseId,
                ),
            )
            .map((stock) => {
              const quarantined = parseStockCents(stock.quarantinedQuantity)
              return (
                <div
                  key={stock.id}
                  id={`inventory-location-${product.id}-${stock.warehouseId}`}
                  tabIndex={-1}
                  aria-label={`Stock location ${stock.warehouse?.name || `Warehouse #${stock.warehouseId}`} for ${product.name}`}
                  className={cn(
                    'grid min-h-11 min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    stockConditionForItem(stock) === 'OUT' &&
                      product.isActive &&
                      'bg-destructive/5',
                    focusTarget?.productId === product.id &&
                      focusTarget.warehouseId === stock.warehouseId &&
                      'ring-2 ring-ring',
                  )}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <WarehouseIcon className="size-4 shrink-0 text-muted-foreground" />
                      <OverflowValue
                        value={stock.warehouse?.name || `Warehouse #${stock.warehouseId}`}
                        onActivate={
                          onOpenWarehouse ? () => onOpenWarehouse(stock.warehouseId) : undefined
                        }
                        className="h-auto min-h-8 whitespace-normal p-0 text-left text-sm font-medium [overflow-wrap:anywhere] pointer-coarse:min-h-11"
                      />
                    </div>
                    {quarantined !== null && quarantined > 0n && (
                      <span className="pl-6 text-xs text-status-warning-foreground [overflow-wrap:anywhere]">
                        {formatStockCents(quarantined)} {formatProductUnit(product.unit, 'units')}{' '}
                        quarantined
                      </span>
                    )}
                  </div>
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className="flex w-24 min-w-0 flex-col items-end gap-0.5 sm:w-28">
                      <div className="flex max-w-full items-center justify-end gap-1.5">
                        {product.isActive && (
                          <StockIndicator
                            condition={stockConditionForItem(stock)}
                            label={`${stockConditionForItem(stock) === 'LOW' ? 'Low stock' : 'Out of stock'} at ${stock.warehouse?.name || `Warehouse #${stock.warehouseId}`}`}
                          />
                        )}
                        <span className="min-w-0 text-right text-sm font-medium tabular-nums [overflow-wrap:anywhere]">
                          {formatStockCents(availableStockCents(stock))}{' '}
                          {formatProductUnit(product.unit, 'units')}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">Available</span>
                    </div>
                    {onOpenWarehouse && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenWarehouse(stock.warehouseId)}
                        aria-label={`View inventory in ${String(stock.warehouse?.name ?? 'warehouse')}`}
                        className="h-8 shrink-0 gap-1 px-2 text-[13px] text-primary-text pointer-coarse:min-h-11"
                      >
                        View <ArrowRight className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      </DataTableExpandedSection>
      <CursorPageControls {...query} label="Stock location" />
      </>
    )
}
