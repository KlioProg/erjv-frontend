import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  MapPin,
  MoreVertical,
  Package,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { StockAdjustModal } from './StockAdjustModal'
import { useAllProducts } from '@/features/products/products.hooks'
import { useDeleteStockItem, useWarehouseStock } from '@/features/logistics/stock-items.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { StockItemWithRelations } from '@/features/logistics/stock-items.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'

type AllocationRow = {
  stock: StockItemWithRelations
  product?: InventoryItemResponse
  quantity: number
  reserved: number
}

export function WarehouseInventory({
  warehouse,
  onBack,
}: {
  warehouse: Warehouse
  onBack: () => void
}) {
  const { data: stockItems = [], isLoading: isLoadingStock } = useWarehouseStock(warehouse.id)
  const { data: products = [], isLoading: isLoadingProducts } = useAllProducts()
  const { isAdmin, isManager } = useAuth()
  const canManage = (isAdmin || isManager) && warehouse.isActive !== false
  const deleteMutation = useDeleteStockItem()
  const [search, setSearch] = useState('')
  const [showProductPicker, setShowProductPicker] = useState(false)
  const [productSearch, setProductSearch] = useState('')
  const [allocateProduct, setAllocateProduct] = useState<InventoryItemResponse | null>(null)
  const [adjustStock, setAdjustStock] = useState<StockItemWithRelations | null>(null)
  const [removeStock, setRemoveStock] = useState<AllocationRow | null>(null)

  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  )
  const rows = useMemo<AllocationRow[]>(
    () =>
      stockItems.map((stock) => ({
        stock,
        product: productsById.get(stock.inventoryItemId),
        quantity: Number(stock.quantity) || 0,
        reserved: Number(stock.reservedQuantity) || 0,
      })),
    [stockItems, productsById],
  )
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(
      ({ stock, product }) =>
        (product?.name || stock.inventoryItem?.name || '').toLowerCase().includes(term) ||
        (product?.variety || stock.inventoryItem?.variety || '').toLowerCase().includes(term),
    )
  }, [rows, search])
  const allocatedIds = useMemo(
    () => new Set(rows.map(({ stock }) => stock.inventoryItemId)),
    [rows],
  )
  const availableProducts = useMemo(() => {
    const term = productSearch.trim().toLowerCase()
    return products.filter(
      (product) =>
        product.isActive !== false &&
        !allocatedIds.has(product.id) &&
        (!term ||
          product.name.toLowerCase().includes(term) ||
          (product.variety || '').toLowerCase().includes(term)),
    )
  }, [products, allocatedIds, productSearch])
  const visibleProducts = availableProducts.slice(0, 50)
  const totalUnits = rows.reduce((sum, row) => sum + row.quantity, 0)

  const columns = useMemo<ColumnDef<AllocationRow>[]>(
    () => [
      {
        id: 'product',
        header: 'Product',
        sortable: true,
        sortKey: (row) => row.product?.name || row.stock.inventoryItem?.name || '',
        cell: ({ row }) => (
          <div className="font-semibold text-xs">
            {row.product?.name ||
              row.stock.inventoryItem?.name ||
              `Product #${row.stock.inventoryItemId}`}
            {row.product?.variety && (
              <span className="block text-[11px] font-normal text-muted-foreground">
                {row.product.variety}
              </span>
            )}
          </div>
        ),
      },
      {
        id: 'unit',
        header: 'Unit',
        sortable: true,
        sortKey: (row) => row.product?.unit || row.stock.inventoryItem?.unit || '',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.product?.unit || row.stock.inventoryItem?.unit || '—'}
          </span>
        ),
      },
      {
        id: 'quantity',
        header: 'Quantity',
        align: 'right',
        sortable: true,
        sortKey: 'quantity',
        cell: ({ row }) => (
          <span className="text-xs font-bold">{row.quantity.toLocaleString()}</span>
        ),
      },
      {
        id: 'available',
        header: 'Available',
        align: 'right',
        sortable: true,
        sortKey: (row) => Math.max(0, row.quantity - row.reserved),
        cell: ({ row }) => (
          <span className="text-xs">
            {Math.max(0, row.quantity - row.reserved).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'Status',
        align: 'center',
        sortable: true,
        sortKey: (row) => (row.quantity <= 0 ? 0 : row.quantity <= 20 ? 1 : 2),
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.quantity <= 0
                ? 'text-rose-600 border-rose-500/30'
                : row.quantity <= 20
                  ? 'text-amber-600 border-amber-500/30'
                  : 'text-emerald-600 border-emerald-500/30'
            }
          >
            {row.quantity <= 0 ? 'Out of Stock' : row.quantity <= 20 ? 'Low Stock' : 'In Stock'}
          </Badge>
        ),
      },
      ...(canManage
        ? [
            {
              id: 'actions',
              header: 'Actions',
              align: 'right' as const,
              width: 90,
              cell: ({ row }: { row: AllocationRow }) => (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Actions for ${row.product?.name || row.stock.inventoryItem?.name}`}
                    >
                      <MoreVertical className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setAdjustStock(row.stock)}>
                      <SlidersHorizontal className="size-3.5 mr-2" />
                      Adjust quantity
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setRemoveStock(row)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-3.5 mr-2" />
                      Remove allocation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ),
            },
          ]
        : []),
    ],
    [canManage],
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-1 text-xs text-muted-foreground">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="-ml-2 h-7 gap-1 px-2 text-xs"
            >
              <ArrowLeft className="size-4" />
              Warehouses
            </Button>
            <ChevronRight className="size-3.5" />
            <span className="truncate font-semibold text-foreground">{warehouse.name}</span>
          </div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <WarehouseIcon className="size-5 text-primary" />
            {warehouse.name}
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" />
            {warehouse.address}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setShowProductPicker(true)} className="gap-1.5">
            <Plus className="size-4" />
            Allocate product
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/25 px-3 py-2 text-xs">
          <Boxes className="size-4 text-primary" />
          <span className="font-bold">{isLoadingStock ? '—' : totalUnits.toLocaleString()}</span>
          <span className="text-muted-foreground">units</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/80 bg-muted/25 px-3 py-2 text-xs">
          <Package className="size-4 text-primary" />
          <span className="font-bold">{isLoadingStock ? '—' : rows.length}</span>
          <span className="text-muted-foreground">products</span>
        </div>
        <Badge
          variant="outline"
          className={
            warehouse.isActive === false
              ? 'border-amber-500/30 text-amber-600'
              : 'border-emerald-500/30 text-emerald-600'
          }
        >
          {warehouse.isActive === false ? 'Archived · View only' : 'Active'}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-bold">Inventory in {warehouse.name}</h3>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            aria-label="Search warehouse products"
            placeholder="Search product or variety..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>
      <DataTable
        data={filteredRows}
        columns={columns}
        getRowKey={(row) => row.stock.id}
        isLoading={isLoadingStock || isLoadingProducts}
        loadingMessage="Loading warehouse inventory..."
        emptyContent={
          search
            ? 'No products match your search.'
            : 'No products are allocated to this warehouse yet.'
        }
        pageSizeOptions={[10, 25, 50, 100]}
      />

      <Dialog open={showProductPicker} onOpenChange={setShowProductPicker}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Allocate a product</DialogTitle>
            <DialogDescription>
              Choose a catalog product to stock at {warehouse.name}.
            </DialogDescription>
          </DialogHeader>
          <Input
            aria-label="Find a product to allocate"
            placeholder="Search product or variety..."
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
          />
          <div className="max-h-72 overflow-y-auto divide-y divide-border rounded-lg border">
            {availableProducts.length === 0 ? (
              <p className="p-4 text-xs text-muted-foreground">
                No unallocated products match your search.
              </p>
            ) : (
              visibleProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => {
                    setAllocateProduct(product)
                    setShowProductPicker(false)
                  }}
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/60"
                >
                  <Package className="size-4 text-primary" />
                  <span className="min-w-0 flex-1 text-xs font-semibold">{product.name}</span>
                  <span className="text-[11px] text-muted-foreground">{product.variety || ''}</span>
                </button>
              ))
            )}
          </div>
          {availableProducts.length > visibleProducts.length && (
            <p className="text-xs text-muted-foreground">
              Showing {visibleProducts.length} of {availableProducts.length} products. Search to
              narrow the list.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <StockAdjustModal
        open={!!allocateProduct}
        inventoryItem={allocateProduct}
        warehouseId={warehouse.id}
        onClose={() => setAllocateProduct(null)}
      />
      <StockAdjustModal
        open={!!adjustStock}
        stockItem={adjustStock}
        onClose={() => setAdjustStock(null)}
      />
      <ConfirmDeleteModal
        open={!!removeStock}
        onClose={() => setRemoveStock(null)}
        onConfirm={async () => {
          if (removeStock) {
            const id = removeStock.stock.id
            setRemoveStock(null)
            await deleteMutation.mutateAsync(id)
          }
        }}
        title="Remove warehouse allocation"
        description="Remove this product's allocation from this warehouse? If it has movement history, set the quantity to zero instead."
        itemName={removeStock?.product?.name || removeStock?.stock.inventoryItem?.name}
        confirmText="Remove allocation"
        variant="destructive"
      />
    </div>
  )
}
