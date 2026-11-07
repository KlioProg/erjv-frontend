import { useRecordsById } from '@/lib/use-records-by-id'
import { useStockItemByPair } from '@/features/logistics/stock-items.hooks'
import type { StockItemWithWarehouse } from '@/features/logistics/stock-items.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { useResourcePage } from '@/lib/use-cursor-page'
import { DataTableFooter, DataTableFrame } from '@/components/ui/DataTableFooter'
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
  stockConditionForItem,
  type InventoryNavigationTarget,
  type InventoryWarningTarget,
  type StockWarningFilter,
} from '@/features/logistics/stock-warnings'
import { cn } from '@/lib/utils'
import { StockIndicator } from './StockIndicator'
import { DataTableFilters, DataTableFilterChips, type DataTableFilter } from '@/components/ui/data-table-filters'
import { InventoryWholesalePrice } from './InventoryWholesalePrice'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Button } from '@/components/ui/button'

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
  catalogStockCondition,
} from '@/features/products/products.catalog.utils'
import { useAuth } from '@/features/auth/AuthContext'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { InventoryItemModal } from '@/components/operations/InventoryItemModal'
import { getApiError, getErrorMessage } from '@/lib/api-client'
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
  toolsAction?: ReactNode
}

export function InventoryItemCatalog({
  activeTab: controlledActiveTab,
  onArchiveTabChange,
  hideArchiveNav = false,
  onOpenWarehouse,
  focusTarget: navigationTarget,
  toolsAction,
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

  const stockAccessDenied = [401, 403].includes(getApiError(stockQuery.error)?.status ?? 0)
  const stockComplete = !stockQuery.hasNextPage && !stockQuery.isPending &&
    (!stockQuery.isError || (stockQuery.dataUpdatedAt > 0 && !stockAccessDenied))
  const accessDenied = [productsQuery.error, stockQuery.error, ...(warningScope ? [warehousesQuery.error] : [])]
    .some((error) => [401, 403].includes(getApiError(error)?.status ?? 0))
  const missingData = (productsQuery.isError && productsQuery.data === undefined) ||
    (stockQuery.isError && stockQuery.dataUpdatedAt === 0) ||
    (warningScope && warehousesQuery.isError && warehousesQuery.data === undefined)

  // Calculate stock metrics per product
  const productStockMap = useMemo(() => buildCatalogStockMap(stockItems), [stockItems])
  const displayedStockMap = useMemo(
    () => warningScope?.warehouseId === undefined
      ? productStockMap
      : buildCatalogStockMap(stockItems.filter((stock) => stock.warehouseId === warningScope.warehouseId)),
    [productStockMap, stockItems, warningScope],
  )

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

  const stockWarningForProduct = (product: InventoryItemResponse): 'OUT' | 'LOW' | null => {
    if (product.isActive === false) return null
    const summary = displayedStockMap.get(product.id)
    const condition = catalogStockCondition(summary, stockComplete)
    if (condition === 'UNKNOWN' || condition === 'UNASSIGNED') return null
    const conditions = summary?.allocations.map(stockConditionForItem) ?? []
    if (condition === 'OUT' || conditions.includes('OUT')) return 'OUT'
    if (condition === 'LOW' || conditions.includes('LOW')) return 'LOW'
    return null
  }
  const warningOrder = { NONE: 0, LOW: 1, OUT: 2 }
  const filteredProducts = currentList
    .filter((product) => !warningScope || warningProductIds.has(product.id))
    .sort((a, b) => warningOrder[stockWarningForProduct(a) ?? 'NONE'] - warningOrder[stockWarningForProduct(b) ?? 'NONE'])

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
  const stockRowClassName = (product: InventoryItemResponse) => {
    if (product.isActive === false) return 'opacity-75 bg-background'
    const warning = stockWarningForProduct(product)
    if (warning === 'OUT') return 'bg-destructive/5 hover:bg-destructive/10 focus-within:bg-destructive/10'
    if (warning === 'LOW') return 'bg-status-warning/50 hover:bg-status-warning focus-within:bg-status-warning'
    return ''
  }
  const columns: ColumnDef<InventoryItemResponse>[] = [
    {
      id: 'name',
      header: 'Product',
      width: '32%',
      sortable: false,
      sortKey: 'name',
      cell: ({ row }) => {
        return (
          <div className="flex min-w-0 items-start gap-2 py-0.5 sm:gap-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-w-0 flex-nowrap items-center gap-x-1.5">
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
          <span className="hidden sm:inline">Available Stock</span>
          {warningScope?.warehouseId !== undefined && (
            <span className="block text-xs font-normal text-muted-foreground">Selected warehouse</span>
          )}
        </>
      ),
      width: '26%',
      align: 'center',
      sortable: false,
      sortKey: (row) =>
        stockSortKey(
          stockComplete
            ? (displayedStockMap.get(row.id)?.availableCents ?? null)
            : null,
        ),
      cell: ({ row }) => {
        const summary = displayedStockMap.get(row.id)
        const condition = catalogStockCondition(summary, stockComplete)
        const total = stockComplete ? (summary?.availableCents ?? null) : null
        const label = {
          OUT: 'Out of Stock',
          LOW: 'Low Stock',
          NORMAL: '',
          UNCONFIGURED: '',
          UNASSIGNED: '',
          UNKNOWN: 'Stock Unavailable',
        }[condition]
        const quantityClass = condition === 'OUT' ? 'text-destructive'
          : condition === 'LOW' ? 'text-status-warning-foreground'
          : condition === 'NORMAL' ? 'text-foreground' : 'text-muted-foreground'
        const localWarnings = condition !== 'UNKNOWN' && stockComplete && total !== null && total > 0n
          ? (['OUT', 'LOW'] as const).map((status) => ({
            status, count: summary?.allocations.filter((item) => stockConditionForItem(item) === status).length ?? 0,
          })).filter(({ status, count }) => count > 0 && !(status === 'LOW' && condition === 'LOW'))
          : []
        const hasWarning = condition === 'OUT' || condition === 'LOW' || localWarnings.length > 0
        const details = [label, ...localWarnings.map(({ status, count }) =>
          `${count} ${count === 1 ? 'warehouse' : 'warehouses'} ${status === 'OUT' ? 'out' : 'low'}`,
        )].filter(Boolean).join('; ')
        return (
          <OverflowValue asChild value={formatStockCents(total)} fullValue={hasWarning ? `${formatStockCents(total)} ${formatProductUnit(row.unit, 'units')}: ${details}` : undefined} showFullValueOnHover={hasWarning}>
          <div tabIndex={hasWarning ? 0 : undefined} className="flex min-w-0 items-center justify-center gap-2 whitespace-nowrap text-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <div className={cn('flex min-w-0 items-center justify-center gap-1 tabular-nums', quantityClass)}>
              <span className="font-medium tabular-nums">{formatStockCents(total)}</span>
              <span className="shrink-0 text-xs font-normal text-muted-foreground">
                {formatProductUnit(row.unit, 'units')}
              </span>
            </div>
            {!localWarnings.length && label && <>{!hasWarning && <span aria-hidden="true">&middot;</span>}<span className={cn('text-xs', quantityClass, hasWarning && 'sr-only')}>{label}</span></>}
            {localWarnings.map(({ status, count }) => (
              <span key={status} className="sr-only">
                &middot; {count} {count === 1 ? 'warehouse' : 'warehouses'} {status === 'OUT' ? 'out' : 'low'}
              </span>
            ))}
          </div>
          </OverflowValue>
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

  const tableFilters: DataTableFilter[] = [
    {
      kind: 'select',
      id: 'stock-status',
      label: 'Stock Status',
      value: warningScope?.warningFilter ?? 'NONE',
      emptyValue: 'NONE',
      options: [
        { value: 'NONE', label: 'All products' },
        { value: 'ALL', label: 'All stock warnings' },
        { value: 'OUT', label: 'Out of Stock' },
        { value: 'LOW', label: 'Low Stock' },
      ],
      onChange: (value) => {
        setWarningScope((current) =>
          value === 'NONE' ? null : { ...current, warningFilter: value as StockWarningFilter },
        )
        setSelectedPage(1)
      },
    },
    ...(warningScope
      ? [
          {
            kind: 'select' as const,
            id: 'warning-warehouse',
            label: 'Warning warehouse',
            value: warningScope.warehouseId === undefined ? 'ALL' : String(warningScope.warehouseId),
            options: [
              { value: 'ALL', label: 'All warehouses' },
              ...warehouses.map((warehouse) => ({
                value: String(warehouse.id),
                label: warehouse.name,
              })),
            ],
            onChange: (value: string) => {
              setWarningScope((current) =>
                current
                  ? { ...current, warehouseId: value === 'ALL' ? undefined : Number(value) }
                  : null,
              )
              setSelectedPage(1)
            },
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
        </div>
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

        <DataTableFilters filters={tableFilters} description="Stock warning filters apply to the current product page and loaded stock records. Warehouse thresholds determine Low Stock." />
        <div className="flex flex-wrap items-center gap-2">
          {toolsAction}
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
      <DataTableFilterChips filters={tableFilters} />
      {!warningScope && activeTab === 'ACTIVE' && <p className="text-xs text-muted-foreground">Products with stock warnings appear last on this page.</p>}
      {warningScope && <p className="text-xs text-muted-foreground">Warning filters apply to this product page and loaded stock records.</p>}


      {(productsQuery.isError ||
        stockQuery.isError ||
        (warningScope && warehousesQuery.isError)) && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive"
        >
          {!missingData && !accessDenied
            ? 'Latest inventory update could not be retrieved. Showing previously loaded data: '
            : 'Inventory could not be loaded: '}
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
      <StockPagingControls {...stockQuery} />
      {(productsQuery.isFetching || stockQuery.isFetching) && productsQuery.data !== undefined &&
        stockQuery.dataUpdatedAt > 0 && !accessDenied && (
          <p role="status" className="text-xs text-muted-foreground">Updating inventory...</p>
      )}
      {/* Reusable DataTable Component */}
      <DataTableFrame>
      {!accessDenied && !missingData && (
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
            getRowKey={(row) => row.id}
            columns={columns}
            renderExpandedRow={renderProductLocations}
            isLoading={isLoading}
            loadingMessage="Loading inventory catalog items..."
            pagination={false}
            manualSorting
            tableClassName="min-w-[1100px] w-full"
            rowClassName={stockRowClassName}
          />
        )}
      <DataTableFooter {...productsQuery} rowCount={productsQuery.items.length} label="Product" />
      </DataTableFrame>

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
      <DataTableFooter {...query} rowCount={query.items.length} label="Stock location" />
      </>
    )
}
