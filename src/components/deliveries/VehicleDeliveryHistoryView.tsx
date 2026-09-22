import { useState, useMemo, useEffect } from 'react'
import {
  Truck,
  History,
  Eye,
  SlidersHorizontal,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  useDeliveryVehicles,
  useUpdateVehicleStatus,
} from '@/features/logistics/delivery-vehicles.hooks'
import { fetchVehicleByPlateNumberApi } from '@/features/logistics/delivery-vehicles.api'
import { useOutgoingDeliveries } from '@/features/logistics/outgoing-deliveries.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import type { DeliveryVehicle, VehicleStatus } from '@/features/logistics/delivery-vehicles.types'
import { VehicleStatusBadge } from './shared/VehicleStatusBadge'
import { DeliveryStatusBadge } from './shared/DeliveryStatusBadge'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

export function VehicleDeliveryHistoryView() {
  const { data: vehicles = [] } = useDeliveryVehicles({ includeInactive: 'true' })
  const { data: deliveries = [] } = useOutgoingDeliveries()
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: clients = [] } = useClients()
  const updateVehicleStatusMutation = useUpdateVehicleStatus()

  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(
    vehicles.length > 0 ? vehicles[0].id : null,
  )
  const [plateSearchTerm, setPlateSearchTerm] = useState<string>('')
  const [tripStatusFilter, setTripStatusFilter] = useState<string>('ALL')
  const [inspectDeliveryId, setInspectDeliveryId] = useState<number | null>(null)
  const [remoteVehicle, setRemoteVehicle] = useState<DeliveryVehicle | null>(null)

  const handlePlateSearchChange = (val: string) => {
    setPlateSearchTerm(val)
    if (!val.trim()) {
      setRemoteVehicle(null)
    }
  }

  useEffect(() => {
    const term = plateSearchTerm.trim().toUpperCase()
    if (!term) return

    const localMatch = vehicles.find((v) => v.plateNumber.toUpperCase().includes(term))
    if (!localMatch && term.length >= 3) {
      let active = true
      fetchVehicleByPlateNumberApi(term).then((res) => {
        if (active && res) {
          setRemoteVehicle(res)
          setSelectedVehicleId(res.id)
        }
      })
      return () => {
        active = false
      }
    }
  }, [plateSearchTerm, vehicles])

  const getClientName = (clientId?: number) => {
    if (!clientId) return '—'
    const client = clients.find((c) => c.id === clientId)
    return client ? client.name : `Client #${clientId}`
  }

  // Current selected vehicle
  const currentVehicle = useMemo(() => {
    if (plateSearchTerm.trim()) {
      const match = vehicles.find((v) =>
        v.plateNumber.toLowerCase().includes(plateSearchTerm.trim().toLowerCase()),
      )
      if (match) return match
      if (remoteVehicle) return remoteVehicle
    }
    if (selectedVehicleId) {
      return (
        vehicles.find((v) => v.id === selectedVehicleId) ||
        (remoteVehicle?.id === selectedVehicleId ? remoteVehicle : vehicles[0])
      )
    }
    return vehicles[0] || null
  }, [vehicles, selectedVehicleId, plateSearchTerm, remoteVehicle])

  // Deliveries executed by this specific vehicle
  const vehicleDeliveries = useMemo(() => {
    if (!currentVehicle) return []
    return deliveries.filter((d) => d.deliveryVehicleId === currentVehicle.id)
  }, [deliveries, currentVehicle])

  const filteredVehicleDeliveries = useMemo(() => {
    if (tripStatusFilter === 'ALL') return vehicleDeliveries
    return vehicleDeliveries.filter((d) => d.status === tripStatusFilter)
  }, [vehicleDeliveries, tripStatusFilter])

  // Vehicle Delivery Metrics
  const totalTrips = vehicleDeliveries.length
  const completedTrips = vehicleDeliveries.filter((d) => d.status === 'DELIVERED').length
  const inTransitTrips = vehicleDeliveries.filter((d) => d.status === 'DISPATCHED').length
  const cancelledTrips = vehicleDeliveries.filter((d) => d.status === 'CANCELLED').length

  const handleStatusChange = (newStatus: VehicleStatus) => {
    if (currentVehicle) {
      updateVehicleStatusMutation.mutate({ id: currentVehicle.id, status: newStatus })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Filter & Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-1">
          {/* Quick Vehicle Dropdown */}
          <select
            value={currentVehicle?.id ? String(currentVehicle.id) : ''}
            onChange={(e) => {
              setPlateSearchTerm('')
              setSelectedVehicleId(parseInt(e.target.value, 10))
            }}
            className="h-9 px-3 rounded-lg border border-input bg-background text-xs font-semibold text-foreground cursor-pointer"
          >
            {vehicles.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.plateNumber} — {v.vehicleType} ({v.status})
              </option>
            ))}
          </select>

          {/* Quick Search by Plate Number */}
          <Input
            type="text"
            value={plateSearchTerm}
            onChange={(e) => handlePlateSearchChange(e.target.value)}
            placeholder="Filter plate number..."
            className="w-48 h-9 text-xs font-mono uppercase"
          />
        </div>

        {currentVehicle && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Vehicle Status:</span>
            <select
              value={currentVehicle.status}
              onChange={(e) => handleStatusChange(e.target.value as VehicleStatus)}
              disabled={updateVehicleStatusMutation.isPending}
              className="h-8 px-2 rounded-lg border border-input bg-background text-xs font-bold text-foreground cursor-pointer"
            >
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="IN_DELIVERY">IN_DELIVERY</option>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="OUT_OF_SERVICE">OUT_OF_SERVICE</option>
            </select>
          </div>
        )}
      </div>

      {currentVehicle ? (
        <>
          {/* Vehicle Profile Card */}
          <Card className="border-border/80 shadow-xs rounded-2xl bg-card p-5 sm:p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="size-12 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                  <Truck className="size-6" />
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold font-mono tracking-tight text-foreground">
                      {currentVehicle.plateNumber}
                    </h2>
                    <VehicleStatusBadge status={currentVehicle.status} />
                    {!currentVehicle.isActive && (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        Archived
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {currentVehicle.vehicleType}
                    {currentVehicle.model ? ` • Model: ${currentVehicle.model}` : ''}
                    {currentVehicle.capacity ? ` • Capacity: ${currentVehicle.capacity} units` : ''}
                  </p>
                </div>
              </div>

              {/* Trip Metric Pills */}
              <div className="grid grid-cols-4 gap-2.5 text-center w-full md:w-auto">
                <div className="px-3.5 py-2 rounded-xl bg-muted/40 border border-border/50">
                  <div className="text-[11px] text-muted-foreground font-medium">Trips</div>
                  <div className="text-base font-bold text-foreground font-mono">{totalTrips}</div>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Delivered</div>
                  <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                    {completedTrips}
                  </div>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">In Transit</div>
                  <div className="text-base font-bold text-amber-700 dark:text-amber-400 font-mono">
                    {inTransitTrips}
                  </div>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium">Cancelled</div>
                  <div className="text-base font-bold text-rose-700 dark:text-rose-400 font-mono">
                    {cancelledTrips}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Delivery History Table */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-bold text-foreground">
                  Shipment Trip History ({filteredVehicleDeliveries.length})
                </h3>
              </div>

              {/* Trip Status Filter Buttons */}
              <div className="flex items-center gap-1">
                {['ALL', 'DELIVERED', 'DISPATCHED', 'CANCELLED'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setTripStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      tripStatusFilter === st
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {st === 'ALL' ? 'All Trips' : st}
                  </button>
                ))}
              </div>
            </div>

            {filteredVehicleDeliveries.length === 0 ? (
              <Card className="flex min-h-[160px] items-center justify-center border-dashed bg-muted/20 shadow-xs rounded-xl">
                <div className="flex flex-col items-center justify-center text-center p-6 text-xs text-muted-foreground">
                  <SlidersHorizontal className="size-6 text-muted-foreground/40 mb-1.5" />
                  <span className="font-semibold text-foreground">No trip records found for this filter</span>
                  <p className="mt-0.5">This vehicle has no recorded delivery shipments matching the filter.</p>
                </div>
              </Card>
            ) : (
              <Card className="overflow-hidden border-border/80 shadow-xs rounded-xl">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Delivery #</TableHead>
                      <TableHead className="text-xs font-semibold">Customer & Destination</TableHead>
                      <TableHead className="text-xs font-semibold">Dispatched At</TableHead>
                      <TableHead className="text-xs font-semibold">Delivered At</TableHead>
                      <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVehicleDeliveries.map((delivery) => {
                      const order = salesOrders.find((o) => o.id === delivery.salesOrderId)
                      const clientName = order ? getClientName(order.clientId) : '—'

                      return (
                        <TableRow key={delivery.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="py-3.5 font-mono text-xs font-bold text-foreground">
                            {delivery.deliveryNumber}
                            <span className="block text-[10px] font-sans text-muted-foreground font-normal mt-0.5">
                              {delivery.items.length} items cargo
                            </span>
                          </TableCell>

                          <TableCell className="py-3.5 text-xs">
                            <div className="flex flex-col">
                              <span className="font-semibold text-foreground truncate max-w-[220px]">
                                {clientName}
                              </span>
                              <span className="text-[11px] text-muted-foreground truncate max-w-[220px] mt-0.5">
                                {order?.deliveryAddress || 'Direct Destination'}
                              </span>
                              <span className="text-[10px] text-muted-foreground/70 font-mono">
                                Order #{delivery.salesOrderId}
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                            {DeliveryUtils.formatDateTime(delivery.dispatchedAt)}
                          </TableCell>

                          <TableCell className="py-3.5 text-xs text-muted-foreground font-mono">
                            {DeliveryUtils.formatDateTime(delivery.deliveredAt)}
                          </TableCell>

                          <TableCell className="py-3.5 text-center">
                            <DeliveryStatusBadge status={delivery.status} />
                          </TableCell>

                          <TableCell className="py-3.5 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setInspectDeliveryId(delivery.id)}
                              className="h-7 text-xs text-primary hover:bg-primary/10 gap-1"
                            >
                              <Eye className="size-3" />
                              Inspect
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
        </>
      ) : (
        <Card className="flex min-h-[220px] items-center justify-center border-dashed bg-muted/20 shadow-xs rounded-xl">
          <div className="flex flex-col items-center justify-center text-center p-6 text-xs text-muted-foreground">
            <Truck className="size-8 text-muted-foreground/40 mb-2" />
            <span className="font-semibold text-foreground">No fleet vehicles found</span>
            <p className="mt-1">Add vehicles to the fleet before viewing trip histories.</p>
          </div>
        </Card>
      )}

      {/* Inspector Modal */}
      <DeliveryDetailModal
        deliveryId={inspectDeliveryId}
        open={Boolean(inspectDeliveryId)}
        onClose={() => setInspectDeliveryId(null)}
      />
    </div>
  )
}
