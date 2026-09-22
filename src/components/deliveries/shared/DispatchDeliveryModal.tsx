import { useState, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Truck, User, Send, MapPin } from 'lucide-react'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import {
  useDispatchOutgoingDelivery,
  useOutgoingDeliveries,
} from '@/features/logistics/outgoing-deliveries.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

interface DispatchDeliveryModalProps {
  delivery: OutgoingDeliveryRecord | null
  open: boolean
  onClose: () => void
}

export function DispatchDeliveryModal({ delivery, open, onClose }: DispatchDeliveryModalProps) {
  const { data: vehicles = [] } = useDeliveryVehicles()
  const { data: deliveries = [] } = useOutgoingDeliveries()
  const { data: employees = [] } = useEmployees({ includeInactive: 'false' })
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: clients = [] } = useClients()
  const { data: warehouses = [] } = useWarehouses()
  const dispatchMutation = useDispatchOutgoingDelivery()

  const order = delivery ? salesOrders.find((o) => o.id === delivery.salesOrderId) : null
  const client = order ? clients.find((c) => c.id === order.clientId) : null
  const warehouse = delivery ? warehouses.find((w) => w.id === delivery.warehouseId) : null

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() =>
    delivery?.deliveryVehicleId ? String(delivery.deliveryVehicleId) : '',
  )
  const [selectedDriverId, setSelectedDriverId] = useState<string>(() =>
    delivery?.driverEmployeeId ? String(delivery.driverEmployeeId) : '',
  )
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [prevDeliveryId, setPrevDeliveryId] = useState<number | null>(delivery?.id ?? null)

  // Sync state during render when selected delivery changes
  if (delivery && delivery.id !== prevDeliveryId) {
    setPrevDeliveryId(delivery.id)
    setSelectedVehicleId(delivery.deliveryVehicleId ? String(delivery.deliveryVehicleId) : '')
    setSelectedDriverId(delivery.driverEmployeeId ? String(delivery.driverEmployeeId) : '')
    setErrorMessage('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!delivery) return

    const vehicleIdNum = parseInt(selectedVehicleId, 10)
    const driverIdNum = parseInt(selectedDriverId, 10)

    if (isNaN(vehicleIdNum) || vehicleIdNum <= 0) {
      setErrorMessage('Please assign an available delivery vehicle for transit.')
      return
    }

    if (isNaN(driverIdNum) || driverIdNum <= 0) {
      setErrorMessage('Please assign an active driver or logistics officer.')
      return
    }

    try {
      await dispatchMutation.mutateAsync({
        id: delivery.id,
        payload: {
          deliveryVehicleId: vehicleIdNum,
          driverEmployeeId: driverIdNum,
        },
      })
      onClose()
    } catch {
      // Handled by mutation toast
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md gap-5 p-6">
        <DialogHeader className="pb-1">
          <div className="flex size-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 shadow-2xs mb-1">
            <Send className="size-5" />
          </div>
          <DialogTitle className="text-lg font-bold tracking-tight">
            Dispatch Shipment to Transit
          </DialogTitle>
          <DialogDescription className="text-xs">
            Assign the fleet vehicle and driver for delivery shipment{' '}
            <span className="font-mono font-bold text-foreground">{delivery?.deliveryNumber}</span>.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {delivery && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/70 text-xs">
            <MapPin className="size-4 text-rose-500 shrink-0 mt-0.5" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-sm">
                  {client?.name || `Customer #${delivery.salesOrderId}`}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Order #{order?.orderNumber || delivery.salesOrderId}
                </span>
              </div>
              <span className="text-foreground/85 font-medium text-xs mt-0.5">
                {order?.deliveryAddress || 'Client Destination Address'}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">
                Origin: {warehouse?.name || `Warehouse #${delivery.warehouseId}`} •{' '}
                {delivery.items.length} items to transport
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dispatch-vehicle" className="text-xs font-semibold">
              Available Delivery Vehicle <span className="text-primary">*</span>
            </Label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger id="dispatch-vehicle" className="h-10 text-xs">
                <SelectValue placeholder="Choose available vehicle" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.length === 0 ? (
                  <SelectItem value="none" disabled>
                    No vehicles registered in fleet
                  </SelectItem>
                ) : (
                  vehicles.map((v) => {
                    const avail = DeliveryUtils.getVehicleAvailability(v, deliveries, delivery?.id)
                    return (
                      <SelectItem
                        key={v.id}
                        value={String(v.id)}
                        disabled={!avail.isAvailable}
                        className={
                          !avail.isAvailable ? 'opacity-50 cursor-not-allowed bg-muted/20' : ''
                        }
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          <span className="flex items-center gap-2 font-mono">
                            <Truck
                              className={`size-3.5 ${avail.isAvailable ? 'text-blue-600' : 'text-muted-foreground'}`}
                            />
                            <span
                              className={
                                avail.isAvailable
                                  ? 'font-bold text-foreground'
                                  : 'text-muted-foreground'
                              }
                            >
                              {v.plateNumber}
                            </span>
                            <span className="text-muted-foreground font-sans text-[11px]">
                              ({v.vehicleType}
                              {v.model ? ` • ${v.model}` : ''})
                            </span>
                          </span>
                          {avail.isAvailable ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Ready
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                              {avail.reason}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    )
                  })
                )}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Dispatching will set this vehicle's status to{' '}
              <span className="font-semibold text-amber-600">IN_DELIVERY</span>.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dispatch-driver" className="text-xs font-semibold">
              Assigned Driver / Logistics Officer <span className="text-primary">*</span>
            </Label>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger id="dispatch-driver" className="h-10 text-xs">
                <SelectValue placeholder="Choose active personnel" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => {
                  const avail = DeliveryUtils.getDriverAvailability(e, deliveries, delivery?.id)
                  return (
                    <SelectItem
                      key={e.id}
                      value={String(e.id)}
                      disabled={!avail.isAvailable}
                      className={
                        !avail.isAvailable ? 'opacity-50 cursor-not-allowed bg-muted/20' : ''
                      }
                    >
                      <div className="flex items-center justify-between w-full gap-3">
                        <span className="flex items-center gap-2">
                          <User
                            className={`size-3.5 ${avail.isAvailable ? 'text-purple-600' : 'text-muted-foreground'}`}
                          />
                          <span
                            className={
                              avail.isAvailable
                                ? 'font-semibold text-foreground'
                                : 'text-muted-foreground'
                            }
                          >
                            {e.firstName} {e.lastName}
                          </span>
                          {e.phone && (
                            <span className="text-muted-foreground text-[10px]">({e.phone})</span>
                          )}
                        </span>
                        {avail.isAvailable ? (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 shrink-0">
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Available
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded shrink-0">
                            {avail.reason}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={dispatchMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={dispatchMutation.isPending || !selectedVehicleId || !selectedDriverId}
              className="font-semibold gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <Send className="size-3.5" />
              {dispatchMutation.isPending ? 'Dispatching...' : 'Dispatch Shipment'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
