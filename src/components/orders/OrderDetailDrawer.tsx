import { formatProductUnit } from '@/lib/product-unit'
import { SalesOrderCancelModal } from './SalesOrderCancelModal'
import { useState, useMemo } from 'react'
import {
  CheckCircle2,
  Clock,
  Truck,
  Building2,
  MapPin,
  AlertCircle,
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
import { STOCK_ITEMS_QUERY_KEY } from '@/features/logistics/stock-items.hooks'
import { VEHICLES_QUERY_KEY } from '@/features/logistics/delivery-vehicles.hooks'
import { QuickDispatchModal } from './QuickDispatchModal'
import { useAuth } from '@/features/auth/AuthContext'
import { getErrorMessage } from '@/lib/api-client'

interface OrderDetailDrawerProps {
  open: boolean
  readOnly?: boolean
  onClose: () => void
  order: SalesOrderRecord | null
  clients: Client[]
  products: InventoryItemResponse[]
  warehouses: Warehouse[]
  vehicles: DeliveryVehicle[]
  employees: Employee[]
  stockItems: StockItem[]
  outgoingDeliveries: OutgoingDeliveryRecord[]
  onViewDelivery?: (id: number) => void
  onConfirmed?: (order: SalesOrderRecord) => void
  onArrangeDelivery?: (orderId: number) => void
}

export function OrderDetailDrawer({
  open,
  readOnly = false,
  onClose,
  order,
  clients,
  products,
  warehouses,
  vehicles,
  employees,
  stockItems,
  outgoingDeliveries,
  onViewDelivery,
  onConfirmed,
  onArrangeDelivery,
}: OrderDetailDrawerProps) {
  const queryClient = useQueryClient()
  const { isAdmin, isManager } = useAuth()
  const canManage = !readOnly && (isAdmin || isManager)
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false)
  const [isCompletingDelivery, setIsCompletingDelivery] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [orderToCancel, setOrderToCancel] = useState<SalesOrderRecord | null>(null)

  const confirmMutation = useConfirmSalesOrder()
  const cancelMutation = useCancelSalesOrder()

  const client = useMemo(
    () => (order?.clientId ? clients.find((c) => c.id === order.clientId) : null),
    [order, clients],
  )

  const productMap = useMemo(() => new Map((products || []).map((p) => [p.id, p])), [products])
  const vehicleMap = useMemo(() => new Map((vehicles || []).map((v) => [v.id, v])), [vehicles])
  const employeeMap = useMemo(() => new Map((employees || []).map((e) => [e.id, e])), [employees])

  // Find active outgoing deliveries tied to this order
  const tiedDeliveries = useMemo(() => {
    if (!order?.id) return []
    return (outgoingDeliveries || []).filter(
      (d) => d.salesOrderId === order.id && d.status !== 'CANCELLED',
    )
  }, [order, outgoingDeliveries])

  const activeDelivery =
    tiedDeliveries.find((delivery) => delivery.status === 'DISPATCHED') ||
    tiedDeliveries.find((delivery) => ['DRAFT', 'SCHEDULED'].includes(delivery.status)) ||
    tiedDeliveries[0] ||
    null

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
  }, [order, activeDelivery?.status])

  if (!order) return null

  const items = order.items || []
  const grossTotal = items.reduce((sum, item) => sum + parseFloat(item?.totalAmount || '0'), 0)

  const isCancelled = order.status === 'CANCELLED'

  // Handle direct customer delivery completion
  const handleConfirmCustomerDelivery = async () => {
    if (
      !canManage ||
      !activeDelivery ||
      activeDelivery.status !== 'DISPATCHED' ||
      isCompletingDelivery
    )
      return
    if (
      !window.confirm(
        'Complete this delivery? This deducts the shipment quantities from stock, updates order progress, and releases its vehicle.',
      )
    )
      return
    try {
      setIsCompletingDelivery(true)
      setErrorMessage('')
      await completeOutgoingDeliveryApi(activeDelivery.id)

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: STOCK_ITEMS_QUERY_KEY }),
      ])

      toast.success(
        `Delivery ${activeDelivery.deliveryNumber} confirmed! Stock and order progress have been updated.`,
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
      if (!canManage || confirmMutation.isPending) return
      setErrorMessage('')
      const confirmed = await confirmMutation.mutateAsync(order.id)
      onConfirmed?.(confirmed)
    } catch (err) {
      setErrorMessage(getErrorMessage(err))
    }
  }

  // Keep the selected identity stable while cancellation is reviewed.
  const handleCancelOrder = () => {
    if (canManage && !cancelMutation.isPending) setOrderToCancel(order)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="w-[94vw] max-w-3xl sm:max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-5 gap-3 overflow-hidden">
          <DialogHeader className="pb-0 shrink-0">
            <DialogTitle className="text-xl font-semibold tracking-tight flex flex-wrap items-center gap-2 pr-6">
              {order.orderNumber}
              {order.status === 'DRAFT' && (
                <Badge
                  variant="outline"
                  className="bg-status-warning text-status-warning-foreground border-status-warning-foreground/20 text-xs"
                >
                  Draft
                </Badge>
              )}
              {order.status === 'CONFIRMED' && (
                <Badge
                  variant="outline"
                  className="bg-status-info text-status-info-foreground border-status-info-foreground/20 text-xs"
                >
                  Stock Reserved
                </Badge>
              )}
              {order.status === 'PARTIALLY_DELIVERED' && (
                <Badge
                  variant="outline"
                  className="bg-status-info text-status-info-foreground border-status-info-foreground/20 text-xs"
                >
                  In Transit
                </Badge>
              )}
              {order.status === 'DELIVERED' && (
                <Badge
                  variant="outline"
                  className="bg-status-success text-status-success-foreground border-status-success-foreground/20 text-xs"
                >
                  Delivered & Closed
                </Badge>
              )}
              {order.status === 'CANCELLED' && (
                <Badge
                  variant="outline"
                  className="bg-destructive/5 text-destructive border-destructive/20 text-xs"
                >
                  Cancelled
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Placed on {new Date(order.orderedAt || order.createdAt).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive" className="shrink-0">
              <AlertCircle className="size-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-3.5 min-h-0 flex-1 overflow-y-auto pr-1">
            {/* Lifecycle Stepper */}
            <div className="rounded-lg bg-secondary p-4">
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                {/* Step 1: Draft */}
                <div className="flex flex-col items-center">
                  <div
                    className={`size-7 rounded-md flex items-center justify-center text-xs font-medium transition-colors ${
                      isCancelled
                        ? 'bg-muted text-muted-foreground'
                        : currentStep >= 1
                          ? 'bg-primary-contrast text-primary-contrast-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > 1 && !isCancelled ? <Check className="size-3.5" /> : '1'}
                  </div>
                  <span className="font-medium text-foreground mt-1.5 text-xs">Draft</span>
                  <span className="text-xs text-muted-foreground">Order Planned</span>
                </div>

                {/* Step 2: Confirmed */}
                <div className="flex flex-col items-center">
                  <div
                    className={`size-7 rounded-md flex items-center justify-center text-xs font-medium transition-colors ${
                      isCancelled
                        ? 'bg-muted text-muted-foreground'
                        : currentStep >= 2
                          ? 'bg-status-info-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > 2 && !isCancelled ? <Check className="size-3.5" /> : '2'}
                  </div>
                  <span className="font-medium text-foreground mt-1.5 text-xs">Confirmed</span>
                  <span className="text-xs text-muted-foreground">Stock Reserved</span>
                </div>

                {/* Step 3: In Transit */}
                <div className="flex flex-col items-center">
                  <div
                    className={`size-7 rounded-md flex items-center justify-center text-xs font-medium transition-colors ${
                      isCancelled
                        ? 'bg-muted text-muted-foreground'
                        : currentStep >= 3
                          ? 'bg-status-info-foreground text-background'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {currentStep > 3 && !isCancelled ? <Check className="size-3.5" /> : '3'}
                  </div>
                  <span className="font-medium text-foreground mt-1.5 text-xs">In Transit</span>
                  <span className="text-xs text-muted-foreground">Fleet Dispatched</span>
                </div>

                {/* Step 4: Delivered */}
                <div className="flex flex-col items-center">
                  <div
                    className={`size-7 rounded-md flex items-center justify-center text-xs font-medium transition-colors ${
                      isCancelled
                        ? 'bg-destructive/10 text-destructive'
                        : currentStep === 4
                          ? 'bg-status-success-foreground text-background'
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
                  <span className="font-medium text-foreground mt-1.5 text-xs">Delivered</span>
                  <span className="text-xs text-muted-foreground">Customer Received</span>
                </div>
              </div>
            </div>

            {/* THE 3 CORE QUESTIONS GUIDANCE BANNER */}
            {order.status === 'DRAFT' && (
              <div className="rounded-lg bg-secondary p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Clock className="size-4 shrink-0 text-status-warning-foreground mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-foreground">What just happened?</p>
                    <p className="text-muted-foreground">
                      Order <span className="font-medium text-foreground">{order.orderNumber}</span>{' '}
                      was recorded as a Draft.
                    </p>
                    <p className="font-medium text-foreground mt-2">What is its current state?</p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-status-warning-foreground">
                        Draft (Unconfirmed)
                      </span>{' '}
                      — Inventory has been planned, but physical stock is not locked yet.
                    </p>
                    <p className="font-medium text-foreground mt-2">What should you do next?</p>
                    <p className="text-muted-foreground">
                      Confirm the order to atomically reserve the items in the warehouse and prepare
                      for shipment.
                    </p>
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelOrder}
                      disabled={!canManage || cancelMutation.isPending}
                      className="text-ui text-destructive hover:bg-destructive/5 border-destructive/30"
                    >
                      <X className="size-3 mr-1" />
                      Cancel Order
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleConfirmOrder}
                      disabled={!canManage || confirmMutation.isPending}
                      className="font-medium text-ui"
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
                )}
              </div>
            )}

            {order.status === 'PARTIALLY_DELIVERED' && canManage && onArrangeDelivery && (
              <Button variant="outline" size="sm" onClick={() => onArrangeDelivery(order.id)}>
                Arrange Remaining Delivery
              </Button>
            )}
            {order.status === 'CONFIRMED' && (
              <div className="flex flex-col gap-3 rounded-lg bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2.5">
                  <ShieldCheck className="size-4 shrink-0 text-status-info-foreground" />
                  <div className="min-w-0 text-sm">
                    <p className="font-medium text-foreground">Order confirmed</p>
                    <p className="text-muted-foreground">
                      Stock is reserved and ready for delivery.
                    </p>
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex items-center justify-end gap-2 border-t border-border pt-3 sm:shrink-0 sm:border-0 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCancelOrder}
                      disabled={!canManage || cancelMutation.isPending}
                      className="text-ui text-destructive hover:bg-destructive/5 border-destructive/30"
                    >
                      <X className="size-3 mr-1" />
                      Cancel Order
                    </Button>
                    {(!activeDelivery || activeDelivery.status === 'DELIVERED') && (
                      <Button
                        size="sm"
                        disabled={!canManage}
                        onClick={() =>
                          onArrangeDelivery
                            ? onArrangeDelivery(order.id)
                            : setIsDispatchModalOpen(true)
                        }
                        className="font-medium text-ui"
                      >
                        <span className="flex items-center gap-1.5">
                          <Truck className="size-3.5" />
                          Arrange Delivery
                        </span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeDelivery?.status === 'DISPATCHED' && (
              <div className="rounded-lg bg-secondary p-4 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <Truck className="size-4 shrink-0 text-status-info-foreground mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-foreground">What just happened?</p>
                    <p className="text-muted-foreground">
                      The delivery truck has been dispatched from the warehouse and is currently in
                      transit.
                    </p>
                    <p className="font-medium text-foreground mt-2">What is its current state?</p>
                    <p className="text-muted-foreground">
                      <span className="font-medium text-status-info-foreground">In Transit</span> —
                      Delivery{' '}
                      <span className="font-medium text-foreground">
                        {activeDelivery?.deliveryNumber || 'Active Trip'}
                      </span>{' '}
                      is en route to {order.deliveryAddress}.
                    </p>
                    <p className="font-medium text-foreground mt-2">What should you do next?</p>
                    <p className="text-muted-foreground">
                      Once the customer inspects and signs for the shipment, click below to confirm
                      delivery and complete the order.
                    </p>
                  </div>
                </div>

                {!readOnly && (
                  <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
                    <Button
                      size="sm"
                      onClick={handleConfirmCustomerDelivery}
                      disabled={!canManage || isCompletingDelivery}
                      className="font-medium text-ui"
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
                )}
              </div>
            )}

            {order.status === 'DELIVERED' && (
              <div className="rounded-lg bg-status-success p-4 flex items-center gap-3">
                <CheckCircle2 className="size-5 shrink-0 text-status-success-foreground" />
                <div className="text-sm">
                  <p className="font-semibold text-status-success-foreground">
                    Order Successfully Completed
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    Goods have been delivered to customer and inventory stock was deducted. No
                    further action required.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 sm:gap-6">
              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5 text-ui font-medium text-muted-foreground">
                  <Building2 className="size-3.5" aria-hidden="true" />
                  Customer
                </div>
                <div className="text-sm font-medium text-foreground">
                  {client?.name || `Customer #${order.clientId}`}
                </div>
                <div className="text-xs text-muted-foreground">
                  {client?.phone || 'No phone recorded'}
                </div>
                <div className="text-xs text-muted-foreground">{client?.email || ''}</div>
              </div>

              <div className="min-w-0 space-y-1.5">
                <div className="flex items-center gap-1.5 text-ui font-medium text-muted-foreground">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  Destination Address
                </div>
                <div className="font-medium text-foreground">
                  {order.deliveryAddress || 'Store Counter / Direct Pick-up'}
                </div>
                {order.notes && (
                  <div className="pt-1 text-xs text-muted-foreground">Note: {order.notes}</div>
                )}
              </div>
            </div>

            {/* Active Fleet / Delivery Trip Tracker */}
            {activeDelivery && (
              <div className="border-y border-border py-4 text-sm flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                    <Truck className="size-4 text-muted-foreground" />
                    Shipment Trip: {activeDelivery.deliveryNumber}
                  </div>
                  <div className="flex items-center gap-2">
                    {onViewDelivery && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onViewDelivery(activeDelivery.id)}
                      >
                        View Delivery
                      </Button>
                    )}
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        activeDelivery.status === 'DELIVERED'
                          ? 'bg-status-success text-status-success-foreground'
                          : 'bg-status-info text-status-info-foreground'
                      }`}
                    >
                      {activeDelivery.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-muted-foreground pt-1 border-t border-border">
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
                      {activeDelivery.driverEmployeeId &&
                      employeeMap.get(activeDelivery.driverEmployeeId)
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
            <div className="overflow-hidden">
              <div className="pb-3 text-base font-semibold text-foreground border-b border-border flex flex-wrap items-center justify-between gap-2">
                <span>Order Cargo Items ({(order.items || []).length})</span>
                <span className="text-sm tabular-nums">
                  Total: ₱{grossTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="divide-y divide-border text-sm">
                {(order.items || []).length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground text-sm">
                    No line items recorded for this order.
                  </div>
                ) : (
                  (order.items || []).map((item, idx) => {
                    const product = item?.inventoryItemId
                      ? productMap.get(item.inventoryItemId)
                      : null
                    return (
                      <div
                        key={item.id ?? item.lineNumber ?? idx}
                        className="py-4 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-medium text-foreground">
                            {product ? product.name : `Product #${item.inventoryItemId}`}
                            {product?.variety && (
                              <span className="ml-1 text-muted-foreground font-normal">
                                ({product.variety})
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-1.5 mt-1">
                            <span>
                              Qty:{' '}
                              <span className="font-medium text-foreground">
                                {item.quantity} {formatProductUnit(product?.unit)}
                              </span>{' '}
                              @ ₱{parseFloat(item.unitPrice || '0').toFixed(2)}
                            </span>
                            <span className="text-muted-foreground">
                              • Warehouse is selected during delivery preparation
                            </span>
                          </div>
                        </div>
                        <div className="text-foreground text-sm tabular-nums">
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

      {orderToCancel && (
        <SalesOrderCancelModal
          order={orderToCancel}
          onClose={() => setOrderToCancel(null)}
          onConfirm={(id) => {
            if (!canManage) throw new Error('You do not have permission to cancel orders.')
            return cancelMutation.mutateAsync(id)
          }}
        />
      )}

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
