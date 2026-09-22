import { useState, useMemo, useEffect, type FormEvent } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Truck, Warehouse as WarehouseIcon, User, Package, Plus, Minus, MapPin, Info } from 'lucide-react'
import {
  useCreateOutgoingDelivery,
  useScheduleOutgoingDelivery,
  useOutgoingDeliveries,
} from '@/features/logistics/outgoing-deliveries.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { DeliveryUtils } from '@/features/logistics/delivery-utils'

interface ScheduleDeliveryModalProps {
  open: boolean
  onClose: () => void
  preselectedOrderId?: number
}

function getInitialScheduledAt(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 16)
}

function formatCount(val: string | number): string {
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '0'
  return num % 1 === 0 ? String(Math.round(num)) : String(num)
}

interface AllocationRow {
  allocationId: number
  stockItemId: number
  productId: number
  productName: string
  variety: string | null
  unit: string
  warehouseId: number
  warehouseName: string
  warehouseOnHand: string
  allocatedQuantity: string
  alreadyScheduledQuantity: number
  remainingQuantity: number
  deliverQuantity: string
  selected: boolean
}

export function ScheduleDeliveryModal({
  open,
  onClose,
  preselectedOrderId,
}: ScheduleDeliveryModalProps) {
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: clients = [] } = useClients()
  const { data: warehouses = [] } = useWarehouses()
  const { data: vehicles = [] } = useDeliveryVehicles()
  const { data: employees = [] } = useEmployees()
  const { data: stockItems = [] } = useStockItems()
  const { data: products = [] } = useProducts()
  const { data: deliveries = [] } = useOutgoingDeliveries()

  const createDelivery = useCreateOutgoingDelivery()
  const scheduleDelivery = useScheduleOutgoingDelivery()

  // Deliverable orders: CONFIRMED or PARTIALLY_DELIVERED
  const deliverableOrders = useMemo(
    () =>
      salesOrders.filter(
        (o) => o.status === 'CONFIRMED' || o.status === 'PARTIALLY_DELIVERED',
      ),
    [salesOrders],
  )

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    preselectedOrderId ? String(preselectedOrderId) : '',
  )
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('')
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('none')
  const [selectedDriverId, setSelectedDriverId] = useState<string>('none')
  const [scheduledAt, setScheduledAt] = useState<string>(getInitialScheduledAt)
  const [notes, setNotes] = useState<string>('')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [autoSchedule, setAutoSchedule] = useState<boolean>(true)

  // Helper to switch order and auto-populate fulfillment warehouse
  const selectOrderAndDefaultWarehouse = (orderIdStr: string) => {
    setSelectedOrderId(orderIdStr)
    setErrorMessage('')

    const order = salesOrders.find((o) => String(o.id) === orderIdStr)
    if (order && (order.items || []).length > 0) {
      // Find first warehouse associated with this order's stock allocations
      const firstAlloc = (order.items || []).flatMap((i) => i.allocations || [])[0]
      if (firstAlloc) {
        const stock = stockItems.find((s) => s.id === firstAlloc.stockItemId)
        if (stock) {
          setSelectedWarehouseId(String(stock.warehouseId))
        }
      }
    }
  }

  // Auto-select initial order if preselectedOrderId is provided or default to the first available deliverable order
  useEffect(() => {
    if (preselectedOrderId) {
      selectOrderAndDefaultWarehouse(String(preselectedOrderId))
    } else if (!selectedOrderId && deliverableOrders.length > 0) {
      selectOrderAndDefaultWarehouse(String(deliverableOrders[0].id))
    }
  }, [preselectedOrderId, deliverableOrders, selectedOrderId])

  // Map allocations for selected sales order
  const selectedOrder = useMemo(
    () => salesOrders.find((o) => String(o.id) === selectedOrderId),
    [salesOrders, selectedOrderId],
  )

  // Derive allocation rows
  const [allocationQuantities, setAllocationQuantities] = useState<Record<number, string>>({})

  const availableAllocations = useMemo<AllocationRow[]>(() => {
    if (!selectedOrder) return []

    const rows: AllocationRow[] = []
    for (const item of (selectedOrder.items || [])) {
      const prod = products.find((p) => p.id === item.inventoryItemId)
      for (const alloc of (item.allocations || [])) {
        const stock = stockItems.find((s) => s.id === alloc.stockItemId)
        const wh = warehouses.find((w) => w.id === stock?.warehouseId)

        // Calculate quantities already reserved or shipped in non-cancelled deliveries
        const alreadyScheduled = deliveries
          .filter((d) => d.status !== 'CANCELLED')
          .flatMap((d) => d.items)
          .filter((line) => line.salesOrderAllocationId === alloc.id)
          .reduce((sum, line) => sum + (parseFloat(line.quantity) || 0), 0)

        const totalAlloc = parseFloat(alloc.quantity) || 0
        const remaining = Math.max(0, totalAlloc - alreadyScheduled)
        const intRemaining = Math.floor(remaining)

        rows.push({
          allocationId: alloc.id,
          stockItemId: alloc.stockItemId,
          productId: item.inventoryItemId,
          productName: prod?.name || `Product #${item.inventoryItemId}`,
          variety: prod?.variety || null,
          unit: prod?.unit || 'units',
          warehouseId: stock?.warehouseId || 0,
          warehouseName: wh?.name || `Warehouse #${stock?.warehouseId || 0}`,
          warehouseOnHand: stock?.quantity || '0',
          allocatedQuantity: alloc.quantity,
          alreadyScheduledQuantity: alreadyScheduled,
          remainingQuantity: remaining,
          deliverQuantity:
            allocationQuantities[alloc.id] !== undefined
              ? allocationQuantities[alloc.id]
              : intRemaining > 0
                ? String(intRemaining)
                : '0',
          selected: intRemaining > 0,
        })
      }
    }
    return rows
  }, [selectedOrder, products, stockItems, warehouses, deliveries, allocationQuantities])

  // Filter allocation rows by selected warehouse if one is chosen
  const filteredAllocations = useMemo(() => {
    if (!selectedWarehouseId) return availableAllocations
    const whId = parseInt(selectedWarehouseId, 10)
    return availableAllocations.filter((a) => a.warehouseId === whId || a.warehouseId === 0)
  }, [availableAllocations, selectedWarehouseId])

  const isOrderFullyScheduled = useMemo(() => {
    if (!selectedOrder || availableAllocations.length === 0) return false
    return availableAllocations.every((a) => a.remainingQuantity <= 0)
  }, [selectedOrder, availableAllocations])

  const handleOrderChange = selectOrderAndDefaultWarehouse

  const handleQuantityChange = (allocationId: number, qty: string) => {
    const cleanQty = qty === '' ? '' : qty.replace(/[^0-9]/g, '')
    const alloc = availableAllocations.find((a) => a.allocationId === allocationId)
    const maxQty = alloc ? Math.floor(alloc.remainingQuantity) : 999999
    const num = parseInt(cleanQty, 10)
    let finalQty = cleanQty
    if (!isNaN(num) && num > maxQty) {
      finalQty = String(maxQty)
    }
    setAllocationQuantities((prev) => ({
      ...prev,
      [allocationId]: finalQty,
    }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    const orderIdNum = parseInt(selectedOrderId, 10)
    const warehouseIdNum = parseInt(selectedWarehouseId, 10)

    if (isNaN(orderIdNum) || orderIdNum <= 0) {
      setErrorMessage('Please choose a confirmed sales order to deliver.')
      return
    }

    if (isNaN(warehouseIdNum) || warehouseIdNum <= 0) {
      setErrorMessage('Please specify the fulfillment source warehouse.')
      return
    }

    if (isOrderFullyScheduled) {
      setErrorMessage(
        'All cargo items for this sales order have already been scheduled in existing shipments. Track or dispatch them under Dispatch Operations.',
      )
      return
    }

    // Check if any quantity exceeds remaining unfulfilled allocation
    for (const alloc of filteredAllocations) {
      const qty = parseFloat(alloc.deliverQuantity)
      if (!isNaN(qty) && qty > alloc.remainingQuantity) {
        setErrorMessage(
          `Cannot schedule ${qty} units of ${alloc.productName}. Only ${alloc.remainingQuantity} unfulfilled units remain for this order.`,
        )
        return
      }
    }

    const itemsToDeliver = filteredAllocations
      .filter((alloc) => {
        const qty = parseFloat(alloc.deliverQuantity)
        return !isNaN(qty) && qty > 0 && alloc.remainingQuantity > 0
      })
      .map((alloc) => ({
        salesOrderAllocationId: alloc.allocationId,
        quantity: alloc.deliverQuantity,
      }))

    if (itemsToDeliver.length === 0) {
      setErrorMessage('Please enter a delivery quantity greater than 0 for at least one allocation.')
      return
    }

    const vehicleIdNum = selectedVehicleId !== 'none' ? parseInt(selectedVehicleId, 10) : null
    const driverIdNum = selectedDriverId !== 'none' ? parseInt(selectedDriverId, 10) : null

    try {
      const created = await createDelivery.mutateAsync({
        salesOrderId: orderIdNum,
        warehouseId: warehouseIdNum,
        deliveryVehicleId: vehicleIdNum,
        driverEmployeeId: driverIdNum,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        notes: notes.trim() || null,
        items: itemsToDeliver,
      })

      if (autoSchedule && created.id) {
        await scheduleDelivery.mutateAsync(created.id)
      }

      onClose()
    } catch {
      // Errors handled by hook toasts
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="w-[94vw] max-w-3xl sm:max-w-4xl max-h-[92vh] min-h-[460px] flex flex-col p-4 sm:p-5 gap-3 overflow-hidden shadow-2xl">
        <DialogHeader className="pb-0 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex size-6.5 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Plus className="size-3.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold tracking-tight">
                Schedule Outgoing Delivery
              </DialogTitle>
              <DialogDescription className="text-[11px] text-muted-foreground">
                Assign warehouse stock, fleet vehicle, and driver to dispatch a confirmed customer order.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <Alert variant="destructive" className="py-1.5 px-3 text-xs shrink-0">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        {deliverableOrders.length === 0 && (
          <Alert className="py-1.5 px-3 text-xs shrink-0 border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200 flex items-center gap-2">
            <Info className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <AlertDescription>
              All confirmed customer orders have already been scheduled. Confirm a new order in Customer Relations to create another delivery.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 min-h-0 flex-1 overflow-y-auto pr-1">
          {/* Order and Warehouse Row (2-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0">
            {/* Order Selection */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="delivery-sales-order" className="text-xs font-semibold">
                Sales Order to Fulfill <span className="text-primary">*</span>
              </Label>
              <Select value={selectedOrderId} onValueChange={handleOrderChange}>
                <SelectTrigger id="delivery-sales-order" className="h-8 text-xs">
                  <SelectValue placeholder="Choose confirmed sales order" />
                </SelectTrigger>
                <SelectContent>
                  {deliverableOrders.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No confirmed deliverable orders available
                    </SelectItem>
                  ) : (
                    deliverableOrders.map((order) => {
                      const client = clients.find((c) => c.id === order.clientId)
                      return (
                        <SelectItem key={order.id} value={String(order.id)}>
                          <span className="flex items-center gap-2">
                            <span className="font-bold font-mono">{order.orderNumber}</span>
                            <span className="text-muted-foreground">• {client?.name || `Client #${order.clientId}`}</span>
                            <span className="text-[10px] text-primary">({(order.items || []).length} items)</span>
                          </span>
                        </SelectItem>
                      )
                    })
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Warehouse Selection */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="delivery-warehouse" className="text-xs font-semibold">
                Source Warehouse <span className="text-primary">*</span>
              </Label>
              <Select value={selectedWarehouseId} onValueChange={setSelectedWarehouseId}>
                <SelectTrigger id="delivery-warehouse" className="h-8 text-xs">
                  <SelectValue placeholder="Select fulfillment warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter((w) => w.isActive).map((warehouse) => (
                    <SelectItem key={warehouse.id} value={String(warehouse.id)}>
                      <span className="flex items-center gap-2">
                        <WarehouseIcon className="size-3.5 text-primary" />
                        <span>{warehouse.name}</span>
                        <span className="text-muted-foreground text-[10px]">({warehouse.address})</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Selected Order & Destination Compact Ribbon */}
          {selectedOrder && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded-md bg-muted/40 border border-border/70 text-[11px] shrink-0">
              <div className="flex items-center gap-2 truncate">
                <MapPin className="size-3.5 text-rose-500 shrink-0" />
                <span className="font-semibold text-foreground truncate">
                  {clients.find((c) => c.id === selectedOrder.clientId)?.name || `Client #${selectedOrder.clientId}`}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  (Order #{selectedOrder.orderNumber})
                </span>
                <span className="text-[10px] text-muted-foreground truncate">
                  • {selectedOrder.deliveryAddress}
                </span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground shrink-0 pl-2">
                {(selectedOrder.items || []).length} items
              </span>
            </div>
          )}

          {/* Allocation Items Breakdown */}
          <div className="flex flex-col rounded-lg border border-border/80 overflow-hidden bg-background/50 shrink-0">
            <div className="bg-muted/30 px-3 py-1.5 border-b border-border/70 flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Package className="size-3.5 text-primary" />
                Cargo Allocations to Deliver {selectedOrder ? `(${filteredAllocations.length})` : ''}
              </span>
              {selectedOrder && isOrderFullyScheduled && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                  Fully Scheduled
                </span>
              )}
            </div>

            {!selectedOrder ? (
              <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1.5 bg-muted/5">
                <Package className="size-7 text-muted-foreground/35 mb-0.5" />
                <span className="font-semibold text-foreground text-xs">
                  {deliverableOrders.length === 0 ? 'No Deliverable Orders Available' : 'No Sales Order Selected'}
                </span>
                <p className="text-[11px] text-muted-foreground max-w-sm">
                  {deliverableOrders.length === 0
                    ? 'All confirmed customer orders have already been scheduled. Confirm a new order in Customer Relations to create a delivery.'
                    : 'Choose a confirmed sales order from the dropdown above to review cargo items, warehouse stock, and assign dispatch quantities.'}
                </p>
              </div>
            ) : isOrderFullyScheduled ? (
              <div className="p-3 m-2 rounded border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs">
                All cargo allocations for this order have already been scheduled in active shipments. You can view or dispatch these under <strong>Dispatch Operations</strong>.
              </div>
            ) : filteredAllocations.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                No allocations found for this order matching the selected warehouse.
              </div>
            ) : (
              <div className="max-h-[190px] overflow-y-auto overflow-x-hidden rounded-md border border-border/60">
                <table className="w-full table-fixed text-xs">
                    <thead className="bg-muted/30 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/70 sticky top-0 bg-muted/95 backdrop-blur-xs z-10">
                      <tr>
                        <th className="px-3 py-2 w-[32%]">Product Item</th>
                        <th className="px-2 py-2 text-right w-[14%]">Total Ordered</th>
                        <th className="px-2 py-2 text-right w-[18%]">Already Sched.</th>
                        <th className="px-2 py-2 text-right font-semibold text-foreground w-[14%]">Remaining</th>
                        <th className="px-3 py-2 text-right w-[22%]">Qty to Ship</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredAllocations.map((alloc) => {
                        const isDepleted = alloc.remainingQuantity <= 0
                        const totalOrderedNum = parseFloat(alloc.allocatedQuantity) || 0
                        const pctFulfilled =
                          totalOrderedNum > 0
                            ? Math.min(100, Math.round((alloc.alreadyScheduledQuantity / totalOrderedNum) * 100))
                            : 0
                        const currentQty = parseInt(alloc.deliverQuantity, 10) || 0
                        const maxQty = Math.floor(alloc.remainingQuantity)

                        return (
                          <tr key={alloc.allocationId} className={isDepleted ? 'bg-muted/20 opacity-75' : 'hover:bg-muted/15'}>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="flex flex-col min-w-0">
                                  <span className="font-semibold text-foreground text-xs truncate flex items-center gap-1">
                                    {alloc.productName}
                                    {alloc.variety && (
                                      <span className="text-[9px] font-normal px-1 py-0.2 rounded bg-muted text-muted-foreground shrink-0">
                                        {alloc.variety}
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground truncate">
                                    {alloc.warehouseName} • <span className="font-mono">{formatCount(alloc.warehouseOnHand)} {alloc.unit} in stock</span>
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="px-2 py-2.5 text-right font-mono">
                              <span className="font-bold text-foreground">{formatCount(alloc.allocatedQuantity)}</span>{' '}
                              <span className="text-[10px] text-muted-foreground font-sans">{alloc.unit}</span>
                            </td>

                            <td className="px-2 py-2.5 text-right font-mono">
                              <div className="flex flex-col items-end justify-center py-0.5">
                                <div className="leading-tight">
                                  <span className="text-muted-foreground font-semibold">
                                    {alloc.alreadyScheduledQuantity > 0 ? formatCount(alloc.alreadyScheduledQuantity) : '0'}
                                  </span>{' '}
                                  <span className="text-[10px] font-sans text-muted-foreground">{alloc.unit}</span>
                                </div>
                                {totalOrderedNum > 0 && (
                                  <div className="flex items-center gap-1.5 mt-1 justify-end">
                                    <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                                      <div
                                        className={`h-full ${
                                          pctFulfilled >= 100
                                            ? 'bg-emerald-500'
                                            : pctFulfilled > 0
                                              ? 'bg-blue-500'
                                              : 'bg-transparent'
                                        }`}
                                        style={{ width: `${pctFulfilled}%` }}
                                      />
                                    </div>
                                    <span className="text-[9px] font-sans text-muted-foreground">{pctFulfilled}%</span>
                                  </div>
                                )}
                              </div>
                            </td>

                            <td className="px-2 py-2.5 text-right">
                              {isDepleted ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border/80">
                                  0
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                  {formatCount(alloc.remainingQuantity)}
                                </span>
                              )}
                            </td>

                            <td className="px-3 py-2.5 text-right">
                              {isDepleted ? (
                                <span className="text-[10px] text-muted-foreground italic pr-2">Scheduled</span>
                              ) : (
                                <div className="inline-flex items-center gap-1 justify-end">
                                  {/* Tactile Integer Stepper */}
                                  <div className="inline-flex items-center rounded border border-input shadow-2xs overflow-hidden bg-background h-6.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (currentQty > 0) {
                                          handleQuantityChange(alloc.allocationId, String(currentQty - 1))
                                        }
                                      }}
                                      disabled={currentQty <= 0}
                                      className="size-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                      title="Decrease quantity by 1"
                                    >
                                      <Minus className="size-2.5" />
                                    </button>

                                    <Input
                                      type="number"
                                      step="1"
                                      min="0"
                                      max={maxQty}
                                      value={alloc.deliverQuantity}
                                      onChange={(e) =>
                                        handleQuantityChange(alloc.allocationId, e.target.value)
                                      }
                                      className="w-8 h-6.5 text-xs text-center font-mono border-0 rounded-none shadow-none focus-visible:ring-0 p-0"
                                    />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (currentQty < maxQty) {
                                          handleQuantityChange(alloc.allocationId, String(currentQty + 1))
                                        }
                                      }}
                                      disabled={currentQty >= maxQty}
                                      className="size-6 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                      title="Increase quantity by 1"
                                    >
                                      <Plus className="size-2.5" />
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleQuantityChange(alloc.allocationId, String(maxQty))
                                    }
                                    className="h-6.5 px-1.5 rounded border border-border/80 bg-muted/40 hover:bg-muted text-[10px] font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                                    title="Ship remaining allocation"
                                  >
                                    Max
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>

                  {/* Summary Bar */}
                  <div className="bg-muted/15 px-3 py-1 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>
                      Allocations: <strong className="text-foreground">{filteredAllocations.length}</strong>
                    </span>
                    <span>
                      Total to Dispatch:{' '}
                      <strong className="font-mono text-foreground font-bold">
                        {filteredAllocations.reduce((sum, a) => sum + (parseInt(a.deliverQuantity, 10) || 0), 0)}{' '}
                        units
                      </strong>
                    </span>
                  </div>
                </div>
              )}
            </div>

          {/* Vehicle and Driver Assignment Grid (2-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0">
            <div className="flex flex-col gap-1">
              <Label htmlFor="delivery-vehicle" className="text-xs font-semibold">
                Assign Vehicle (Optional)
              </Label>
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger id="delivery-vehicle" className="h-8 text-xs">
                  <SelectValue placeholder="Choose available vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Assign Later at Dispatch</SelectItem>
                  {vehicles.map((v) => {
                    const avail = DeliveryUtils.getVehicleAvailability(v, deliveries)
                    return (
                      <SelectItem
                        key={v.id}
                        value={String(v.id)}
                        disabled={!avail.isAvailable}
                        className={!avail.isAvailable ? 'opacity-50 cursor-not-allowed bg-muted/20' : ''}
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          <span className="flex items-center gap-2 font-mono">
                            <Truck className={`size-3.5 ${avail.isAvailable ? 'text-blue-600' : 'text-muted-foreground'}`} />
                            <span className={avail.isAvailable ? 'font-bold text-foreground' : 'text-muted-foreground'}>
                              {v.plateNumber}
                            </span>
                            <span className="text-muted-foreground font-sans text-[11px]">
                              ({v.vehicleType}{v.model ? ` • ${v.model}` : ''})
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
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="delivery-driver" className="text-xs font-semibold">
                Assign Driver (Optional)
              </Label>
              <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                <SelectTrigger id="delivery-driver" className="h-8 text-xs">
                  <SelectValue placeholder="Choose active employee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Assign Later at Dispatch</SelectItem>
                  {employees.map((e) => {
                    const avail = DeliveryUtils.getDriverAvailability(e, deliveries)
                    return (
                      <SelectItem
                        key={e.id}
                        value={String(e.id)}
                        disabled={!avail.isAvailable}
                        className={!avail.isAvailable ? 'opacity-50 cursor-not-allowed bg-muted/20' : ''}
                      >
                        <div className="flex items-center justify-between w-full gap-3">
                          <span className="flex items-center gap-2">
                            <User className={`size-3.5 ${avail.isAvailable ? 'text-purple-600' : 'text-muted-foreground'}`} />
                            <span className={avail.isAvailable ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
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
          </div>

          {/* Scheduled Date and Notes (2-Column Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 shrink-0">
            <div className="flex flex-col gap-1">
              <Label htmlFor="delivery-scheduled-at" className="text-xs font-semibold">
                Scheduled Date & Time
              </Label>
              <Input
                id="delivery-scheduled-at"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="h-8.5 text-xs font-mono px-3"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label htmlFor="delivery-notes" className="text-xs font-semibold">
                Delivery Notes / Instructions
              </Label>
              <Input
                id="delivery-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Special loading dock pass or gate code..."
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Footer Bar with Checkbox and Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-border/60 shrink-0 mt-0.5">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="auto-schedule-checkbox"
                checked={autoSchedule}
                onChange={(e) => setAutoSchedule(e.target.checked)}
                className="size-3.5 rounded accent-primary cursor-pointer"
              />
              <Label htmlFor="auto-schedule-checkbox" className="text-[11px] font-medium cursor-pointer">
                Automatically confirm schedule on creation (status: SCHEDULED)
              </Label>
            </div>

            <div className="flex items-center justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={createDelivery.isPending} className="h-7.5 text-xs px-3">
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={
                  !selectedOrderId ||
                  !selectedWarehouseId ||
                  filteredAllocations.length === 0 ||
                  isOrderFullyScheduled ||
                  createDelivery.isPending ||
                  scheduleDelivery.isPending
                }
                className="h-7.5 text-xs font-semibold gap-1.5 px-3"
              >
                <Plus className="size-3" />
                {createDelivery.isPending ? 'Creating...' : 'Schedule Delivery'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
