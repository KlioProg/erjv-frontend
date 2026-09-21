import { useState } from 'react'
import {
  SlidersHorizontal,
  CheckCircle2,
  Clock,
  Send,
  XCircle,
  Warehouse,
  Truck,
  User,
  MapPin,
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
import { useOutgoingDeliveries, useScheduleOutgoingDelivery, useCompleteOutgoingDelivery, useCancelOutgoingDelivery } from '@/features/logistics/outgoing-deliveries.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import type {
  OutgoingDeliveryRecord,
  OutgoingDeliveryStatus,
} from '@/features/logistics/outgoing-deliveries.types'
import { DeliveryStatusBadge } from './shared/DeliveryStatusBadge'
import { DeliveryNumberLookup } from './shared/DeliveryNumberLookup'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import { DispatchDeliveryModal } from './shared/DispatchDeliveryModal'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

const STATUS_FILTERS: { key: string; label: string; status?: OutgoingDeliveryStatus }[] = [
  { key: 'ALL', label: 'All Shipments' },
  { key: 'SCHEDULED', label: 'Ready to Dispatch', status: 'SCHEDULED' },
  { key: 'DISPATCHED', label: 'In Transit', status: 'DISPATCHED' },
  { key: 'DRAFT', label: 'Drafts', status: 'DRAFT' },
  { key: 'DELIVERED', label: 'Delivered', status: 'DELIVERED' },
  { key: 'CANCELLED', label: 'Cancelled', status: 'CANCELLED' },
]

export function DeliveryStatusControlView() {
  const [selectedStatusTab, setSelectedStatusTab] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('ALL')
  const [inspectDeliveryId, setInspectDeliveryId] = useState<number | null>(null)
  const [dispatchDelivery, setDispatchDelivery] = useState<OutgoingDeliveryRecord | null>(null)

  const { data: deliveries = [], isLoading } = useOutgoingDeliveries()
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: clients = [] } = useClients()
  const { data: warehouses = [] } = useWarehouses()
  const { data: vehicles = [] } = useDeliveryVehicles({ includeInactive: 'true' })
  const { data: employees = [] } = useEmployees({ includeInactive: 'true' })

  const scheduleMutation = useScheduleOutgoingDelivery()
  const completeMutation = useCompleteOutgoingDelivery()
  const cancelMutation = useCancelOutgoingDelivery()

  // Filter deliveries based on status, search term, and warehouse
  const filteredDeliveries = deliveries
    .filter((d) => {
      if (selectedStatusTab === 'ALL') return true
      return d.status === selectedStatusTab
    })
    .filter((d) => {
      if (!searchTerm.trim()) return true
      const term = searchTerm.toLowerCase().trim()
      const order = salesOrders.find((o) => o.id === d.salesOrderId)
      return (
        d.deliveryNumber.toLowerCase().includes(term) ||
        String(d.salesOrderId).includes(term) ||
        (order && order.deliveryAddress.toLowerCase().includes(term))
      )
    })
    .filter((d) => {
      if (selectedWarehouseFilter === 'ALL') return true
      return String(d.warehouseId) === selectedWarehouseFilter
    })

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
          <DeliveryNumberLookup
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search delivery #, order #, or destination..."
            className="w-full sm:w-80"
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

      {/* Status Filter Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((tab) => {
          const isActive = selectedStatusTab === tab.key
          const count =
            tab.key === 'ALL'
              ? deliveries.length
              : deliveries.filter((d) => d.status === tab.key).length

          return (
            <button
              key={tab.key}
              onClick={() => setSelectedStatusTab(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer select-none flex items-center gap-1.5 ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Deliveries Table */}
      {isLoading ? (
        <div className="flex min-h-[260px] items-center justify-center">
          <Spinner className="size-8 text-primary" />
        </div>
      ) : filteredDeliveries.length === 0 ? (
        <Card className="flex min-h-[260px] items-center justify-center border-dashed bg-muted/20 shadow-xs rounded-xl">
          <div className="flex flex-col items-center justify-center text-center p-6">
            <SlidersHorizontal className="size-8 text-muted-foreground/40 mb-2" />
            <span className="text-sm font-semibold text-foreground">
              {searchTerm.trim() ? `No shipments match "${searchTerm.trim()}"` : 'No deliveries found'}
            </span>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Try selecting a different status filter tab or search term.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/80 shadow-xs rounded-xl">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold">Delivery #</TableHead>
                <TableHead className="text-xs font-semibold">Customer & Destination</TableHead>
                <TableHead className="text-xs font-semibold">Origin & Fleet</TableHead>
                <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeliveries.map((delivery) => {
                const warehouse = warehouses.find((w) => w.id === delivery.warehouseId)
                const vehicle = vehicles.find((v) => v.id === delivery.deliveryVehicleId)
                const driver = employees.find((e) => e.id === delivery.driverEmployeeId)
                const order = salesOrders.find((o) => o.id === delivery.salesOrderId)
                const client = order ? clients.find((c) => c.id === order.clientId) : null

                return (
                  <TableRow key={delivery.id} className="hover:bg-muted/30 transition-colors">
                    {/* Delivery & Timestamps */}
                    <TableCell className="py-3.5 font-mono text-xs font-bold text-foreground">
                      <button
                        onClick={() => setInspectDeliveryId(delivery.id)}
                        className="hover:underline text-left text-primary font-bold cursor-pointer block"
                      >
                        {delivery.deliveryNumber}
                      </button>
                      <span className="text-[10px] text-muted-foreground block font-sans font-normal mt-0.5">
                        {delivery.scheduledAt
                          ? `Sched: ${DeliveryUtils.formatDateOnly(delivery.scheduledAt)}`
                          : `Created: ${DeliveryUtils.formatDateOnly(delivery.createdAt)}`}
                      </span>
                    </TableCell>

                    {/* Customer & Destination */}
                    <TableCell className="py-3.5 text-xs text-foreground">
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground truncate max-w-[220px]">
                          {client?.name || `Customer #${delivery.salesOrderId}`}
                        </span>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                          <MapPin className="size-3 text-rose-500 shrink-0" />
                          <span className="truncate max-w-[200px]" title={order?.deliveryAddress}>
                            {order?.deliveryAddress || 'Client Delivery Address'}
                          </span>
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
                          Order #{delivery.salesOrderId} • {delivery.items.length} {delivery.items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </TableCell>

                    {/* Warehouse & Fleet */}
                    <TableCell className="py-3.5 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium flex items-center gap-1 text-foreground/90">
                          <Warehouse className="size-3.5 text-primary shrink-0" />
                          {warehouse?.name || `Warehouse #${delivery.warehouseId}`}
                        </span>
                        {vehicle ? (
                          <div className="flex items-center gap-1.5 font-mono text-[11px] mt-0.5">
                            <Truck className="size-3 text-blue-600 shrink-0" />
                            <span className="font-bold text-foreground">{vehicle.plateNumber}</span>
                            <span className="text-[10px] text-muted-foreground font-sans">({vehicle.vehicleType})</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-[11px] italic mt-0.5">Vehicle Unassigned</span>
                        )}

                        {driver && (
                          <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                            <User className="size-3 text-purple-600 shrink-0" />
                            <span>
                              {driver.firstName} {driver.lastName}
                            </span>
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* Current Status */}
                    <TableCell className="py-3.5 text-center">
                      <DeliveryStatusBadge status={delivery.status} />
                    </TableCell>

                    {/* Action Controls */}
                    <TableCell className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Step 1: Draft -> Schedule */}
                        {delivery.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => scheduleMutation.mutate(delivery.id)}
                            disabled={scheduleMutation.isPending}
                            className="h-7 text-xs font-semibold gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                          >
                            <Clock className="size-3" />
                            Confirm Schedule
                          </Button>
                        )}

                        {/* Step 2: Scheduled -> Dispatch */}
                        {delivery.status === 'SCHEDULED' && (
                          <Button
                            size="sm"
                            onClick={() => setDispatchDelivery(delivery)}
                            className="h-7 text-xs font-semibold gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            <Send className="size-3" />
                            Dispatch Vehicle →
                          </Button>
                        )}

                        {/* Step 3: Dispatched -> Complete */}
                        {delivery.status === 'DISPATCHED' && (
                          <Button
                            size="sm"
                            onClick={() => completeMutation.mutate(delivery.id)}
                            disabled={completeMutation.isPending}
                            className="h-7 text-xs font-semibold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            <CheckCircle2 className="size-3" />
                            Record Arrival
                          </Button>
                        )}

                        {/* Details Modal Trigger */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setInspectDeliveryId(delivery.id)}
                          className="h-7 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          Details
                        </Button>

                        {/* Cancel for active statuses */}
                        {DeliveryUtils.canCancel(delivery.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to cancel delivery shipment ${delivery.deliveryNumber}?`)) {
                                cancelMutation.mutate(delivery.id)
                              }
                            }}
                            disabled={cancelMutation.isPending}
                            className="h-7 px-1.5 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Cancel Delivery Shipment"
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Dispatch Modal */}
      {dispatchDelivery && (
        <DispatchDeliveryModal
          delivery={dispatchDelivery}
          open={Boolean(dispatchDelivery)}
          onClose={() => setDispatchDelivery(null)}
        />
      )}

      {/* Inspection Modal */}
      <DeliveryDetailModal
        deliveryId={inspectDeliveryId}
        open={Boolean(inspectDeliveryId)}
        onClose={() => setInspectDeliveryId(null)}
      />
    </div>
  )
}
