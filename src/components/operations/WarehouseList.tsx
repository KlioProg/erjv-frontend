import { useState } from 'react'
import {
  Warehouse as WarehouseIcon,
  MapPin,
  Phone,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Boxes,
  CheckCircle2,
  Archive,
  RotateCcw,
} from 'lucide-react'
import { ArchiveTabNav } from '@/components/ui/ArchiveTabNav'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useAllWarehouses,
  useDeactivateWarehouse,
  useReactivateWarehouse,
} from '@/features/logistics/warehouses.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { WarehouseModal } from './WarehouseModal'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export function WarehouseList() {
  const [activeTab, setActiveTab] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const { data: allWarehouses = [], isLoading } = useAllWarehouses()
  const { data: stockItems = [] } = useStockItems()
  const deactivateMutation = useDeactivateWarehouse({ onViewArchive: () => setActiveTab('ARCHIVED') })
  const reactivateMutation = useReactivateWarehouse()
  const { isOwner, isAdmin } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [warehouseToArchive, setWarehouseToArchive] = useState<Warehouse | null>(null)

  const activeWarehouses = allWarehouses.filter((w) => w.isActive !== false)
  const archivedWarehouses = allWarehouses.filter((w) => w.isActive === false)

  const currentList = activeTab === 'ACTIVE' ? activeWarehouses : archivedWarehouses

  const filteredWarehouses = currentList.filter(
    (w) =>
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.contactNumber && w.contactNumber.includes(searchTerm)),
  )

  const handleCreate = () => {
    setSelectedWarehouse(null)
    setIsModalOpen(true)
  }

  const handleEdit = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse)
    setIsModalOpen(true)
  }

  const handleArchive = (warehouse: Warehouse) => {
    setWarehouseToArchive(warehouse)
  }

  const confirmArchive = async () => {
    if (warehouseToArchive) {
      const wh = warehouseToArchive
      setWarehouseToArchive(null)
      await deactivateMutation.mutateAsync(wh.id)
    }
  }

  const handleRestore = (warehouse: Warehouse) => {
    reactivateMutation.mutate(warehouse.id)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Overview & Quick Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <WarehouseIcon className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">{allWarehouses.length}</div>
            <div className="text-[11px] text-muted-foreground font-medium">Total Facilities</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">{activeWarehouses.length}</div>
            <div className="text-[11px] text-muted-foreground font-medium">
              Active Distribution Hubs
            </div>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border/80 shadow-xs">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
            <Archive className="size-5" />
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">
              {archivedWarehouses.length}
            </div>
            <div className="text-[11px] text-muted-foreground font-medium">Archived Facilities</div>
          </div>
        </div>
      </div>

      {/* Warehouse Archive / Active Tabs */}
      <ArchiveTabNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeLabel="Active Hubs"
        activeCount={activeWarehouses.length}
        archivedLabel="Archived Facilities"
        archivedCount={archivedWarehouses.length}
        activeIcon={<WarehouseIcon className="size-3.5" />}
        bannerDescription="Showing archived warehouse facilities. Stored stock items and location addresses are safely preserved and can be reactivated anytime."
      />

      {/* Header with Search and New Warehouse Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search warehouses & distribution depots..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        {(isOwner || isAdmin) && activeTab === 'ACTIVE' && (
          <Button
            onClick={handleCreate}
            size="sm"
            className="gap-1.5 shadow-xs font-semibold cursor-pointer"
          >
            <Plus className="size-4" />
            Register Warehouse
          </Button>
        )}
      </div>

      {/* Warehouse Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Spinner className="mr-2 size-5" /> Loading warehouse locations...
        </div>
      ) : filteredWarehouses.length === 0 ? (
        <Card className="border-dashed bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            {activeTab === 'ARCHIVED' ? (
              <>
                <Archive className="size-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No archived warehouses</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  When you archive a warehouse facility, its data and stored stocks are safely
                  preserved here and can be restored anytime.
                </p>
              </>
            ) : (
              <>
                <WarehouseIcon className="size-10 text-muted-foreground/50 mb-3" />
                <h3 className="text-sm font-semibold text-foreground">
                  No active warehouses found
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {searchTerm
                    ? 'No active facilities matched your search query.'
                    : archivedWarehouses.length > 0
                      ? `All warehouse hubs are currently archived (${archivedWarehouses.length} total).`
                      : 'Register your central logistics complex, regional depots, and fulfillment hubs.'}
                </p>
                {!searchTerm && archivedWarehouses.length > 0 && (
                  <Button
                    onClick={() => setActiveTab('ARCHIVED')}
                    size="sm"
                    variant="outline"
                    className="mt-3 gap-1.5 cursor-pointer text-xs"
                  >
                    <Archive className="size-3.5 text-amber-600" />
                    View Archived Facilities ({archivedWarehouses.length})
                  </Button>
                )}
                {(isOwner || isAdmin) && !searchTerm && archivedWarehouses.length === 0 && (
                  <Button
                    onClick={handleCreate}
                    size="sm"
                    variant="outline"
                    className="mt-4 gap-1.5 cursor-pointer"
                  >
                    <Plus className="size-3.5" />
                    Register First Warehouse
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWarehouses.map((wh) => {
            const whStock = stockItems.filter((s) => s.warehouseId === wh.id)
            const totalUnits = whStock.reduce((acc, s) => acc + parseFloat(s.quantity), 0)
            const isArchived = wh.isActive === false

            return (
              <Card
                key={wh.id}
                className={`group relative overflow-hidden transition-all duration-200 hover:shadow-md border-border/80 rounded-2xl ${
                  isArchived ? 'opacity-85 bg-muted/30 border-dashed' : 'hover:border-primary/40'
                }`}
              >
                <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform ${
                          isArchived
                            ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-primary/10 text-primary group-hover:scale-105'
                        }`}
                      >
                        <WarehouseIcon className="size-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground leading-tight">
                          {wh.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
                          <MapPin className="size-3 shrink-0" />
                          <span className="line-clamp-1">{wh.address}</span>
                        </div>
                      </div>
                    </div>

                    {(isOwner || isAdmin) && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <MoreVertical className="size-4" />
                            <span className="sr-only">Warehouse actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {!isArchived ? (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleEdit(wh)}
                                className="gap-2 text-xs cursor-pointer"
                              >
                                <Edit2 className="size-3.5" />
                                Edit Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleArchive(wh)}
                                className="gap-2 text-xs text-amber-600 focus:text-amber-700 cursor-pointer"
                              >
                                <Archive className="size-3.5" />
                                Archive Warehouse
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => handleRestore(wh)}
                              className="gap-2 text-xs text-emerald-600 focus:text-emerald-700 font-bold cursor-pointer"
                            >
                              <RotateCcw className="size-3.5" />
                              Restore Facility
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Metrics & Stored Units */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Preserved Stock
                      </span>
                      <div className="flex items-center gap-1.5 font-extrabold text-foreground text-sm">
                        <Boxes className="size-3.5 text-primary" />
                        <span>
                          {totalUnits.toLocaleString()}{' '}
                          <span className="text-xs font-medium text-muted-foreground">units</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Tracked Products
                      </span>
                      <span className="font-semibold text-foreground text-xs">
                        {whStock.length} Products
                      </span>
                    </div>
                  </div>

                  {/* Contact & Status Bar with Direct Action */}
                  <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3" />
                      <span>{wh.contactNumber || 'No phone set'}</span>
                    </div>

                    {isArchived ? (
                      (isOwner || isAdmin) && (() => {
                        const isRestoringThis =
                          reactivateMutation.isPending &&
                          (typeof reactivateMutation.variables === 'number'
                            ? reactivateMutation.variables === wh.id
                            : (reactivateMutation.variables as Warehouse | undefined)?.id === wh.id)

                        return (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRestore(wh)}
                            disabled={isRestoringThis}
                            className="h-8 px-3.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 hover:bg-emerald-500/25 active:scale-95 border border-emerald-500/30 rounded-xl gap-2 shadow-2xs cursor-pointer transition-all duration-150 ml-auto"
                          >
                            {isRestoringThis ? (
                              <Spinner className="size-3.5 text-emerald-600 animate-spin" />
                            ) : (
                              <RotateCcw className="size-3.5 transition-transform duration-200 group-hover:-rotate-45" />
                            )}
                            <span>{isRestoringThis ? 'Restoring...' : 'Restore Facility'}</span>
                          </Button>
                        )
                      })()
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold gap-1"
                      >
                        <CheckCircle2 className="size-2.5" />
                        Active Hub
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Main Warehouse Modal */}
      <WarehouseModal
        warehouse={selectedWarehouse}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Archive / Soft-Delete Confirmation Modal */}
      <ConfirmDeleteModal
        open={!!warehouseToArchive}
        onClose={() => setWarehouseToArchive(null)}
        onConfirm={confirmArchive}
        title="Archive Warehouse Facility"
        description="Are you sure you want to archive this warehouse facility? All stored inventory counts, address information, and past logs are safely preserved. You can restore this facility at any time from the Archived Facilities tab."
        itemName={warehouseToArchive?.name}
        itemDetails={warehouseToArchive ? `Address: ${warehouseToArchive.address}` : undefined}
        confirmText="Archive Warehouse"
        variant="destructive"
      />
    </div>
  )
}
