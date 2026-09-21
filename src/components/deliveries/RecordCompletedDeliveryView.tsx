import { useState } from 'react'
import { CheckCircle2, Truck, Package, Clock, MapPin, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useOutgoingDeliveries, useCompleteOutgoingDelivery } from '@/features/logistics/outgoing-deliveries.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import { DeliveryStatusBadge } from './shared/DeliveryStatusBadge'
import { DeliveryNumberLookup } from './shared/DeliveryNumberLookup'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

export function RecordCompletedDeliveryView() {
  const [searchTerm, setSearchTerm] = useState('')
  const [inspectDeliveryId, setInspectDeliveryId] = useState<number | null>(null)
  const [confirmCompleteId, setConfirmCompleteId] = useState<number | null>(null)

  const { data: deliveries = [], isLoading } = useOutgoingDeliveries()
  const { data: warehouses = [] } = useWarehouses()
  const { data: vehicles = [] } = useDeliveryVehicles({ includeInactive: 'true' })
  const { data: employees = [] } = useEmployees({ includeInactive: 'true' })
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: clients = [] } = useClients()

  const completeMutation = useCompleteOutgoingDelivery()

  // In-transit deliveries that are awaiting completion confirmation
  const inTransitDeliveries = deliveries
    .filter((d) => d.status === 'DISPATCHED')
    .filter((d) => {
      if (!searchTerm.trim()) return true
      const term = searchTerm.toLowerCase().trim()
      const order = salesOrders.find((o) => o.id === d.salesOrderId)
      const client = order ? clients.find((c) => c.id === order.clientId) : null
      return (
        d.deliveryNumber.toLowerCase().includes(term) ||
        String(d.salesOrderId).includes(term) ||
        (order && order.deliveryAddress.toLowerCase().includes(term)) ||
        (client && client.name.toLowerCase().includes(term))
      )
    })

  // Recently completed deliveries
  const completedDeliveries = deliveries
    .filter((d) => d.status === 'DELIVERED')
    .filter((d) => {
      if (!searchTerm.trim()) return true
      const term = searchTerm.toLowerCase().trim()
      const order = salesOrders.find((o) => o.id === d.salesOrderId)
      const client = order ? clients.find((c) => c.id === order.clientId) : null
      return (
        d.deliveryNumber.toLowerCase().includes(term) ||
        String(d.salesOrderId).includes(term) ||
        (order && order.deliveryAddress.toLowerCase().includes(term)) ||
        (client && client.name.toLowerCase().includes(term))
      )
    })

  const handleConfirmCompletion = async (deliveryId: number) => {
    try {
      await completeMutation.mutateAsync(deliveryId)
      setConfirmCompleteId(null)
    } catch {
      // Toast notification handled by hook
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner & Lookup */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
          <DeliveryNumberLookup
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search delivery #, customer, address, or order..."
            className="w-full sm:w-80"
          />
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse mr-1.5" />
            {inTransitDeliveries.length} In Transit
          </Badge>
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <CheckCircle2 className="size-3 mr-1 text-emerald-600" />
            {completedDeliveries.length} Delivered
          </Badge>
        </div>
      </div>

      {/* Section 1: Active In-Transit Shipments Awaiting Confirmation */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="size-4 text-amber-600" />
            <h3 className="text-sm font-bold text-foreground">
              Shipments In Transit Awaiting Arrival ({inTransitDeliveries.length})
            </h3>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[180px] items-center justify-center">
            <Spinner className="size-8 text-primary" />
          </div>
        ) : inTransitDeliveries.length === 0 ? (
          <Card className="flex min-h-[160px] items-center justify-center border-dashed bg-muted/20 shadow-xs rounded-xl">
            <div className="flex flex-col items-center justify-center text-center p-6">
              <CheckCircle2 className="size-7 text-emerald-600 mb-2" />
              <span className="text-xs font-semibold text-foreground">All shipments have arrived and are accounted for!</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                No fleet vehicles are currently pending delivery completion.
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {inTransitDeliveries.map((delivery) => {
              const warehouse = warehouses.find((w) => w.id === delivery.warehouseId)
              const vehicle = vehicles.find((v) => v.id === delivery.deliveryVehicleId)
              const driver = employees.find((e) => e.id === delivery.driverEmployeeId)
              const order = salesOrders.find((o) => o.id === delivery.salesOrderId)
              const client = order ? clients.find((c) => c.id === order.clientId) : null
              const isConfirming = confirmCompleteId === delivery.id

              return (
                <Card
                  key={delivery.id}
                  className="border-border/80 shadow-xs rounded-2xl p-5 flex flex-col justify-between gap-4 bg-card hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex flex-col gap-3">
                    {/* Header: Number, Status & Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-foreground">
                          {delivery.deliveryNumber}
                        </span>
                        <DeliveryStatusBadge status={delivery.status} />
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        Dispatched: {DeliveryUtils.formatDateOnly(delivery.dispatchedAt)}
                      </span>
                    </div>

                    {/* Destination & Order */}
                    <div className="flex items-start gap-2.5 pt-1">
                      <MapPin className="size-4 text-rose-500 shrink-0 mt-0.5" />
                      <div className="flex flex-col text-xs min-w-0">
                        <span className="font-bold text-foreground text-sm truncate">
                          {client?.name || 'Customer Destination'}
                        </span>
                        <span className="font-medium text-foreground/80 truncate text-xs mt-0.5" title={order?.deliveryAddress}>
                          {order?.deliveryAddress || 'Client Delivery Address'}
                        </span>
                        <span className="text-[11px] text-muted-foreground mt-0.5">
                          Order #{delivery.salesOrderId} • Origin: {warehouse?.name || `Warehouse #${delivery.warehouseId}`}
                        </span>
                      </div>
                    </div>

                    {/* Fleet & Personnel Summary Tags */}
                    <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
                      {vehicle && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/50 text-[11px] font-mono">
                          <Truck className="size-3 text-blue-600 shrink-0" />
                          <span className="font-bold text-foreground">{vehicle.plateNumber}</span>
                          <span className="text-muted-foreground font-sans">({vehicle.vehicleType})</span>
                        </div>
                      )}

                      {driver && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/40 border border-border/50 text-[11px]">
                          <User className="size-3 text-purple-600 shrink-0" />
                          <span className="text-foreground/90 font-medium">
                            {driver.firstName} {driver.lastName}
                          </span>
                        </div>
                      )}

                      <button
                        onClick={() => setInspectDeliveryId(delivery.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-primary hover:underline ml-auto font-medium cursor-pointer"
                      >
                        <Package className="size-3" />
                        {delivery.items.length} cargo items
                      </button>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="pt-2 border-t border-border/50">
                    {isConfirming ? (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
                        <div className="flex-1 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                          Confirm arrival and record delivery?
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmCompleteId(null)}
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleConfirmCompletion(delivery.id)}
                          disabled={completeMutation.isPending}
                          className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {completeMutation.isPending ? 'Confirming...' : 'Yes, Delivered'}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setConfirmCompleteId(delivery.id)}
                        className="w-full gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs"
                      >
                        <CheckCircle2 className="size-4" />
                        Record Delivery as Completed
                      </Button>
                    )}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Section 2: Recently Completed Delivery Receipts Log */}
      <div className="flex flex-col gap-3 mt-4">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">
            Completed Delivery Receipts Log ({completedDeliveries.length})
          </h3>
        </div>

        {completedDeliveries.length === 0 ? (
          <Card className="flex min-h-[120px] items-center justify-center border-dashed bg-muted/20 shadow-xs rounded-xl">
            <span className="text-xs text-muted-foreground">No completed delivery receipts recorded yet.</span>
          </Card>
        ) : (
          <Card className="overflow-hidden border-border/80 shadow-xs rounded-xl">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Delivery #</TableHead>
                  <TableHead className="text-xs font-semibold">Delivered At</TableHead>
                  <TableHead className="text-xs font-semibold">Client & Order</TableHead>
                  <TableHead className="text-xs font-semibold">Vehicle</TableHead>
                  <TableHead className="text-xs font-semibold">Driver</TableHead>
                  <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedDeliveries.slice(0, 10).map((delivery) => {
                  const vehicle = vehicles.find((v) => v.id === delivery.deliveryVehicleId)
                  const driver = employees.find((e) => e.id === delivery.driverEmployeeId)
                  const order = salesOrders.find((o) => o.id === delivery.salesOrderId)
                  const client = order ? clients.find((c) => c.id === order.clientId) : null

                  return (
                    <TableRow key={delivery.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="py-3.5 font-mono text-xs font-bold text-foreground">
                        {delivery.deliveryNumber}
                      </TableCell>
                      <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                        {DeliveryUtils.formatDateTime(delivery.deliveredAt)}
                      </TableCell>
                      <TableCell className="py-3.5 text-xs text-foreground">
                        <span className="font-semibold block truncate max-w-[180px]">
                          {client?.name || `Customer #${delivery.salesOrderId}`}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          Order #{delivery.salesOrderId}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 text-xs font-mono">
                        {vehicle?.plateNumber || '—'}
                      </TableCell>
                      <TableCell className="py-3.5 text-xs text-muted-foreground">
                        {driver ? `${driver.firstName} ${driver.lastName}` : '—'}
                      </TableCell>
                      <TableCell className="py-3.5 text-center">
                        <DeliveryStatusBadge status={delivery.status} />
                      </TableCell>
                      <TableCell className="py-3.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setInspectDeliveryId(delivery.id)}
                          className="h-7 text-xs font-medium text-primary hover:bg-primary/10"
                        >
                          View Receipt
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

      {/* Detailed Receipt Modal */}
      <DeliveryDetailModal
        deliveryId={inspectDeliveryId}
        open={Boolean(inspectDeliveryId)}
        onClose={() => setInspectDeliveryId(null)}
      />
    </div>
  )
}
