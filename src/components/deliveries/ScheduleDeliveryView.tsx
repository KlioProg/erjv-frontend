import { useState } from 'react'
import {
  Plus,
  Calendar,
  Warehouse as WarehouseIcon,
  Clock,
  CheckCircle,
  Package,
  MapPin,
  CheckCircle2,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useOutgoingDeliveries,
  useScheduleOutgoingDelivery,
} from '@/features/logistics/outgoing-deliveries.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { ScheduleDeliveryModal } from './ScheduleDeliveryModal'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import { DeliveryStatusBadge } from './shared/DeliveryStatusBadge'
import { DeliveryNumberLookup } from './shared/DeliveryNumberLookup'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

export function ScheduleDeliveryView() {
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
  const [preselectedOrderId, setPreselectedOrderId] = useState<number | undefined>(undefined)
  const [inspectDeliveryId, setInspectDeliveryId] = useState<number | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL')

  const { data: deliveries = [], isLoading } = useOutgoingDeliveries()
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: clients = [] } = useClients()
  const { data: warehouses = [] } = useWarehouses()
  const { data: vehicles = [] } = useDeliveryVehicles({ includeInactive: 'true' })
  const scheduleMutation = useScheduleOutgoingDelivery()

  // Deliverable Orders awaiting delivery scheduling (only orders with unassigned remaining allocations)
  const deliverableOrders = salesOrders
    .filter((o) => o.status === 'CONFIRMED' || o.status === 'PARTIALLY_DELIVERED')
    .filter((order) => {
      const allAllocations = (order.items || []).flatMap((i) => i.allocations || [])
      if (allAllocations.length === 0) return true

      const totalAllocated = allAllocations.reduce(
        (sum, a) => sum + (parseFloat(a.quantity) || 0),
        0,
      )

      const allocationIds = new Set(allAllocations.map((a) => a.id))
      const activeAssigned = deliveries
        .filter((d) => d.status !== 'CANCELLED')
        .flatMap((d) => d.items)
        .filter((line) => allocationIds.has(line.salesOrderAllocationId))
        .reduce((sum, line) => sum + (parseFloat(line.quantity) || 0), 0)

      return totalAllocated > activeAssigned
    })

  // Filter deliveries that are in DRAFT or SCHEDULED (relevant to scheduling)
  const filteredDeliveries = deliveries
    .filter((d) => d.status === 'DRAFT' || d.status === 'SCHEDULED')
    .filter((d) => {
      if (searchTerm.trim()) {
        return d.deliveryNumber.toLowerCase().includes(searchTerm.toLowerCase().trim())
      }
      return true
    })
    .filter((d) => {
      if (selectedWarehouseFilter === 'ALL') return true
      return String(d.warehouseId) === selectedWarehouseFilter
    })

  const handleOpenScheduleForOrder = (orderId: number) => {
    setPreselectedOrderId(orderId)
    setIsScheduleModalOpen(true)
  }

  const handleOpenNewSchedule = () => {
    setPreselectedOrderId(undefined)
    setIsScheduleModalOpen(true)
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Section 1: Orders Ready for Delivery Scheduling */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Package className="size-4 text-primary shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Orders Ready for Delivery ({deliverableOrders.length})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confirmed customer orders with inventory stock ready to be scheduled for dispatch.
              </p>
            </div>
          </div>

          <Button
            onClick={handleOpenNewSchedule}
            className="gap-1.5 h-9 text-xs font-semibold shrink-0"
          >
            <Plus className="size-4" />
            Schedule New Delivery
          </Button>
        </div>

        {deliverableOrders.length === 0 ? (
          <Card className="flex min-h-[140px] items-center justify-center border-dashed bg-muted/20 shadow-xs rounded-xl">
            <div className="flex flex-col items-center justify-center text-center p-6">
              <CheckCircle2 className="size-7 text-emerald-600 mb-2" />
              <span className="text-xs font-semibold text-foreground">
                All confirmed orders have been scheduled!
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
                When new sales orders are confirmed in Customer Relations, they will appear here
                ready for delivery scheduling.
              </p>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden border-border/80 shadow-xs rounded-xl">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Order Number</TableHead>
                  <TableHead className="text-xs font-semibold">Client / Customer</TableHead>
                  <TableHead className="text-xs font-semibold">Delivery Destination</TableHead>
                  <TableHead className="text-xs font-semibold">Allocated Items</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliverableOrders.map((order) => {
                  const client = clients.find((c) => c.id === order.clientId)

                  return (
                    <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3.5 font-mono text-xs font-bold text-foreground">
                        {order.orderNumber}
                        <span className="block text-[10px] font-sans font-normal text-muted-foreground mt-0.5">
                          Ordered: {DeliveryUtils.formatDateOnly(order.orderedAt)}
                        </span>
                      </TableCell>

                      <TableCell className="py-3.5 text-xs text-foreground font-semibold">
                        {client?.name || `Client #${order.clientId}`}
                        {client?.contactPerson && (
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {client.contactPerson}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-rose-500 shrink-0" />
                          <span
                            className="truncate max-w-[220px] font-medium text-foreground/90"
                            title={order.deliveryAddress}
                          >
                            {order.deliveryAddress}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 text-xs font-mono text-foreground">
                        <span className="font-semibold">{(order.items || []).length}</span>{' '}
                        {(order.items || []).length === 1 ? 'item line' : 'item lines'}
                      </TableCell>

                      <TableCell className="py-3.5 text-right">
                        <Button
                          size="sm"
                          onClick={() => handleOpenScheduleForOrder(order.id)}
                          className="h-7 text-xs font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 px-3"
                        >
                          Schedule Delivery →
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Section 2: Recently Scheduled Shipments Log */}
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Recently Scheduled Shipments ({filteredDeliveries.length})
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shipments planned in Draft or Scheduled status awaiting warehouse departure.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <DeliveryNumberLookup
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Search delivery number..."
              className="w-full sm:w-64"
            />

            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-input bg-background text-xs text-foreground cursor-pointer"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={String(w.id)}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Spinner className="size-8 text-primary" />
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <Card className="flex min-h-[160px] items-center justify-center border-dashed bg-muted/20 shadow-xs rounded-xl">
            <div className="flex flex-col items-center justify-center text-center p-6">
              <Calendar className="size-7 text-muted-foreground/40 mb-2" />
              <span className="text-xs font-semibold text-foreground">
                No scheduled shipments found
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5 max-w-sm">
                Pick a confirmed order from above or click &quot;Schedule New Delivery&quot; to plan
                a shipment.
              </p>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden border-border/80 shadow-xs rounded-xl">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Delivery #</TableHead>
                  <TableHead className="text-xs font-semibold">Sales Order</TableHead>
                  <TableHead className="text-xs font-semibold">Warehouse</TableHead>
                  <TableHead className="text-xs font-semibold">Fleet Vehicle</TableHead>
                  <TableHead className="text-xs font-semibold">Target Schedule</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.map((delivery) => {
                  const warehouse = warehouses.find((w) => w.id === delivery.warehouseId)
                  const vehicle = vehicles.find((v) => v.id === delivery.deliveryVehicleId)
                  const order = salesOrders.find((o) => o.id === delivery.salesOrderId)
                  const client = order ? clients.find((c) => c.id === order.clientId) : null

                  return (
                    <TableRow key={delivery.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3.5 font-mono text-xs font-bold text-foreground">
                        <button
                          onClick={() => setInspectDeliveryId(delivery.id)}
                          className="hover:underline text-left text-primary font-bold cursor-pointer"
                        >
                          {delivery.deliveryNumber}
                        </button>
                        <span className="text-[10px] text-muted-foreground block font-sans font-normal mt-0.5">
                          {delivery.items.length} item{' '}
                          {delivery.items.length === 1 ? 'line' : 'lines'}
                        </span>
                      </TableCell>

                      <TableCell className="py-3.5 text-xs">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground truncate max-w-[180px]">
                            {client?.name || `Customer #${delivery.salesOrderId}`}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground">
                            Order #{order?.orderNumber || delivery.salesOrderId}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <WarehouseIcon className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="text-foreground/90">
                            {warehouse?.name || `Warehouse #${delivery.warehouseId}`}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="py-3.5 text-xs font-mono">
                        {vehicle ? (
                          <span className="font-semibold text-foreground">
                            {vehicle.plateNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground italic font-sans text-[11px]">
                            Unassigned
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                        {DeliveryUtils.formatDateTime(delivery.scheduledAt)}
                      </TableCell>

                      <TableCell className="py-3.5 text-center">
                        <DeliveryStatusBadge status={delivery.status} />
                      </TableCell>

                      <TableCell className="py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {delivery.status === 'DRAFT' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => scheduleMutation.mutate(delivery.id)}
                              disabled={scheduleMutation.isPending}
                              className="h-7 text-xs font-semibold gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                            >
                              <CheckCircle className="size-3" />
                              Confirm
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setInspectDeliveryId(delivery.id)}
                            className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            Details
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      {/* Schedule Modal */}
      {isScheduleModalOpen && (
        <ScheduleDeliveryModal
          open={isScheduleModalOpen}
          onClose={() => setIsScheduleModalOpen(false)}
          preselectedOrderId={preselectedOrderId}
        />
      )}

      {/* Detail Inspector Modal */}
      <DeliveryDetailModal
        deliveryId={inspectDeliveryId}
        open={Boolean(inspectDeliveryId)}
        onClose={() => setInspectDeliveryId(null)}
      />
    </div>
  )
}
