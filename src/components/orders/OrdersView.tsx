import { useState, useMemo } from 'react'
import {
  CheckCircle2,
  Eye,
  MapPin,
  Plus,
  Receipt,
  Search,
  Send,
  Truck,
  Warehouse as WarehouseIcon,
  X,
  XCircle,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { OrderModal, type OrderFormValues } from './OrderModal'
import { OrderDetailDrawer } from './OrderDetailDrawer'
import { QuickDispatchModal } from './QuickDispatchModal'
import { useClients } from '@/features/crm/clients.hooks'
import { useProducts } from '@/features/products/products.hooks'
import { useWarehouses } from '@/features/logistics/warehouses.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import { useDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { useOutgoingDeliveries } from '@/features/logistics/outgoing-deliveries.hooks'
import { completeOutgoingDeliveryApi } from '@/features/logistics/outgoing-deliveries.api'
import {
  useSalesOrders,
  useCreateSalesOrder,
  useConfirmSalesOrder,
  useCancelSalesOrder,
  SALES_ORDERS_QUERY_KEY,
} from '@/features/crm/sales-orders.hooks'
import { DELIVERIES_QUERY_KEY } from '@/features/logistics/outgoing-deliveries.hooks'
import { VEHICLES_QUERY_KEY } from '@/features/logistics/delivery-vehicles.hooks'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthContext'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import { getErrorMessage } from '@/lib/api-client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export type OrderTabFilter = 'Active' | 'Completed' | 'Cancelled'

export type OrdersViewProps = {
  onNavigateToPurchases?: () => void
  onNavigateToDeliveries?: (tab?: 'schedule' | 'status' | 'completed' | 'incoming' | 'history') => void
  onNavigateToInventory?: () => void
}

export function OrdersView({
  onNavigateToPurchases,
  onNavigateToDeliveries,
  onNavigateToInventory,
}: OrdersViewProps = {}) {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [activeStatus, setActiveStatus] = useState<OrderTabFilter>('Active')

  // Modals & Drawers state
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [selectedOrderRecord, setSelectedOrderRecord] = useState<SalesOrderRecord | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [dispatchOrder, setDispatchOrder] = useState<SalesOrderRecord | null>(null)

  // Real backend queries
  const { data: salesOrders = [], isLoading: isLoadingOrders } = useSalesOrders()
  const { data: clients = [] } = useClients()
  const { data: products = [] } = useProducts()
  const { data: warehouses = [] } = useWarehouses()
  const { data: stockItems = [] } = useStockItems()
  const { data: vehicles = [] } = useDeliveryVehicles({ includeInactive: 'true' })
  const { data: employees = [] } = useEmployees({ includeInactive: 'true' })
  const { data: outgoingDeliveries = [] } = useOutgoingDeliveries()

  // Mutations
  const createOrderMutation = useCreateSalesOrder()
  const confirmOrderMutation = useConfirmSalesOrder()
  const cancelOrderMutation = useCancelSalesOrder()

  const { user } = useAuth()
  const cashier = user?.fullName || user?.email || 'Current User'

  // Lookups
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])
  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const warehouseMap = useMemo(() => new Map(warehouses.map((w) => [w.id, w])), [warehouses])
  const stockMap = useMemo(() => new Map(stockItems.map((s) => [s.id, s])), [stockItems])

  // Sync selectedOrderRecord if the list updates
  const activeSelectedOrder = useMemo(() => {
    if (!selectedOrderRecord) return null
    return salesOrders.find((o) => o.id === selectedOrderRecord.id) || selectedOrderRecord
  }, [salesOrders, selectedOrderRecord])

  // Live tab counters
  const statusCount = (status: OrderTabFilter) => {
    if (status === 'Active') {
      return salesOrders.filter((o) =>
        ['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED'].includes(o.status),
      ).length
    }
    if (status === 'Completed') {
      return salesOrders.filter((o) => o.status === 'DELIVERED').length
    }
    if (status === 'Cancelled') {
      return salesOrders.filter((o) => o.status === 'CANCELLED').length
    }
    return 0
  }

  // Filter orders by active tab and search
  const filteredOrders = useMemo(() => {
    return salesOrders.filter((order) => {
      let matchesTab = false
      if (activeStatus === 'Active') {
        matchesTab = ['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order.status)
      } else if (activeStatus === 'Completed') {
        matchesTab = order.status === 'DELIVERED'
      } else if (activeStatus === 'Cancelled') {
        matchesTab = order.status === 'CANCELLED'
      }

      if (!matchesTab) return false

      if (!searchTerm.trim()) return true
      const term = searchTerm.toLowerCase().trim()
      const client = clientMap.get(order.clientId)
      const clientName = client?.name.toLowerCase() || ''
      const orderNo = order.orderNumber.toLowerCase()
      const address = order.deliveryAddress.toLowerCase()

      const hasMatchingProduct = (order.items || []).some((item) => {
        const prod = productMap.get(item.inventoryItemId)
        return prod?.name.toLowerCase().includes(term) || false
      })

      return (
        orderNo.includes(term) ||
        clientName.includes(term) ||
        address.includes(term) ||
        hasMatchingProduct
      )
    })
  }, [salesOrders, activeStatus, searchTerm, clientMap, productMap])

  // Submit handler: creates sales order with backend allocations and immediately opens detail drawer
  const handleSaveOrder = async (values: OrderFormValues) => {
    const created = await createOrderMutation.mutateAsync({
      clientId: values.clientId,
      deliveryAddress: values.deliveryAddress,
      notes: values.notes,
      items: values.lines.map((line) => ({
        inventoryItemId: line.productId,
        quantity: String(line.quantity),
        unitPrice: String(line.unitPrice),
        allocations: line.stockItemId
          ? [{ stockItemId: line.stockItemId, quantity: String(line.quantity) }]
          : undefined,
      })),
    })

    setIsOrderModalOpen(false)
    if (created) {
      setSelectedOrderRecord(created)
      setIsDetailDrawerOpen(true)
    }
  }

  // Confirm order action
  const handleConfirmOrder = async (order: SalesOrderRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await confirmOrderMutation.mutateAsync(order.id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // Cancel order action
  const handleCancelOrder = async (order: SalesOrderRecord, e: React.MouseEvent) => {
    e.stopPropagation()
    if (
      !window.confirm(
        `Are you sure you want to cancel order ${order.orderNumber}? Any reserved stock allocations will be released.`,
      )
    ) {
      return
    }
    try {
      await cancelOrderMutation.mutateAsync(order.id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // Direct arrival confirmation
  const handleConfirmArrival = async (deliveryId: number, orderNo: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await completeOutgoingDeliveryApi(deliveryId)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SALES_ORDERS_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: DELIVERIES_QUERY_KEY }),
        queryClient.invalidateQueries({ queryKey: VEHICLES_QUERY_KEY }),
      ])
      toast.success(`Delivery completed for order ${orderNo}! Physical stock deducted.`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // Helper for status badge
  const renderStatusBadge = (status: SalesOrderRecord['status'], activeDeliveryStatus?: string) => {
    if (activeDeliveryStatus === 'DISPATCHED') {
      return (
        <Badge
          variant="outline"
          className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 flex items-center gap-1"
        >
          <Truck className="size-3 shrink-0 animate-pulse text-amber-600" />
          <span>In Transit</span>
        </Badge>
      )
    }

    switch (status) {
      case 'DRAFT':
        return (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
          >
            Draft (Allocated)
          </Badge>
        )
      case 'CONFIRMED':
        return (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-blue-500/10 text-blue-600 border-blue-500/30 flex items-center gap-1"
          >
            <CheckCircle2 className="size-3 shrink-0" />
            <span>Confirmed</span>
          </Badge>
        )
      case 'PARTIALLY_DELIVERED':
        return (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-purple-500/10 text-purple-600 border-purple-500/30"
          >
            Partial Delivery
          </Badge>
        )
      case 'DELIVERED':
        return (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/30 flex items-center gap-1"
          >
            <CheckCircle2 className="size-3 shrink-0" />
            <span>Delivered & Closed</span>
          </Badge>
        )
      case 'CANCELLED':
        return (
          <Badge
            variant="outline"
            className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-rose-500/10 text-rose-600 border-rose-500/30 flex items-center gap-1"
          >
            <XCircle className="size-3 shrink-0" />
            <span>Cancelled</span>
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {status}
          </Badge>
        )
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <StatusTabNav
        activeTab={activeStatus}
        onTabChange={(tab) => setActiveStatus(tab as OrderTabFilter)}
        tabs={[
          {
            value: 'Active',
            label: 'Active Orders',
            count: statusCount('Active'),
            icon: <CheckCircle2 className="size-3.5" />,
            accent: 'green',
          },
          {
            value: 'Completed',
            label: 'Completed Orders',
            count: statusCount('Completed'),
            icon: <CheckCircle2 className="size-3.5" />,
            accent: 'blue',
          },
          {
            value: 'Cancelled',
            label: 'Cancelled Orders',
            count: statusCount('Cancelled'),
            icon: <XCircle className="size-3.5" />,
            accent: 'red',
          },
        ]}
      />

      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search order #, client, address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>

        <Button
          size="sm"
          onClick={() => {
            setIsOrderModalOpen(true)
          }}
          className="gap-1.5 font-semibold text-xs shadow-xs"
        >
          <Plus className="size-4" />
          Create Sales Order
        </Button>
      </div>

      {/* Orders Table */}
      {isLoadingOrders ? (
        <Card className="flex min-h-[360px] items-center justify-center border-dashed bg-muted/20 shadow-xs">
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <Spinner className="size-6 text-primary" />
            <span className="text-xs text-muted-foreground font-medium">
              Loading sales orders from database...
            </span>
          </div>
        </Card>
      ) : filteredOrders.length === 0 ? (
        <Card className="flex min-h-[360px] items-center justify-center border-dashed bg-muted/20 shadow-xs">
          <div className="flex flex-col items-center justify-center text-center">
            <Receipt className="size-8 text-muted-foreground/40" />
            <span className="text-sm font-semibold text-foreground mt-2">
              {searchTerm.trim()
                ? `No ${activeStatus.toLowerCase()} orders match "${searchTerm.trim()}"`
                : `No ${activeStatus.toLowerCase()} orders found`}
            </span>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {searchTerm.trim()
                ? 'Try searching with a different order number, client name, or item.'
                : activeStatus === 'Active'
                  ? 'Click "Create Sales Order" to record your first client purchase!'
                  : 'Orders moved into this status will appear here.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden border-border/80 shadow-xs">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="text-xs font-semibold">Order Number</TableHead>
                <TableHead className="text-xs font-semibold">Client / Customer</TableHead>
                <TableHead className="text-xs font-semibold">Items Ordered</TableHead>
                <TableHead className="text-xs font-semibold">Fulfillment Warehouse</TableHead>
                <TableHead className="text-xs font-semibold text-right">Amount (₱)</TableHead>
                <TableHead className="text-xs font-semibold text-center">Status</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.map((order) => {
                const client = clientMap.get(order.clientId)
                const items = order.items || []

                // Summary of items
                const itemSummary = items
                  .map((item) => {
                    const prod = productMap.get(item.inventoryItemId)
                    const name = prod ? prod.name : `Product #${item.inventoryItemId}`
                    return `${name} x${item.quantity}`
                  })
                  .join(', ')

                // Compute total amount
                const orderTotal = items.reduce((sum, item) => {
                  const itemTotal =
                    parseFloat(item.totalAmount) ||
                    parseFloat(item.unitPrice) * parseFloat(item.quantity) ||
                    0
                  return sum + itemTotal
                }, 0)

                // Date
                const orderDate = new Date(order.orderedAt || order.createdAt).toLocaleDateString(
                  'en-US',
                  {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  },
                )

                // Check tied outgoing delivery
                const activeDelivery = outgoingDeliveries.find(
                  (d) => d.salesOrderId === order.id && d.status !== 'CANCELLED',
                )

                // Derive warehouse
                let sourceWarehouseName = '—'
                for (const item of items) {
                  for (const alloc of item.allocations || []) {
                    const st = stockMap.get(alloc.stockItemId)
                    if (st?.warehouseId) {
                      const wh = warehouseMap.get(st.warehouseId)
                      if (wh) {
                        sourceWarehouseName = wh.name
                        break
                      }
                    }
                  }
                  if (sourceWarehouseName !== '—') break
                }

                return (
                  <TableRow
                    key={order.id}
                    onClick={() => {
                      setSelectedOrderRecord(order)
                      setIsDetailDrawerOpen(true)
                    }}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <TableCell className="font-mono text-xs font-bold text-foreground">
                      <div className="flex items-center gap-1.5">
                        <Receipt className="size-3.5 text-rose-600 shrink-0" />
                        <span className="hover:underline text-primary">{order.orderNumber}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-sans block mt-0.5">
                        {orderDate}
                      </span>
                    </TableCell>

                    <TableCell className="text-xs text-foreground">
                      <div className="font-semibold text-foreground">
                        {client?.name || `Customer #${order.clientId}`}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate max-w-[200px]">
                        <MapPin className="size-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{order.deliveryAddress}</span>
                      </div>
                    </TableCell>

                    <TableCell
                      className="text-xs text-foreground/90 max-w-[220px] truncate"
                      title={itemSummary}
                    >
                      {itemSummary || 'No items listed'}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <WarehouseIcon className="size-3.5 text-muted-foreground shrink-0" />
                        <span className="text-foreground/90 font-medium">
                          {sourceWarehouseName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs font-bold text-foreground text-right font-mono">
                      ₱{orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </TableCell>

                    <TableCell className="text-center">
                      {renderStatusBadge(order.status, activeDelivery?.status)}
                    </TableCell>

                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Status Action 1: Draft -> Confirm */}
                        {order.status === 'DRAFT' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => handleConfirmOrder(order, e)}
                            disabled={confirmOrderMutation.isPending}
                            className="h-7 px-2 text-xs font-semibold gap-1 text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                            title="Confirm order and reserve inventory stock"
                          >
                            <CheckCircle2 className="size-3 shrink-0" />
                            <span>Confirm</span>
                          </Button>
                        )}

                        {/* Status Action 2: Confirmed / Partial -> Dispatch */}
                        {(order.status === 'CONFIRMED' ||
                          order.status === 'PARTIALLY_DELIVERED') &&
                          activeDelivery?.status !== 'DISPATCHED' && (
                            <Button
                              size="sm"
                              onClick={() => setDispatchOrder(order)}
                              className="h-7 px-2 text-xs font-semibold gap-1 bg-amber-600 hover:bg-amber-700 text-white"
                              title="Assign vehicle and driver to dispatch"
                            >
                              <Send className="size-3 shrink-0" />
                              <span>Dispatch</span>
                            </Button>
                          )}

                        {/* Status Action 3: Dispatched -> Confirm Arrivals (leads to Deliveries Hub) */}
                        {activeDelivery?.status === 'DISPATCHED' && (
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (onNavigateToDeliveries) {
                                onNavigateToDeliveries('completed')
                              } else {
                                handleConfirmArrival(activeDelivery.id, order.orderNumber, e)
                              }
                            }}
                            className="h-7 px-2.5 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs"
                            title="Go to Deliveries Hub to confirm arrival and record receipt"
                          >
                            <CheckCircle2 className="size-3 shrink-0" />
                            <span>Confirm Arrivals</span>
                          </Button>
                        )}

                        {/* View Details Drawer */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedOrderRecord(order)
                            setIsDetailDrawerOpen(true)
                          }}
                          className="h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                          title="Open Order Details Workspace"
                        >
                          <Eye className="size-3.5" />
                        </Button>

                        {/* Destructive Cancel */}
                        {(order.status === 'DRAFT' || order.status === 'CONFIRMED') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => handleCancelOrder(order, e)}
                            disabled={cancelOrderMutation.isPending}
                            className="h-7 px-1.5 text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                            title="Cancel sales order"
                          >
                            <X className="size-3.5" />
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

      {/* Order Creation Modal */}
      {isOrderModalOpen && (
        <OrderModal
          open
          onClose={() => setIsOrderModalOpen(false)}
          onSubmit={handleSaveOrder}
          clients={clients}
          products={products}
          warehouses={warehouses}
          stockItems={stockItems}
          cashier={cashier}
          onNavigateToPurchases={onNavigateToPurchases}
          onNavigateToDeliveries={onNavigateToDeliveries}
          onNavigateToInventory={onNavigateToInventory}
        />
      )}

      {/* Guided Order Detail Drawer */}
      <OrderDetailDrawer
        open={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false)
          setSelectedOrderRecord(null)
        }}
        order={activeSelectedOrder}
        clients={clients}
        products={products}
        warehouses={warehouses}
        vehicles={vehicles}
        employees={employees}
        stockItems={stockItems}
        outgoingDeliveries={outgoingDeliveries}
      />

      {/* Quick Dispatch Modal for row actions */}
      {dispatchOrder && (
        <QuickDispatchModal
          open={Boolean(dispatchOrder)}
          onClose={() => setDispatchOrder(null)}
          order={dispatchOrder}
          vehicles={vehicles}
          employees={employees}
          warehouses={warehouses}
          stockItems={stockItems}
          onSuccess={() => {
            setDispatchOrder(null)
          }}
        />
      )}
    </div>
  )
}
