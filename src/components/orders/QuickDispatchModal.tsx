import { useState, useMemo } from 'react'
import { Truck, UserRound, MapPin, AlertCircle, PackageCheck, Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { Employee } from '@/features/staffing/staffing.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import {
  createOutgoingDeliveryApi,
  scheduleOutgoingDeliveryApi,
  dispatchOutgoingDeliveryApi,
} from '@/features/logistics/outgoing-deliveries.api'
import { DELIVERIES_QUERY_KEY, SALES_ORDERS_QUERY_KEY } from '@/features/logistics/outgoing-deliveries.hooks'
import { VEHICLES_QUERY_KEY } from '@/features/logistics/delivery-vehicles.hooks'
import { getErrorMessage } from '@/lib/api-client'

interface QuickDispatchModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
  order: SalesOrderRecord
  vehicles: DeliveryVehicle[]
  employees: Employee[]
  warehouses: Warehouse[]
  stockItems: StockItem[]
}

export function QuickDispatchModal({
  open,
  onClose,
  onSuccess,
  order,
  vehicles,
  employees,
  warehouses,
  stockItems,
}: QuickDispatchModalProps) {
  const queryClient = useQueryClient()
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('')
  const [selectedDriverId, setSelectedDriverId] = useState<string>('')
  const [scheduledAt, setScheduledAt] = useState<string>(
    new Date(Date.now() + 30 * 60000).toISOString().slice(0, 16), // 30 mins from now
  )
  const [destinationAddress, setDestinationAddress] = useState(
    order.deliveryAddress || 'Commercial Client Address',
  )
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Map stock items to find which warehouse the allocated stock resides in
  const stockMap = useMemo(() => new Map(stockItems.map((s) => [s.id, s])), [stockItems])
  const warehouseMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses])

  // Derive warehouse from the first allocated stock item
  const fulfillmentWarehouseId = useMemo(() => {
    for (const item of (order?.items || [])) {
      for (const alloc of (item?.allocations || [])) {
        const stock = stockMap.get(alloc.stockItemId)
        if (stock?.warehouseId) return stock.warehouseId
      }
    }
    return warehouses[0]?.id || 1
  }, [order, stockMap, warehouses])

  const warehouseName =
    warehouseMap.get(fulfillmentWarehouseId)?.name || `Warehouse #${fulfillmentWarehouseId}`

  const availableVehicles = useMemo(
    () => (vehicles || []).filter((v) => v.isActive && v.status === 'AVAILABLE'),
    [vehicles],
  )

  const activeEmployees = useMemo(
    () => (employees || []).filter((e) => e.isActive),
    [employees],
  )

  // Collect all allocations for this order to dispatch
  const allocationsToDeliver = useMemo(() => {
    return (order?.items || []).flatMap((item) =>
      (item?.allocations || []).map((alloc) => ({
        salesOrderAllocationId: alloc.id,
        quantity: alloc.quantity,
      })),
    )
  }, [order])

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!selectedVehicleId) {
      setErrorMessage('Please assign an available delivery fleet vehicle.')
      return
    }

    if (!selectedDriverId) {
      setErrorMessage('Please assign an active driver or courier.')
      return
    }

    if (allocationsToDeliver.length === 0) {
      setErrorMessage('This order has no allocated stock items to deliver.')
      return
    }

    try {
      setIsSubmitting(true)
      const vehicleId = Number(selectedVehicleId)
      const driverId = Number(selectedDriverId)

      // Step 1: Create the outgoing delivery record tied to this sales order
      const delivery = await createOutgoingDeliveryApi({
        salesOrderId: order.id,
        warehouseId: fulfillmentWarehouseId,
        deliveryVehicleId: vehicleId,
        driverEmployeeId: driverId,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        notes: notes.trim() || undefined,
        items: allocationsToDeliver,
      })

      // Step 2: Schedule the delivery
      await scheduleOutgoingDeliveryApi(delivery.id)

      // Step 3: Dispatch the vehicle & driver (sets vehicle to IN_DELIVERY, delivery to DISPATCHED)
      await dispatchOutgoingDeliveryApi(delivery.id, {
        deliveryVehicleId: vehicleId,
        driverEmployeeId: driverId,
      })

      // Invalidate queries so Order & Deliveries views refresh instantaneously
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
      ])

      toast.success(
        `Shipment "${delivery.deliveryNumber}" dispatched successfully for ${order.orderNumber}!`,
      )

      onSuccess?.()
      onClose()
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[min(880px,calc(100vh-2rem))] overflow-y-auto sm:max-w-xl gap-5 p-6">
        <DialogHeader className="pb-1">
          <div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 shadow-2xs">
            <Truck className="size-5" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            Schedule & Dispatch Shipment
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Assign a fleet vehicle and driver to immediately dispatch{' '}
            <span className="font-semibold text-foreground">{order.orderNumber}</span> to the
            customer.
          </DialogDescription>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleDispatch} className="flex flex-col gap-4">
          {/* Dispatch Overview Box */}
          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-900 dark:text-blue-200">
                Fulfilling Warehouse:
              </span>
              <span className="font-bold text-foreground">{warehouseName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-blue-900 dark:text-blue-200">Cargo Items:</span>
              <span className="font-medium text-foreground text-right max-w-[260px] truncate">
                {(order?.items || [])
                  .map((i) => `Item #${i.inventoryItemId} (x${i.quantity})`)
                  .join(', ')}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-blue-500/15 pt-2">
              <span className="font-semibold text-blue-900 dark:text-blue-200">
                Total Order Value:
              </span>
              <span className="font-extrabold text-foreground">
                ₱
                {(order?.items || [])
                  .reduce((sum, i) => sum + parseFloat(i?.totalAmount || '0'), 0)
                  .toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Vehicle Assignment */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Truck className="size-3.5 text-blue-600" />
              Delivery Fleet Vehicle *
            </Label>
            <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select available vehicle unit..." />
              </SelectTrigger>
              <SelectContent>
                {availableVehicles.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground text-center">
                    No available fleet vehicles. Check Fleet view to release a vehicle.
                  </div>
                ) : (
                  availableVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={String(vehicle.id)}>
                      <span className="font-medium text-foreground">{vehicle.plateNumber}</span> -{' '}
                      {vehicle.model || vehicle.vehicleType}{' '}
                      <span className="text-[10px] text-emerald-600 font-semibold">(Available)</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {availableVehicles.length === 0 && (
              <p className="text-[11px] text-amber-600 mt-1">
                All vehicles are currently in transit or maintenance.
              </p>
            )}
          </div>

          {/* Driver Assignment */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <UserRound className="size-3.5 text-blue-600" />
              Assigned Driver / Staff *
            </Label>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Select delivery driver / staff..." />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground text-center">
                    No active staff found.
                  </div>
                ) : (
                  activeEmployees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.firstName} {emp.lastName}{' '}
                      {emp.phone && <span className="text-muted-foreground">({emp.phone})</span>}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Departure Date/Time & Destination */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Clock className="size-3.5 text-blue-600" />
                Departure Time
              </Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <MapPin className="size-3.5 text-blue-600" />
                Destination Address
              </Label>
              <Input
                value={destinationAddress}
                onChange={(e) => setDestinationAddress(e.target.value)}
                className="h-9 text-xs"
                placeholder="Client store / delivery dock"
              />
            </div>
          </div>

          {/* Delivery Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Dispatch Instructions / Gate Pass (Optional)
            </Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="h-9 text-xs"
              placeholder="e.g. Call client before arrival, fragile produce..."
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || availableVehicles.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {isSubmitting ? (
                'Dispatching...'
              ) : (
                <span className="flex items-center gap-1.5">
                  <PackageCheck className="size-4" />
                  Confirm & Dispatch Truck
                </span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
