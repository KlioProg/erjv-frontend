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
import { getErrorMessage } from '@/lib/api-client'
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
    if (dispatchMutation.isPending) return
    setErrorMessage('')

    if (!delivery || delivery.status !== 'SCHEDULED') {
      setErrorMessage('Only a scheduled delivery can be dispatched.')
      return
    }

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

    const vehicle = vehicles.find((vehicle) => vehicle.id === vehicleIdNum)
    if (
      !vehicle ||
      !DeliveryUtils.getVehicleAvailability(vehicle, deliveries, delivery.id).isAvailable
    ) {
      setErrorMessage('This vehicle is no longer available. Choose another vehicle.')
      return
    }
    const driver = employees.find((employee) => employee.id === driverIdNum)
    if (
      !driver ||
      !DeliveryUtils.getDriverAvailability(driver, deliveries, delivery.id).isAvailable
    ) {
      setErrorMessage('This driver is no longer available. Choose another driver.')
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
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && !dispatchMutation.isPending && onClose()}
    >
      <DialogContent
        closeDisabled={dispatchMutation.isPending}
        className="sm:max-w-lg max-h-[calc(100svh-2rem)] overflow-y-auto gap-5 p-6"
      >
        <DialogHeader className="pb-1">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            Dispatch Shipment to Transit
          </DialogTitle>
          <DialogDescription className="text-xs">
            Assign the fleet vehicle and driver for delivery shipment{' '}
            <span className="tabular-nums font-medium text-foreground">
              {delivery?.deliveryNumber}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {delivery && (
          <div className="flex items-start gap-3 p-4 rounded-md bg-secondary text-sm">
            <MapPin className="size-4 text-primary shrink-0 mt-0.5" />
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground text-sm">
                  {client?.name || `Customer #${delivery.salesOrderId}`}
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  Order #{order?.orderNumber || delivery.salesOrderId}
                </span>
              </div>
              <span className="text-foreground text-sm mt-0.5">
                {order?.deliveryAddress || 'Client Destination Address'}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                Origin: {warehouse?.name || `Warehouse #${delivery.warehouseId}`} •{' '}
                {delivery.items.length} items to transport
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset disabled={dispatchMutation.isPending} className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dispatch-vehicle" className="text-[13px] font-medium">
                Available Delivery Vehicle <span className="text-primary">*</span>
              </Label>
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger id="dispatch-vehicle" className="h-10 text-[13px]">
                  <SelectValue placeholder="Choose available vehicle" />
                </SelectTrigger>
                <SelectContent>
                  {vehicles.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No vehicles registered in fleet
                    </SelectItem>
                  ) : (
                    vehicles.map((v) => {
                      const avail = DeliveryUtils.getVehicleAvailability(
                        v,
                        deliveries,
                        delivery?.id,
                      )
                      return (
                        <SelectItem
                          key={v.id}
                          value={String(v.id)}
                          disabled={!avail.isAvailable}
                          className={
                            !avail.isAvailable ? 'opacity-50 cursor-not-allowed bg-secondary' : ''
                          }
                        >
                          <div className="flex items-center justify-between w-full gap-3">
                            <span className="flex items-center gap-2">
                              <Truck className="size-3.5 text-muted-foreground" />
                              <span
                                className={
                                  avail.isAvailable
                                    ? 'font-medium text-foreground'
                                    : 'text-muted-foreground'
                                }
                              >
                                {v.plateNumber}
                              </span>
                              <span className="text-muted-foreground text-xs">
                                ({v.vehicleType}
                                {v.model ? ` • ${v.model}` : ''})
                              </span>
                            </span>
                            {avail.isAvailable ? (
                              <span className="text-xs text-status-success-foreground font-medium flex items-center gap-1 shrink-0">
                                <span className="size-1.5 rounded-full bg-status-success-foreground" />
                                Ready
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-status-warning-foreground bg-status-warning px-1.5 py-0.5 rounded shrink-0">
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
              <p className="text-xs text-muted-foreground">
                Dispatching will set this vehicle's status to{' '}
                <span className="font-semibold text-status-warning-foreground">IN_DELIVERY</span>.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dispatch-driver" className="text-[13px] font-medium">
                Assigned Driver / Logistics Officer <span className="text-primary">*</span>
              </Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger id="dispatch-driver" className="h-10 text-[13px]">
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
                          !avail.isAvailable ? 'opacity-50 cursor-not-allowed bg-secondary' : ''
                        }
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          <span className="flex items-center gap-2">
                            <User className="size-3.5 text-muted-foreground" />
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
                              <span className="text-muted-foreground text-xs">({e.phone})</span>
                            )}
                          </span>
                          {avail.isAvailable ? (
                            <span className="text-xs text-status-success-foreground font-medium flex items-center gap-1 shrink-0">
                              <span className="size-1.5 rounded-full bg-status-success-foreground" />
                              Available
                            </span>
                          ) : (
                            <span className="text-xs font-medium text-status-warning-foreground bg-status-warning px-1.5 py-0.5 rounded shrink-0">
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
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Dispatching marks this shipment as in transit and makes the selected vehicle
            unavailable. Physical stock is deducted when delivery is completed.
          </p>
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
              className="font-medium gap-1.5"
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
