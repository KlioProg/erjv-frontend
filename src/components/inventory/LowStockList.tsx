import { useState, useMemo } from 'react'
import {
  AlertTriangle,
  Boxes,
  Warehouse as WarehouseIcon,
  Search,
  CheckCircle2,
  Package,
  Tag,
  Flame,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useProducts } from '@/features/products/products.hooks'
import type { InventoryItemSummary, StockItemWithRelations, WarehouseSummary } from '@/features/logistics/stock-items.types'
import { getErrorMessage } from '@/lib/api-client'

type LowStockSeverity = 'OUT' | 'CRITICAL' | 'LOW'

interface EnrichedLowStockRecord extends StockItemWithRelations {
  quantityNum: number
  enrichedProduct?: InventoryItemSummary
  enrichedWarehouse?: WarehouseSummary
  severity: LowStockSeverity
}

export function LowStockList() {
  const stockQuery = useStockItems()
  const warehousesQuery = useWarehouses()
  const productsQuery = useProducts()
  const stockItems = useMemo(() => stockQuery.data ?? [], [stockQuery.data])
  const warehouses = useMemo(() => warehousesQuery.data ?? [], [warehousesQuery.data])
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data])

  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('ALL')
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'OUT' | 'CRITICAL' | 'LOW'>('ALL')
  const [threshold, setThreshold] = useState<number>(20)

  // Products map for faster lookup
  const productsMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const warehouseMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses])

  // Filter low stock records
  const lowStockRecords = useMemo<EnrichedLowStockRecord[]>(() => {
    return stockItems
      .filter((item) => parseFloat(item.quantity || '0') <= threshold)
      .map((item) => {
        const qty = parseFloat(item.quantity || '0')
        const prod = productsMap.get(item.inventoryItemId) || item.inventoryItem
        const wh = warehouseMap.get(item.warehouseId) || item.warehouse

        let severity: LowStockSeverity = 'LOW'
        if (qty <= 0) {
          severity = 'OUT'
        } else if (qty <= 10) {
          severity = 'CRITICAL'
        } else if (qty <= threshold) {
          severity = 'LOW'
        }

        return {
          ...item,
          quantityNum: qty,
          enrichedProduct: prod,
          enrichedWarehouse: wh,
          severity,
        }
      })
  }, [stockItems, productsMap, warehouseMap, threshold])

  // Aggregate KPI counts
  const kpis = useMemo(() => {
    let outCount = 0
    let criticalCount = 0
    let lowCount = 0
    const impactedWarehouses = new Set<number>()

    lowStockRecords.forEach((item) => {
      impactedWarehouses.add(item.warehouseId)
      if (item.severity === 'OUT') outCount++
      else if (item.severity === 'CRITICAL') criticalCount++
      else if (item.severity === 'LOW') lowCount++
    })

    return {
      outCount,
      criticalCount,
      lowCount,
      totalAlerts: lowStockRecords.length,
      impactedWarehousesCount: impactedWarehouses.size,
    }
  }, [lowStockRecords])

  // Apply filters
  const filteredRecords = useMemo(() => {
    return lowStockRecords.filter((item) => {
      const prodName = item.enrichedProduct?.name?.toLowerCase() || ''
      const prodVariety = item.enrichedProduct?.variety?.toLowerCase() || ''
      const matchesSearch =
        prodName.includes(searchTerm.toLowerCase()) ||
        prodVariety.includes(searchTerm.toLowerCase())

      const matchesWarehouse =
        selectedWarehouseId === 'ALL' || String(item.warehouseId) === selectedWarehouseId

      const matchesSeverity = severityFilter === 'ALL' || item.severity === severityFilter

      return matchesSearch && matchesWarehouse && matchesSeverity
    })
  }, [lowStockRecords, searchTerm, selectedWarehouseId, severityFilter])

  const isLoading = stockQuery.isLoading || warehousesQuery.isLoading || productsQuery.isLoading
  const loadError = stockQuery.error ?? warehousesQuery.error ?? productsQuery.error

  // Columns for the reusable DataTable
  const columns = useMemo<ColumnDef<EnrichedLowStockRecord>[]>(() => {
    return [
      {
        id: 'product',
        header: 'Item & Variety',
        sortable: true,
        sortKey: (row) => row.enrichedProduct?.name || '',
        cell: ({ row }) => {
          const prod = row.enrichedProduct
          const isOut = row.severity === 'OUT'
          const isCritical = row.severity === 'CRITICAL'

          return (
            <div className="flex items-start gap-3 py-0.5">
              <div
                className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                  isOut
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25'
                    : isCritical
                      ? 'bg-amber-500/15 text-amber-600 dark:text-[#ffb627] border border-amber-500/25'
                      : 'bg-primary/10 text-primary'
                }`}
              >
                <Package className="size-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground truncate">
                    {prod?.name || `Item #${row.inventoryItemId}`}
                  </span>
                  {prod?.variety && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 bg-muted/60 text-muted-foreground font-semibold"
                    >
                      <Tag className="size-2.5 mr-1 text-primary" />
                      {prod.variety}
                    </Badge>
                  )}
                </div>
                {prod?.unitPrice && (
                  <span className="text-[11px] text-muted-foreground mt-0.5">
                    ₱{Number(prod.unitPrice).toFixed(2)} wholesale
                  </span>
                )}
              </div>
            </div>
          )
        },
      },
      {
        id: 'warehouse',
        header: 'Warehouse Hub',
        sortable: true,
        sortKey: (row) => row.enrichedWarehouse?.name || '',
        cell: ({ row }) => {
          const wh = row.enrichedWarehouse
          return (
            <div>
              <div className="flex items-center gap-2">
                <WarehouseIcon className="size-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs font-semibold text-foreground">
                  {wh?.name || `Warehouse #${row.warehouseId}`}
                </span>
              </div>
              {wh?.address && (
                <span className="text-[10px] text-muted-foreground block truncate max-w-xs mt-0.5">
                  {wh.address}
                </span>
              )}
            </div>
          )
        },
      },
      {
        id: 'quantity',
        header: 'Current Balance',
        align: 'center',
        sortable: true,
        sortKey: 'quantityNum',
        cell: ({ row }) => {
          const isOut = row.severity === 'OUT'
          const isCritical = row.severity === 'CRITICAL'
          return (
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-1 font-extrabold rounded-xl ${
                isOut
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25'
                  : isCritical
                    ? 'bg-amber-500/10 text-amber-600 dark:text-[#ffb627] border-amber-500/25'
                    : 'bg-amber-500/[0.06] text-amber-600 dark:text-[#ffb627] border-amber-500/20'
              }`}
            >
              {row.quantityNum.toLocaleString()} units
            </Badge>
          )
        },
      },
      {
        id: 'urgency',
        header: 'Urgency Status',
        align: 'center',
        sortable: true,
        sortKey: 'severity',
        cell: ({ row }) => {
          const isOut = row.severity === 'OUT'
          const isCritical = row.severity === 'CRITICAL'
          return (
            <div className="inline-flex items-center justify-center">
              <span
                className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide border ${
                  isOut
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : isCritical
                      ? 'bg-amber-500/10 text-amber-600 dark:text-[#ffb627] border-amber-500/30'
                      : 'bg-amber-500/[0.06] text-amber-600 dark:text-[#ffb627] border-amber-500/20'
                }`}
              >
                {isOut ? (
                  <span className="relative flex size-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-rose-600" />
                  </span>
                ) : isCritical ? (
                  <span className="relative flex size-2 shrink-0">
                    <span className="inline-flex size-2 rounded-full bg-amber-500 animate-pulse" />
                  </span>
                ) : (
                  <span className="inline-flex size-2 rounded-full bg-amber-500/80 shrink-0" />
                )}
                <span className="whitespace-nowrap">
                  {isOut ? 'Out of Stock' : isCritical ? 'Critical Deficit' : 'Low Stock Buffer'}
                </span>
              </span>
            </div>
          )
        },
      },
    ]
  }, [])

  if (loadError) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive">
        Stock levels could not be loaded: {getErrorMessage(loadError)}
        <Button variant="link" size="sm" onClick={() => {
          if (stockQuery.isError) void stockQuery.refetch()
          if (warehousesQuery.isError) void warehousesQuery.refetch()
          if (productsQuery.isError) void productsQuery.refetch()
        }}>Retry</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Top Alert Metrics Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Card
          onClick={() => setSeverityFilter('OUT')}
          className={`p-4 border shadow-xs rounded-2xl cursor-pointer transition-all ${
            severityFilter === 'OUT'
              ? 'border-rose-500/50 bg-rose-500/10'
              : 'border-border/80 bg-card hover:border-rose-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Out of Stock</span>
            <div className="size-8 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-2xs">
              <Flame className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-rose-600 dark:text-rose-400">
              {kpis.outCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Zero units available</p>
          </div>
        </Card>

        <Card
          onClick={() => setSeverityFilter('CRITICAL')}
          className={`p-4 border shadow-xs rounded-2xl cursor-pointer transition-all ${
            severityFilter === 'CRITICAL'
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'border-border/80 bg-card hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Critical Level (≤10)</span>
            <div className="size-8 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-[#ffb627] flex items-center justify-center shadow-2xs">
              <AlertTriangle className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-amber-600 dark:text-[#ffb627]">
              {kpis.criticalCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Depletion imminent</p>
          </div>
        </Card>

        <Card
          onClick={() => setSeverityFilter('LOW')}
          className={`p-4 border shadow-xs rounded-2xl cursor-pointer transition-all ${
            severityFilter === 'LOW'
              ? 'border-amber-500/50 bg-amber-500/10'
              : 'border-border/80 bg-card hover:border-amber-500/30'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-foreground">Low Buffer (≤{threshold})</span>
            <div className="size-8 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-[#ffb627] flex items-center justify-center shadow-2xs">
              <Boxes className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-foreground">{kpis.lowCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Below replenishment threshold
            </p>
          </div>
        </Card>

        <Card className="p-4 border-border/80 bg-card shadow-xs rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Impacted Hubs</span>
            <div className="size-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-2xs">
              <WarehouseIcon className="size-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-foreground">
              {kpis.impactedWarehousesCount}{' '}
              <span className="text-xs font-normal text-muted-foreground">
                / {warehouses.length} facilities
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Warehouses with low items</p>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search low-stock product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>

          {/* Warehouse Facility Filter */}
          <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
            <SelectTrigger className="h-9 text-xs sm:w-52 rounded-xl">
              <SelectValue placeholder="All Warehouses" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="ALL" className="text-xs font-semibold">
                  All Warehouse Hubs
                </SelectItem>
                {warehouses.map((wh) => (
                  <SelectItem key={wh.id} value={String(wh.id)} className="text-xs">
                    {wh.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Severity Pill Filter */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <Button
              variant={severityFilter === 'ALL' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSeverityFilter('ALL')}
              className="h-8 text-xs font-semibold cursor-pointer rounded-xl"
            >
              All Alerts ({kpis.totalAlerts})
            </Button>
            <Button
              variant={severityFilter === 'OUT' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSeverityFilter('OUT')}
              className={`h-8 text-xs font-semibold cursor-pointer rounded-xl ${
                kpis.outCount > 0 ? 'text-rose-600' : ''
              }`}
            >
              Out of Stock ({kpis.outCount})
            </Button>
            <Button
              variant={severityFilter === 'CRITICAL' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setSeverityFilter('CRITICAL')}
              className={`h-8 text-xs font-semibold cursor-pointer rounded-xl ${
                kpis.criticalCount > 0 ? 'text-amber-600 dark:text-[#ffb627]' : ''
              }`}
            >
              Critical ({kpis.criticalCount})
            </Button>
          </div>
        </div>

        {/* Threshold setting */}
        <div className="flex items-center gap-2 self-end md:self-center">
          <span className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap">
            Alert Threshold:
          </span>
          <Select value={String(threshold)} onValueChange={(val) => setThreshold(Number(val))}>
            <SelectTrigger className="h-8 text-xs w-24 rounded-lg">
              <SelectValue placeholder="Threshold" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="10" className="text-xs">
                  ≤ 10 units
                </SelectItem>
                <SelectItem value="20" className="text-xs">
                  ≤ 20 units
                </SelectItem>
                <SelectItem value="30" className="text-xs">
                  ≤ 30 units
                </SelectItem>
                <SelectItem value="50" className="text-xs">
                  ≤ 50 units
                </SelectItem>
                <SelectItem value="100" className="text-xs">
                  ≤ 100 units
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Main Table View via reusable DataTable */}
      <DataTable
        data={filteredRecords}
        columns={columns}
        isLoading={isLoading}
        loadingMessage="Checking stock levels across facilities..."
        pagination={true}
        pageSizeOptions={[10, 25, 50]}
        rowClassName={(row) =>
          row.severity === 'OUT'
            ? 'bg-rose-500/[0.04]'
            : row.severity === 'CRITICAL'
              ? 'bg-amber-500/[0.04]'
              : ''
        }
        emptyContent={
          <Card className="border-dashed bg-emerald-500/5 border-emerald-500/20 rounded-2xl">
            <CardContent className="flex flex-col items-center justify-center py-14 text-center">
              <div className="size-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-3">
                <CheckCircle2 className="size-6" />
              </div>
              <h3 className="text-sm font-bold text-foreground">
                {kpis.totalAlerts === 0
                  ? 'All Inventory Stocks Healthy'
                  : 'No matching low-stock items'}
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                {kpis.totalAlerts === 0
                  ? `Every warehouse stock record is comfortably above the ${threshold}-unit threshold.`
                  : 'Try adjusting your search query, warehouse facility, or severity filter.'}
              </p>
            </CardContent>
          </Card>
        }
      />

    </div>
  )
}
