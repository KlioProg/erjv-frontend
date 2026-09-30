import { useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Edit2,
  MapPin,
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

type WarehouseStockSummary = { products: number; units: number }
type ArchiveCheck = WarehouseStockSummary & {
  status: 'checking' | 'empty' | 'blocked' | 'error'
  error?: string
}

function summarizeWarehouseStock(items: StockItem[]): WarehouseStockSummary {
  let products = 0
  let units = 0
  for (const item of items) {
    const quantity = Number(item.quantity)
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new Error('The warehouse stock count could not be verified. Please try again.')
    }
    if (quantity > 0) {
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
    const totals = new Map<number, { products: number; units: number }>()
    for (const stock of stockItems) {
      const total = totals.get(stock.warehouseId) || { products: 0, units: 0 }
      total.products += 1
      total.units += Number(stock.quantity) || 0
      totals.set(stock.warehouseId, total)
    }
    return totals
  }, [stockItems])
  const filteredWarehouses = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return (activeTab === 'ACTIVE' ? activeWarehouses : archivedWarehouses).filter(
      (warehouse) =>
        !term ||
        warehouse.name.toLowerCase().includes(term) ||
        warehouse.address.toLowerCase().includes(term) ||
        (warehouse.contactNumber || '').toLowerCase().includes(term),
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
    setArchiveCheck({ status: 'checking', products: 0, units: 0 })
    try {
      const summary = summarizeWarehouseStock(await fetchStockByWarehouseApi(warehouse.id))
      if (archiveRequestId.current !== requestId) return
      setArchiveCheck({ ...summary, status: summary.units > 0 ? 'blocked' : 'empty' })
    } catch (error) {
      if (archiveRequestId.current !== requestId) return
      setArchiveCheck({ status: 'error', products: 0, units: 0, error: getErrorMessage(error) })
    }
  }

  const confirmArchive = async () => {
    const warehouse = warehouseToArchive
    if (!warehouse || archiveCheck?.status !== 'empty') return
    const requestId = ++archiveRequestId.current
    setArchiveCheck({ status: 'checking', products: 0, units: 0 })
    try {
      // Recheck immediately before the write so the confirmation cannot use stale list totals.
      const summary = summarizeWarehouseStock(await fetchStockByWarehouseApi(warehouse.id))
      if (archiveRequestId.current !== requestId) return
      if (summary.units > 0) {
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
      setArchiveCheck({ status: 'error', products: 0, units: 0, error: getErrorMessage(error) })
    }
  }

  const columns: ColumnDef<Warehouse>[] = [
    {
      id: 'name',
      header: 'Warehouse',
      sortable: true,
      sortKey: 'name',
      cell: ({ row }) => (
        <Button
          variant="link"
          className="h-auto p-0 text-xs font-bold"
          onClick={() => setSelectedWarehouseId(row.id)}
        >
          <WarehouseIcon className="size-4 mr-2" />
          {row.name}
        </Button>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      sortable: true,
      sortKey: 'address',
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" />
          {row.address}
        </span>
      ),
    },
    {
      id: 'products',
      header: 'Products',
      align: 'right',
      sortable: true,
      sortKey: (row) => warehouseTotals.get(row.id)?.products || 0,
      cell: ({ row }) => (
        <span className="text-xs font-semibold">
          {warehouseTotals.get(row.id)?.products || 0} products
        </span>
      ),
    },
    {
      id: 'units',
      header: 'Total Stock',
      align: 'right',
      sortable: true,
      sortKey: (row) => warehouseTotals.get(row.id)?.units || 0,
      cell: ({ row }) => (
        <span className="text-xs font-semibold">
          {(warehouseTotals.get(row.id)?.units || 0).toLocaleString()} units
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
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
      width: 250,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1.5 min-w-max">
          <Button
            size="sm"
            variant={row.isActive === false ? 'outline' : 'default'}
            onClick={() => setSelectedWarehouseId(row.id)}
            className="gap-1.5 font-semibold"
          >
            {row.isActive === false ? 'View Details' : 'View Inventory'}
            <ArrowRight className="size-3.5" />
          </Button>
          {canManage &&
            (row.isActive === false ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => reactivateMutation.mutate(row.id)}
                disabled={reactivateMutation.isPending}
                className="gap-1.5"
              >
                <RotateCcw className="size-3.5" />
                Restore
              </Button>
            ) : (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Edit Warehouse"
                  title="Edit Warehouse"
                  onClick={() => {
                    setEditingWarehouse(row)
                    setIsModalOpen(true)
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Edit2 className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Archive Warehouse"
                  title="Archive Warehouse"
                  onClick={() => void checkWarehouseBeforeArchive(row)}
                  className="text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Archive className="size-3.5" />
                </Button>
              </>
            ))}
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
            <DialogTitle>
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
              <p className="font-bold">{warehouseToArchive?.name}</p>
              <p className="mt-1">
                {archiveCheck.products} {archiveCheck.products === 1 ? 'product' : 'products'} ·{' '}
                {archiveCheck.units.toLocaleString()} units of inventory
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
