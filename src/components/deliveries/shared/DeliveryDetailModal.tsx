import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { Truck, Warehouse, Package, Calendar, User, MapPin } from 'lucide-react'
import { useOutgoingDeliveryById } from '@/features/logistics/outgoing-deliveries.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { DeliveryStatusBadge } from './DeliveryStatusBadge'
import { DeliveryTimeline } from './DeliveryTimeline'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

interface DeliveryDetailModalProps {
  deliveryId: number | null
  open: boolean
  onClose: () => void
}

export function DeliveryDetailModal({ deliveryId, open, onClose }: DeliveryDetailModalProps) {
  const { data: delivery, isLoading, error } = useOutgoingDeliveryById(deliveryId || undefined)
  const { data: warehouses = [] } = useWarehouses()
  const { data: vehicles = [] } = useDeliveryVehicles({ includeInactive: 'true' })
  const { data: employees = [] } = useEmployees({ includeInactive: 'true' })
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: clients = [] } = useClients()
  const { data: products = [] } = useProducts()

  const warehouse = warehouses.find((w) => w.id === delivery?.warehouseId)
  const vehicle = vehicles.find((v) => v.id === delivery?.deliveryVehicleId)
  const driver = employees.find((e) => e.id === delivery?.driverEmployeeId)
  const order = delivery ? salesOrders.find((o) => o.id === delivery.salesOrderId) : null
  const client = order ? clients.find((c) => c.id === order.clientId) : null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[min(880px,calc(100vh-2rem))] overflow-y-auto sm:max-w-2xl gap-5 p-6">
        <DialogHeader className="pb-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-2xs">
                <Truck className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight">
                  {delivery?.deliveryNumber || 'Delivery Details'}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Sales Order #{delivery?.salesOrderId || '—'}
                </DialogDescription>
              </div>
            </div>
            {delivery && <DeliveryStatusBadge status={delivery.status} />}
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-[260px] items-center justify-center">
            <Spinner className="size-8 text-primary" />
          </div>
        ) : error || !delivery ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center text-center text-xs text-muted-foreground">
            <p className="font-semibold text-destructive">Failed to load delivery record.</p>
            <p className="mt-1">The record may not exist or network connection was interrupted.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Customer & Destination Card */}
            {order && (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/80 text-xs">
                <MapPin className="size-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">
                      {client?.name || `Customer #${delivery.salesOrderId}`}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      Order #{order.orderNumber}
                    </span>
                  </div>
                  <span className="text-foreground/85 font-medium text-xs mt-0.5">
                    {order.deliveryAddress}
                  </span>
                </div>
              </div>
            )}

            {/* Timeline */}
            <DeliveryTimeline delivery={delivery} />

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/10">
                <Warehouse className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="flex flex-col text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Fulfillment Warehouse
                  </span>
                  <span className="font-bold text-foreground">
                    {warehouse?.name || `Warehouse #${delivery.warehouseId}`}
                  </span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {warehouse?.address || 'No location specified'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/10">
                <Truck className="size-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex flex-col text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Assigned Fleet Vehicle
                  </span>
                  <span className="font-bold text-foreground">
                    {vehicle ? `${vehicle.plateNumber} (${vehicle.vehicleType})` : 'Unassigned'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {vehicle?.model ? `${vehicle.model} • ` : ''}Capacity:{' '}
                    {vehicle?.capacity || 'Standard'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/10">
                <User className="size-4 text-purple-600 shrink-0 mt-0.5" />
                <div className="flex flex-col text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Assigned Driver / Logistics Officer
                  </span>
                  <span className="font-bold text-foreground">
                    {driver ? `${driver.firstName} ${driver.lastName}` : 'Unassigned'}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {driver?.phone || driver?.email || 'No contact listed'}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/10">
                <Calendar className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex flex-col text-xs">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground">
                    Target Scheduled Time
                  </span>
                  <span className="font-bold text-foreground">
                    {DeliveryUtils.formatDateTime(delivery.scheduledAt)}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Created: {DeliveryUtils.formatDateOnly(delivery.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            {/* Cargo Item Breakdown */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 overflow-hidden">
              <div className="bg-muted/30 px-4 py-2.5 border-b border-border/70 flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Package className="size-3.5 text-primary" />
                  Cargo Item Lines ({delivery.items.length})
                </span>
              </div>
              <div className="overflow-x-hidden">
                <table className="w-full table-fixed text-xs">
                  <thead className="bg-muted/20 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 w-[50%]">Item</th>
                      <th className="px-3 py-2 w-[25%]">Stock Allocation</th>
                      <th className="px-4 py-2 text-right w-[25%]">Quantity to Deliver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {delivery.items.map((item, index) => {
                      const orderItem = order?.items.find(
                        (oi) =>
                          oi.allocations.some((a) => a.id === item.salesOrderAllocationId) ||
                          oi.id === item.salesOrderAllocation?.salesOrderItemId,
                      )
                      const product = orderItem
                        ? products.find((p) => p.id === orderItem.inventoryItemId)
                        : null

                      return (
                        <tr key={item.id} className="hover:bg-muted/10">
                          <td className="px-4 py-2.5 font-medium text-foreground">
                            {product?.name || `Product Line #${index + 1}`}
                            {product?.variety && (
                              <span className="block text-[10px] text-muted-foreground">
                                Variety: {product.variety}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                            Alloc #{item.salesOrderAllocationId}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-bold text-right text-foreground">
                            {item.quantity} {product?.unit || 'units'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {delivery.notes && (
              <div className="p-3 rounded-xl bg-muted/20 border border-border/60 text-xs">
                <span className="text-[10px] font-bold uppercase text-muted-foreground block mb-1">
                  Delivery Notes
                </span>
                <p className="text-foreground whitespace-pre-wrap">{delivery.notes}</p>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
