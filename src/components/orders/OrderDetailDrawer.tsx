import { useState, useMemo } from 'react'
import {
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  MapPin,
  AlertCircle,
  Receipt,
  ShieldCheck,
  Check,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { Employee } from '@/features/staffing/staffing.types'
import type { StockItem } from '@/features/logistics/stock-items.types'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import {
  useConfirmSalesOrder,
  useCancelSalesOrder,
  SALES_ORDERS_QUERY_KEY,
} from '@/features/crm/sales-orders.hooks'
import { completeOutgoingDeliveryApi } from '@/features/logistics/outgoing-deliveries.api'
import { DELIVERIES_QUERY_KEY } from '@/features/logistics/outgoing-deliveries.hooks'
import { VEHICLES_QUERY_KEY } from '@/features/logistics/delivery-vehicles.hooks'
import { QuickDispatchModal } from './QuickDispatchModal'
import { getErrorMessage } from '@/lib/api-client'

interface OrderDetailDrawerProps {
  open: boolean
  onClose: () => void
  order: SalesOrderRecord | null
  clients: Client[]
  products: InventoryItemResponse[]
  warehouses: Warehouse[]
  vehicles: DeliveryVehicle[]
  employees: Employee[]
  stockItems: StockItem[]
  outgoingDeliveries: OutgoingDeliveryRecord[]
}

export function OrderDetailDrawer({
  open,
  onClose,
  order,
  clients,
  products,
  warehouses,
  vehicles,
  employees,
  stockItems,
  outgoingDeliveries,
}: OrderDetailDrawerProps) {
  const queryClient = useQueryClient()
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)
  const [isCompletingDelivery, setIsCompletingDelivery] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const confirmMutation = useConfirmSalesOrder()
  const cancelMutation = useCancelSalesOrder()

  const client = useMemo(
    () => (order?.clientId ? clients.find((c) => c.id === order.clientId) : null),
    [order, clients],
  )

  const productMap = useMemo(() => new Map((products || []).map((p) => [p.id, p])), [products])
  const warehouseMap = useMemo(() => new Map((warehouses || []).map((w) => [w.id, w])), [warehouses])
  const vehicleMap = useMemo(() => new Map((vehicles || []).map((v) => [v.id, v])), [vehicles])
  const employeeMap = useMemo(() => new Map((employees || []).map((e) => [e.id, e])), [employees])
  const stockMap = useMemo(() => new Map((stockItems || []).map((s) => [s.id, s])), [stockItems])

  // Find active outgoing deliveries tied to this order
  const tiedDeliveries = useMemo(() => {
    if (!order?.id) return []
    return (outgoingDeliveries || []).filter(
      (d) => d.salesOrderId === order.id && d.status !== 'CANCELLED',
    )
  }, [order, outgoingDeliveries])

  const activeDelivery = tiedDeliveries[0] || null

  // Step calculations for lifecycle stepper (1: Draft, 2: Confirmed, 3: In Transit, 4: Delivered, -1: Cancelled)
  const currentStep = useMemo(() => {
    if (!order) return 1
    if (order.status === 'CANCELLED') return -1
    if (order.status === 'DELIVERED') return 4
    if (
      order.status === 'PARTIALLY_DELIVERED' ||
      activeDelivery?.status === 'DISPATCHED' ||
      activeDelivery?.status === 'SCHEDULED'
    )
      return 3
    if (order.status === 'CONFIRMED') return 2
    return 1 // DRAFT
  }, [order?.status, activeDelivery?.status])

  if (!order) return null

  const items = order.items || []
  const grossTotal = items.reduce(
    (sum, item) => sum + parseFloat(item?.totalAmount || '0'),
    0,
  )

  const isCancelled = order.status === 'CANCELLED'

  // Handle direct customer delivery completion
  const handleConfirmCustomerDelivery = async () => {
    if (!activeDelivery) return
    try {
      setIsCompletingDelivery(true)
      setErrorMessage('')
      await completeOutgoingDeliveryApi(activeDelivery.id)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
      ])

      toast.success(
        `Delivery ${activeDelivery.deliveryNumber} confirmed! Order ${order.orderNumber} is now marked as Completed.`,
      )
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
    } finally {
      setIsCompletingDelivery(false)
    }
  }

  // Handle confirmation
  const handleConfirmOrder = async () => {
    try {
      setErrorMessage('')
      await confirmMutation.mutateAsync(order.id)
      toast.success(`Order ${order.orderNumber} confirmed! Stock reserved in warehouse.`)
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
    }
  }

  // Handle cancellation
  const handleCancelOrder = async () => {
    if (
      !window.confirm(
        `Are you sure you want to cancel ${order.orderNumber}? This will release any reserved stock.`,
      )
    )
      return
    try {
      setErrorMessage('')
      await cancelMutation.mutateAsync(order.id)
      toast.info(`Order ${order.orderNumber} has been cancelled.`)
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="w-[94vw] max-w-3xl sm:max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-5 gap-3 overflow-hidden shadow-2xl">
          <DialogHeader className="pb-0 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Receipt className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold tracking-tight flex items-center gap-2">
                    {order.orderNumber}
                    {order.status === 'DRAFT' && (
                      <Badge
                        variant="outline"
                        className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]"
                      >
                        Draft
                      </Badge>
                    )}
                    {order.status === 'CONFIRMED' && (
                      <Badge
                        variant="outline"
                        className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]"
                      >
                        Stock Reserved
                      </Badge>
                    )}
                    {order.status === 'PARTIALLY_DELIVERED' && (
                      <Badge
                        variant="outline"
                        className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[10px]"
                      >
                        In Transit
                      </Badge>
                    )}
                    {order.status === 'DELIVERED' && (
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"
                      >
                        Delivered & Closed
                      </Badge>
                    )}
                    {order.status === 'CANCELLED' && (
                      <Badge
                        variant="outline"
                        className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]"
                      >
                        Cancelled
                      </Badge>
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs">
                    Placed on {new Date(order.orderedAt || order.createdAt).toLocaleDateString()}
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive" className="shrink-0">
              <AlertCircle className="size-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3.5 min-h-0 flex-1 overflow-y-auto pr-1">
            {/* Lifecycle Stepper */}
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-3.5">
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {/* Step 1: Draft */}
              <div className="flex flex-col items-center">
                <div
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCancelled
                      ? 'bg-muted text-muted-foreground'
                      : currentStep >= 1
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                >
                  {currentStep > 1 && !isCancelled ? (
                    <Check className="size-3.5" />
                  ) : (
                    '1'
                  )}
                </div>
                <span className="font-semibold text-foreground mt-1.5 text-[11px]">Draft</span>
                <span className="text-[10px] text-muted-foreground">Order Planned</span>
              </div>

              {/* Step 2: Confirmed */}
              <div className="flex flex-col items-center">
                <div
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCancelled
                      ? 'bg-muted text-muted-foreground'
                      : currentStep >= 2
                        ? 'bg-blue-600 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                >
                  {currentStep > 2 && !isCancelled ? (
                    <Check className="size-3.5" />
                  ) : (
                    '2'
                  )}
                </div>
                <span className="font-semibold text-foreground mt-1.5 text-[11px]">Confirmed</span>
                <span className="text-[10px] text-muted-foreground">Stock Reserved</span>
              </div>

              {/* Step 3: In Transit */}
              <div className="flex flex-col items-center">
                <div
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCancelled
                      ? 'bg-muted text-muted-foreground'
                      : currentStep >= 3
                        ? 'bg-indigo-600 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                >
                  {currentStep > 3 && !isCancelled ? (
                    <Check className="size-3.5" />
                  ) : (
                    '3'
                  )}
                </div>
                <span className="font-semibold text-foreground mt-1.5 text-[11px]">In Transit</span>
                <span className="text-[10px] text-muted-foreground">Fleet Dispatched</span>
              </div>

              {/* Step 4: Delivered */}
              <div className="flex flex-col items-center">
                <div
                  className={`size-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isCancelled
                      ? 'bg-rose-500/20 text-rose-600'
                      : currentStep === 4
                        ? 'bg-emerald-600 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}
                >
                  {currentStep === 4 ? (
                    <Check className="size-3.5" />
                  ) : isCancelled ? (
                    <X className="size-3.5" />
                  ) : (
                    '4'
                  )}
                </div>
                <span className="font-semibold text-foreground mt-1.5 text-[11px]">Delivered</span>
                <span className="text-[10px] text-muted-foreground">Customer Received</span>
              </div>
            </div>
          </div>

          {/* THE 3 CORE QUESTIONS GUIDANCE BANNER */}
          {order.status === 'DRAFT' && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="size-4" />
                </div>
                <div className="flex-1 text-xs">
                  <p className="font-bold text-amber-950 dark:text-amber-200">
                    What just happened?
                  </p>
                  <p className="text-muted-foreground">
                    Order <span className="font-semibold text-foreground">{order.orderNumber}</span>{' '}
                    was recorded as a Draft.
                  </p>
                  <p className="font-bold text-amber-950 dark:text-amber-200 mt-2">
                    What is its current state?
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-amber-600">Draft (Unconfirmed)</span> —
                    Inventory has been planned, but physical stock is not locked yet.
                  </p>
                  <p className="font-bold text-amber-950 dark:text-amber-200 mt-2">
                    What should you do next?
                  </p>
                  <p className="text-muted-foreground">
                    Confirm the order to atomically reserve the items in the warehouse and prepare
                    for shipment.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-amber-500/20 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelOrder}
                  disabled={cancelMutation.isPending}
                  className="text-xs text-rose-600 hover:bg-rose-500/10 border-rose-500/30"
                >
                  <X className="size-3 mr-1" />
                  Cancel Order
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmOrder}
                  disabled={confirmMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                >
                  {confirmMutation.isPending ? (
                    'Confirming...'
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5" />
                      Confirm Order & Reserve Stock
                    </span>
                  )}
                </Button>
              </div>
            </div>
          )}

          {order.status === 'CONFIRMED' && (
            <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="size-9 rounded-xl bg-blue-500/20 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck className="size-4" />
                </div>
                <div className="flex-1 text-xs">
                  <p className="font-bold text-blue-950 dark:text-blue-200">What just happened?</p>
                  <p className="text-muted-foreground">
                    Order confirmed! Inventory stock is now{' '}
                    <span className="font-semibold text-blue-600">securely reserved</span> in the
                    warehouse.
                  </p>
                  <p className="font-bold text-blue-950 dark:text-blue-200 mt-2">
                    What is its current state?
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-semibold text-blue-600">Confirmed & Ready</span> — Awaiting
                    fleet vehicle and driver dispatch.
                  </p>
                  <p className="font-bold text-blue-950 dark:text-blue-200 mt-2">
                    What should you do next?
                  </p>
                  <p className="text-muted-foreground">
                    Dispatch the shipment to customer{' '}
                    <span className="font-semibold text-foreground">
                      {client?.name || 'Customer'}
                    </span>
                    .
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-blue-500/20 pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancelOrder}
                  disabled={cancelMutation.isPending}
                  className="text-xs text-rose-600 hover:bg-rose-500/10 border-rose-500/30"
                >
                  <X className="size-3 mr-1" />
                  Cancel Order
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsDispatchModalOpen(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs"
                >
                  <span className="flex items-center gap-1.5">
                    <Truck className="size-3.5" />
                    Dispatch / Schedule Delivery
                  </span>
                </Button>
              </div>
            </div>
          )}

          {(order.status === 'PARTIALLY_DELIVERED' ||
            activeDelivery?.status === 'DISPATCHED') && (
              <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/10 p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="size-9 rounded-xl bg-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                    <Truck className="size-4" />
                  </div>
                  <div className="flex-1 text-xs">
                    <p className="font-bold text-indigo-950 dark:text-indigo-200">
                      What just happened?
                    </p>
                    <p className="text-muted-foreground">
                      The delivery truck has been dispatched from the warehouse and is currently in
                      transit.
                    </p>
                    <p className="font-bold text-indigo-950 dark:text-indigo-200 mt-2">
                      What is its current state?
                    </p>
                    <p className="text-muted-foreground">
                      <span className="font-semibold text-indigo-600">In Transit</span> — Delivery{' '}
                      <span className="font-semibold text-foreground">
                        {activeDelivery?.deliveryNumber || 'Active Trip'}
                      </span>{' '}
                      is en route to {order.deliveryAddress}.
                    </p>
                    <p className="font-bold text-indigo-950 dark:text-indigo-200 mt-2">
                      What should you do next?
                    </p>
                    <p className="text-muted-foreground">
                      Once the customer inspects and signs for the shipment, click below to confirm
                      delivery and complete the order.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-indigo-500/20 pt-3">
                  <Button
                    size="sm"
                    onClick={handleConfirmCustomerDelivery}
                    disabled={isCompletingDelivery}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs"
                  >
                    {isCompletingDelivery ? (
                      'Completing...'
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5" />
                        Confirm Customer Delivery / Complete
                      </span>
                    )}
                  </Button>
                </div>
              </div>
            )}

          {order.status === 'DELIVERED' && (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3">
              <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="size-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-emerald-950 dark:text-emerald-200">
                  Order Successfully Completed
                </p>
                <p className="text-muted-foreground mt-0.5">
                  Goods have been delivered to customer and inventory stock was deducted. No further
                  action required.
                </p>
              </div>
            </div>
          )}

          {/* Customer & Destination Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                <Building2 className="size-3.5 text-primary" />
                Customer / Client
              </div>
              <div className="font-bold text-foreground text-sm">
                {client?.name || `Client #${order.clientId}`}
              </div>
              <div className="text-muted-foreground">{client?.phone || 'No phone recorded'}</div>
              <div className="text-muted-foreground">{client?.email || ''}</div>
            </div>

            <div className="rounded-xl border border-border/80 bg-card p-3.5 space-y-1.5">
              <div className="flex items-center gap-1.5 text-muted-foreground font-semibold">
                <MapPin className="size-3.5 text-primary" />
                Destination Address
              </div>
              <div className="font-medium text-foreground">
                {order.deliveryAddress || 'Store Counter / Direct Pick-up'}
              </div>
              {order.notes && (
                <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                  Note: {order.notes}
                </div>
              )}
            </div>
          </div>

          {/* Active Fleet / Delivery Trip Tracker */}
          {activeDelivery && (
            <div className="rounded-xl border border-border/80 bg-muted/10 p-3.5 text-xs flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-foreground">
                  <Truck className="size-4 text-primary" />
                  Shipment Trip: {activeDelivery.deliveryNumber}
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] ${activeDelivery.status === 'DELIVERED'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-blue-500/10 text-blue-600'
                    }`}
                >
                  {activeDelivery.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1 border-t border-border/60">
                <div>
                  Vehicle:{' '}
                  <span className="font-medium text-foreground">
                    {activeDelivery.deliveryVehicleId
                      ? vehicleMap.get(activeDelivery.deliveryVehicleId)?.plateNumber ||
                      `Vehicle #${activeDelivery.deliveryVehicleId}`
                      : 'Not assigned'}
                  </span>
                </div>
                <div>
                  Driver:{' '}
                  <span className="font-medium text-foreground">
                    {activeDelivery.driverEmployeeId && employeeMap.get(activeDelivery.driverEmployeeId)
                      ? `${employeeMap.get(activeDelivery.driverEmployeeId)?.firstName || ''} ${employeeMap.get(activeDelivery.driverEmployeeId)?.lastName || ''}`.trim()
                      : activeDelivery.driverEmployeeId
                        ? `Driver #${activeDelivery.driverEmployeeId}`
                        : 'Not assigned'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Items Breakdown Table */}
          <div className="rounded-xl border border-border/80 overflow-hidden">
            <div className="bg-muted/40 px-3.5 py-2 text-xs font-bold text-foreground border-b border-border/70 flex items-center justify-between">
              <span>Order Cargo Items ({(order.items || []).length})</span>
              <span>Total: ₱{grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="divide-y divide-border/60 text-xs">
              {(order.items || []).length === 0 ? (
                <div className="p-4 text-center text-muted-foreground italic text-xs">
                  No line items recorded for this order.
                </div>
              ) : (
                (order.items || []).map((item) => {
                  const product = item?.inventoryItemId ? productMap.get(item.inventoryItemId) : null
                  const allocations = item?.allocations || []
                  const allocation = allocations[0]
                  const stock = allocation?.stockItemId ? stockMap.get(allocation.stockItemId) : null
                  const warehouse = stock?.warehouseId ? warehouseMap.get(stock.warehouseId) : null

                  return (
                    <div key={item.id || item.lineNumber || Math.random()} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-foreground">
                          {product ? product.name : `Product #${item.inventoryItemId}`}
                          {product?.variety && (
                            <span className="ml-1 text-muted-foreground font-normal">
                              ({product.variety})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <span>
                            Qty: <span className="font-bold text-foreground">{item.quantity}</span> @ ₱
                            {parseFloat(item.unitPrice || '0').toFixed(2)}
                          </span>
                          {warehouse ? (
                            <span className="text-muted-foreground/70">
                              • Fulfilling from {warehouse.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 italic">
                              • Direct fulfillment / Unassigned warehouse
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="font-bold text-foreground text-sm">
                        ₱
                        {parseFloat(item.totalAmount || '0').toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

      {/* Quick Dispatch Modal */}
      {isDispatchModalOpen && order && (
        <QuickDispatchModal
          open={isDispatchModalOpen}
          onClose={() => setIsDispatchModalOpen(false)}
          order={order}
          vehicles={vehicles}
          employees={employees}
          warehouses={warehouses}
          stockItems={stockItems}
        />
      )}
    </>
  )
}
