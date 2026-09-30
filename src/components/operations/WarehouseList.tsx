import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Edit2,
  MapPin,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Warehouse as WarehouseIcon,
} from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import {
  useAllWarehouses,
  useDeactivateWarehouse,
  useReactivateWarehouse,
} from '@/features/logistics/warehouses.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { fetchStockByWarehouseApi } from '@/features/logistics/stock-items.api'
import { useAuth } from '@/features/auth/AuthContext'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import { getErrorMessage } from '@/lib/api-client'
import { WarehouseModal } from './WarehouseModal'
import { WarehouseInventory } from './WarehouseInventory'
import { formatStockCents, parseStockCents, stockSortKey } from '@/features/logistics/stock-display'

type WarehouseStockSummary = { products: number; units: bigint }
type ArchiveCheck = WarehouseStockSummary & {
  status: 'checking' | 'empty' | 'blocked' | 'error'
  error?: string
}

function summarizeWarehouseStock(items: StockItem[]): WarehouseStockSummary {
  let products = 0
  let units = 0n
  for (const item of items) {
    const quantity = parseStockCents(item.quantity)
    if (quantity === null) {
      throw new Error('The warehouse stock count could not be verified. Please try again.')
    }
    if (quantity > 0n) {
      products += 1
      units += quantity
    }
  }
  return { products, units }
}

export function WarehouseList({ initialWarehouseId }: { initialWarehouseId?: number | null } = {}) {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const warehousesQuery = useAllWarehouses()
  const stockQuery = useStockItems()
  const allWarehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data])
  const stockItems = useMemo(() => stockQuery.data ?? [], [stockQuery.data])
  const { isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<number | null>(initialWarehouseId ?? null)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [warehouseToArchive, setWarehouseToArchive] = useState<Warehouse | null>(null)
  const [archiveCheck, setArchiveCheck] = useState<ArchiveCheck | null>(null)
  const archiveRequestId = useRef(0)
  const deactivateMutation = useDeactivateWarehouse({
    onViewArchive: () => setActiveTab('ARCHIVED'),
  })
  const reactivateMutation = useReactivateWarehouse()

  const activeWarehouses = useMemo(
    () => allWarehouses.filter((warehouse) => warehouse.isActive !== false),
    [allWarehouses],
  )
  const archivedWarehouses = useMemo(
    () => allWarehouses.filter((warehouse) => warehouse.isActive === false),
    [allWarehouses],
  )
  const selectedWarehouse = allWarehouses.find((warehouse) => warehouse.id === selectedWarehouseId)
  const warehouseTotals = useMemo(() => {
    const totals = new Map<number, { products: number; units: bigint | null }>()
    for (const stock of stockItems) {
      const total = totals.get(stock.warehouseId) || { products: 0, units: 0n }
      const quantity = parseStockCents(stock.quantity)
      total.products += 1
      total.units = total.units === null || quantity === null ? null : total.units + quantity
      totals.set(stock.warehouseId, total)
    }
    return totals
  }, [stockItems])
  const getWarehouseUnits = (id: number): bigint | null => warehouseTotals.get(id)?.units === undefined
    ? 0n
    : warehouseTotals.get(id)!.units
  const filteredWarehouses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return (activeTab === 'ACTIVE' ? activeWarehouses : archivedWarehouses).filter(
      (warehouse) =>
        !term ||
        String(warehouse.name ?? '').toLowerCase().includes(term) ||
        String(warehouse.address ?? '').toLowerCase().includes(term) ||
        String(warehouse.contactNumber ?? '').toLowerCase().includes(term),
    )
  }, [activeTab, activeWarehouses, archivedWarehouses, searchTerm])

  const closeArchiveDialog = () => {
    if (deactivateMutation.isPending) return
    archiveRequestId.current += 1
    setWarehouseToArchive(null)
    setArchiveCheck(null)
  }

  const checkWarehouseBeforeArchive = async (warehouse: Warehouse) => {
    const requestId = ++archiveRequestId.current
    setWarehouseToArchive(warehouse)
    setArchiveCheck({ status: 'checking', products: 0, units: 0n })
    try {
      const summary = summarizeWarehouseStock(await fetchStockByWarehouseApi(warehouse.id))
      if (archiveRequestId.current !== requestId) return
      setArchiveCheck({ ...summary, status: summary.units > 0n ? 'blocked' : 'empty' })
    } catch (error) {
      if (archiveRequestId.current !== requestId) return
      setArchiveCheck({ status: 'error', products: 0, units: 0n, error: getErrorMessage(error) })
    }
  }

  const confirmArchive = async () => {
    const warehouse = warehouseToArchive
    if (!warehouse || archiveCheck?.status !== 'empty') return
    const requestId = ++archiveRequestId.current
    setArchiveCheck({ status: 'checking', products: 0, units: 0n })
    try {
      // Recheck immediately before the write so the confirmation cannot use stale list totals.
      const summary = summarizeWarehouseStock(await fetchStockByWarehouseApi(warehouse.id))
      if (archiveRequestId.current !== requestId) return
      if (summary.units > 0n) {
        setArchiveCheck({ ...summary, status: 'blocked' })
        return
      }
      await deactivateMutation.mutateAsync(warehouse.id)
      if (archiveRequestId.current === requestId) {
        archiveRequestId.current += 1
        setWarehouseToArchive(null)
        setArchiveCheck(null)
      }
    } catch (error) {
      if (archiveRequestId.current !== requestId) return
      setArchiveCheck({ status: 'error', products: 0, units: 0n, error: getErrorMessage(error) })
    }
  }

  const columns: ColumnDef<Warehouse>[] = [
    {
      id: 'name',
      header: 'Warehouse',
      width: '28%',
      sortable: true,
      sortKey: 'name',
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <WarehouseIcon className="size-4 shrink-0 text-primary" />
            <OverflowValue
              value={row.name}
              onActivate={() => setSelectedWarehouseId(row.id)}
              className="h-auto p-0 text-left text-xs font-bold"
            />
          </div>
          <div className="mt-1 flex min-w-0 items-center gap-2 pl-6 text-[11px] sm:hidden">
            <OverflowValue
              value={formatStockCents(getWarehouseUnits(row.id))}
              tooltipSuffix="units"
              className="max-w-[55%] font-semibold tabular-nums"
            />
            <Badge variant="outline" className="shrink-0 px-1.5 py-0 text-[10px]">
              {row.isActive === false ? 'Archived' : 'Active'}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      width: '24%',
      className: 'hidden lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      sortable: true,
      sortKey: 'address',
      cell: ({ row }) => (
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          <OverflowValue value={row.address} />
        </span>
      ),
    },
    {
      id: 'products',
      header: 'Products',
      width: '11%',
      className: 'hidden lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      align: 'right',
      sortable: true,
      sortKey: (row) => warehouseTotals.get(row.id)?.products || 0,
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center justify-end gap-1 text-xs font-semibold">
          <OverflowValue value={(warehouseTotals.get(row.id)?.products ?? 0).toLocaleString()} className="text-right tabular-nums" />
          <span className="shrink-0">products</span>
        </div>
      ),
    },
    {
      id: 'units',
      header: 'Total Stock',
      width: '13%',
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      align: 'right',
      sortable: true,
      sortKey: (row) => stockSortKey(getWarehouseUnits(row.id)),
      cell: ({ row }) => (
        <div className="flex min-w-0 items-center justify-end gap-1 text-xs font-semibold">
          <OverflowValue value={formatStockCents(getWarehouseUnits(row.id))} tooltipSuffix="units" className="text-right tabular-nums" />
          <span className="hidden shrink-0 xl:inline">units</span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: '9%',
      className: 'hidden sm:table-cell',
      headerClassName: 'hidden sm:table-cell',
      align: 'center',
      sortable: true,
      sortKey: 'isActive',
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={
            row.isActive === false
              ? 'text-amber-600 border-amber-500/30'
              : 'text-emerald-600 border-emerald-500/30'
          }
        >
          {row.isActive === false ? 'Archived' : 'Active'}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      width: '15%',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1 sm:gap-1.5">
          <Button
            size="sm"
            variant={row.isActive === false ? 'outline' : 'default'}
            onClick={() => setSelectedWarehouseId(row.id)}
            className="shrink-0 gap-1 px-2 font-semibold sm:px-3"
          >
            <span className="sm:hidden">View</span>
            <span className="hidden sm:inline">{row.isActive === false ? 'View Details' : 'View Inventory'}</span>
            <ArrowRight className="hidden size-3.5 lg:inline" />
          </Button>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Actions for ${row.name}`}
                  title="Warehouse actions"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {row.isActive === false ? (
                  <DropdownMenuItem
                    disabled={reactivateMutation.isPending}
                    onSelect={() => reactivateMutation.mutate(row.id)}
                  >
                    <RotateCcw className="mr-2 size-3.5" />
                    Restore Warehouse
                  </DropdownMenuItem>
                ) : (
                  <>
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditingWarehouse(row)
                        setIsModalOpen(true)
                      }}
                    >
                      <Edit2 className="mr-2 size-3.5" />
                      Edit Warehouse
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => void checkWarehouseBeforeArchive(row)}
                      className="text-destructive focus:text-destructive focus:bg-destructive/10"
                    >
                      <Archive className="mr-2 size-3.5" />
                      Archive Warehouse
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      ),
    },
  ]

  if (selectedWarehouse)
    return (
      <WarehouseInventory
        warehouse={selectedWarehouse}
        onBack={() => setSelectedWarehouseId(null)}
      />
    )

  if (warehousesQuery.isError || stockQuery.isError)
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive">
        Warehouses and stock could not be loaded: {getErrorMessage(warehousesQuery.error ?? stockQuery.error)}
        <Button variant="link" size="sm" onClick={() => {
          if (warehousesQuery.isError) void warehousesQuery.refetch()
          if (stockQuery.isError) void stockQuery.refetch()
        }}>Retry</Button>
      </div>
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="min-w-0 overflow-x-auto">
        <ArchiveTabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeLabel="Active Warehouses"
          activeCount={activeWarehouses.length}
          archivedLabel="Archived Warehouses"
          archivedCount={archivedWarehouses.length}
          activeIcon={<WarehouseIcon className="size-3.5" />}
          bannerDescription="Archived warehouses retain their inventory records and can be restored."
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            aria-label="Search warehouses"
            placeholder="Search warehouses or locations..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        {canManage && activeTab === 'ACTIVE' && (
          <Button
            size="sm"
            onClick={() => {
              setEditingWarehouse(null)
              setIsModalOpen(true)
            }}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Register Warehouse
          </Button>
        )}
      </div>
      <DataTable
        data={filteredWarehouses}
        columns={columns}
        rowClassName={() => 'hover:bg-primary/5 focus-within:bg-primary/5'}
        isLoading={warehousesQuery.isLoading || stockQuery.isLoading}
        loadingMessage="Loading warehouses..."
        emptyContent={
          searchTerm
            ? 'No warehouses match your search.'
            : activeTab === 'ACTIVE'
              ? 'No active warehouses yet.'
              : 'No archived warehouses.'
        }
        pageSizeOptions={[10, 25, 50, 100]}
        tableClassName="table-fixed w-full [&_td]:px-2 [&_th]:px-2 sm:[&_td]:px-3.5 sm:[&_th]:px-3.5"
      />
      <WarehouseModal
        warehouse={editingWarehouse}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <Dialog open={!!warehouseToArchive} onOpenChange={(open) => !open && closeArchiveDialog()}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader className="gap-2">
            <div
              className={`mb-1 flex size-11 items-center justify-center rounded-xl ${archiveCheck?.status === 'blocked' || archiveCheck?.status === 'error' ? 'bg-amber-500/10 text-amber-600' : 'bg-destructive/10 text-destructive'}`}
            >
              {archiveCheck?.status === 'checking' ? (
                <Spinner className="size-5" />
              ) : archiveCheck?.status === 'blocked' || archiveCheck?.status === 'error' ? (
                <AlertTriangle className="size-5" />
              ) : (
                <Archive className="size-5" />
              )}
            </div>
            <DialogTitle className="break-all">
              {archiveCheck?.status === 'blocked'
                ? 'Cannot Archive Warehouse'
                : archiveCheck?.status === 'error'
                  ? 'Cannot Verify Warehouse Stock'
                  : archiveCheck?.status === 'checking'
                    ? 'Checking warehouse inventory'
                    : `Archive ${warehouseToArchive?.name || 'warehouse'}?`}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed">
              {archiveCheck?.status === 'blocked'
                ? `${warehouseToArchive?.name} still contains inventory. Transfer or remove the remaining stock before archiving this warehouse.`
                : archiveCheck?.status === 'error'
                  ? 'Inventory could not be checked, so this warehouse cannot be archived yet.'
                  : archiveCheck?.status === 'checking'
                    ? 'Checking the current stock before archival...'
                    : 'This warehouse currently contains no inventory. New allocations will stop after archival, and historical records will remain available.'}
            </DialogDescription>
          </DialogHeader>
          {archiveCheck?.status === 'blocked' && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-foreground">
              <p className="break-all font-bold">{warehouseToArchive?.name}</p>
              <p className="mt-1">
                {archiveCheck.products} {archiveCheck.products === 1 ? 'product' : 'products'} ·{' '}
                {formatStockCents(archiveCheck.units)} units of inventory
              </p>
            </div>
          )}
          {archiveCheck?.status === 'error' && archiveCheck.error && (
            <p
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
            >
              {archiveCheck.error}
            </p>
          )}
          <DialogFooter className="gap-2 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeArchiveDialog}
              disabled={deactivateMutation.isPending}
            >
              Cancel
            </Button>
            {archiveCheck?.status === 'blocked' && warehouseToArchive && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setSelectedWarehouseId(warehouseToArchive.id)
                  closeArchiveDialog()
                }}
              >
                View Inventory <ArrowRight className="size-3.5" />
              </Button>
            )}
            {archiveCheck?.status === 'error' && warehouseToArchive && (
              <Button
                type="button"
                size="sm"
                onClick={() => void checkWarehouseBeforeArchive(warehouseToArchive)}
              >
                Retry Check
              </Button>
            )}
            {archiveCheck?.status === 'empty' && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => void confirmArchive()}
                disabled={deactivateMutation.isPending}
              >
                Archive Warehouse
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
