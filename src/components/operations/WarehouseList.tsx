import { useState } from 'react'
import {
  Warehouse as WarehouseIcon,
  MapPin,
  Phone,
  Plus,
  Search,
  MoreVertical,
  Edit2,
  Trash2,
  Boxes,
  CheckCircle2,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useDeactivateWarehouse,
  useWarehouses,
} from '@/features/logistics/warehouses.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useAuth } from '@/features/auth/AuthContext'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import { WarehouseModal } from './WarehouseModal'

import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'

export function WarehouseList() {
  const { data: warehouses = [], isLoading } = useWarehouses()
  const { data: stockItems = [] } = useStockItems()
  const deactivateMutation = useDeactivateWarehouse()
  const { isOwner, isAdmin } = useAuth()

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouse, setSelectedWarehouse] = useState<Warehouse | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [warehouseToDeactivate, setWarehouseToDeactivate] = useState<Warehouse | null>(null)

  const filteredWarehouses = warehouses.filter(
    (w) =>
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.contactNumber && w.contactNumber.includes(searchTerm))
  )

  const handleCreate = () => {
    setSelectedWarehouse(null)
    setIsModalOpen(true)
  }

  const handleEdit = (warehouse: Warehouse) => {
    setSelectedWarehouse(warehouse)
    setIsModalOpen(true)
  }

  const handleDeactivate = (warehouse: Warehouse) => {
    setWarehouseToDeactivate(warehouse)
  }

  const confirmDeactivate = async () => {
    if (warehouseToDeactivate) {
      await deactivateMutation.mutateAsync(warehouseToDeactivate.id)
      setWarehouseToDeactivate(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
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

        {(isOwner || isAdmin) && (
          <Button onClick={handleCreate} size="sm" className="gap-1.5 shadow-xs font-semibold">
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
            <WarehouseIcon className="size-10 text-muted-foreground/50 mb-3" />
            <h3 className="text-sm font-semibold text-foreground">No warehouses found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm
                ? 'No warehouse facilities matched your search terms.'
                : 'Register your central logistics complex, regional depots, and fulfillment hubs.'}
            </p>
            {(isOwner || isAdmin) && !searchTerm && (
              <Button onClick={handleCreate} size="sm" variant="outline" className="mt-4 gap-1.5">
                <Plus className="size-3.5" />
                Register First Warehouse
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredWarehouses.map((wh) => {
            const whStock = stockItems.filter((s) => s.warehouseId === wh.id)
            const totalUnits = whStock.reduce((acc, s) => acc + parseFloat(s.quantity), 0)

            return (
              <Card
                key={wh.id}
                className="group relative overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/40 border-border/80 rounded-2xl"
              >
                <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
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
                            className="size-7 text-muted-foreground hover:text-foreground"
                          >
                            <MoreVertical className="size-4" />
                            <span className="sr-only">Warehouse actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(wh)} className="gap-2 text-xs">
                            <Edit2 className="size-3.5" />
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeactivate(wh)}
                            className="gap-2 text-xs text-destructive focus:text-destructive cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            Deactivate Warehouse
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>

                  {/* Metrics & Stored Units */}
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-border/60 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Stored Inventory
                      </span>
                      <div className="flex items-center gap-1.5 font-extrabold text-foreground text-sm">
                        <Boxes className="size-3.5 text-primary" />
                        <span>{totalUnits.toLocaleString()} <span className="text-xs font-medium text-muted-foreground">units</span></span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                        Allocated SKUs
                      </span>
                      <span className="font-semibold text-foreground text-xs">
                        {whStock.length} Product SKUs
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 text-[11px] text-muted-foreground border-t border-border/40">
                    <div className="flex items-center gap-1.5">
                      <Phone className="size-3" />
                      <span>{wh.contactNumber || 'No phone set'}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-semibold gap-1">
                      <CheckCircle2 className="size-2.5" />
                      Active Hub
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <WarehouseModal
        warehouse={selectedWarehouse}
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      <ConfirmDeleteModal
        open={!!warehouseToDeactivate}
        onClose={() => setWarehouseToDeactivate(null)}
        onConfirm={confirmDeactivate}
        title="Deactivate Warehouse Facility"
        description="Are you sure you want to deactivate this warehouse facility? Active stock allocations and transfers will be paused."
        itemName={warehouseToDeactivate?.name}
        itemDetails={warehouseToDeactivate ? `Address: ${warehouseToDeactivate.address}` : undefined}
        confirmText="Deactivate Warehouse"
        variant="destructive"
      />
    </div>
  )
}
