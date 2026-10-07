import { useState, useMemo } from 'react'
import { CheckCircle2, Eye, MoreHorizontal, Plus, Receipt, Search, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { OrderModal, type OrderFormValues } from './OrderModal'
import { OrderDetailDrawer } from './OrderDetailDrawer'
import { QuickDispatchModal } from './QuickDispatchModal'
import { DeliveryDetailModal } from '@/components/deliveries/shared/DeliveryDetailModal'
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
import { getSalesOrderDeliveryDisplay } from '@/features/crm/sales-orders.presentation'
import { getErrorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'

export type OrderTabFilter = 'Active' | 'Completed' | 'Cancelled'

export type OrdersViewProps = {
  onNavigateToPurchases?: () => void
  onNavigateToDeliveries?: (
    tab?: 'schedule' | 'status' | 'completed' | 'incoming' | 'history',
  ) => void
  onNavigateToInventory?: () => void
}

type SalesOrderPrimaryAction =
  | 'confirm'
  | 'prepare-delivery'
  | 'continue-delivery'
  | 'view-delivery'
  | 'confirm-arrival'
  | 'view-order'

function getSalesOrderPrimaryAction(
  order: SalesOrderRecord,
  delivery?: OutgoingDeliveryRecord,
): SalesOrderPrimaryAction {
  if (order.status === 'DELIVERED' || order.status === 'CANCELLED') return 'view-order'
  if (order.status === 'DRAFT') return 'confirm'
  if (delivery?.status === 'DISPATCHED') return 'confirm-arrival'
  if (delivery && delivery.status !== 'DELIVERED') return 'view-delivery'
  if (order.status === 'PARTIALLY_DELIVERED') return 'continue-delivery'
  return 'prepare-delivery'
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
  const [deliveryToView, setDeliveryToView] = useState<number | null>(null)

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

  // The modal closes once the backend creates the sales order successfully.
  const handleSaveOrder = async (values: OrderFormValues) => {
    await createOrderMutation.mutateAsync({
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
  }

  // Confirm order action
  const handleConfirmOrder = async (order: SalesOrderRecord) => {
    try {
      await confirmOrderMutation.mutateAsync(order.id)
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  // Cancel order action
  const handleCancelOrder = async (order: SalesOrderRecord) => {
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
  const handleConfirmArrival = async (deliveryId: number, orderNo: string) => {
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

  const orderRows = filteredOrders.map((order) => {
    const items = order.items || []
    const itemSummary = items
      .map((item) => {
        const product = productMap.get(item.inventoryItemId)
        return `${product?.name || `Product #${item.inventoryItemId}`} ×${item.quantity}`
      })
      .join(', ')
    const itemLabel = items.length === 1 ? itemSummary : `${items.length} items`
    const orderTotal = items.reduce((sum, item) => {
      const itemTotal =
        parseFloat(item.totalAmount) || parseFloat(item.unitPrice) * parseFloat(item.quantity) || 0
      return sum + itemTotal
    }, 0)
    const orderDate = new Date(order.orderedAt || order.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    const activeDelivery = outgoingDeliveries.find(
      (delivery) => delivery.salesOrderId === order.id && delivery.status !== 'CANCELLED',
    )
    const deliveryDisplay = getSalesOrderDeliveryDisplay(order, activeDelivery, outgoingDeliveries)

    return {
      order,
      client: clientMap.get(order.clientId),
      itemSummary,
      itemLabel,
      orderTotal,
      orderDate,
      activeDelivery,
      deliveryDisplay,
    }
  })

  const openOrderDetails = (order: SalesOrderRecord) => {
    setSelectedOrderRecord(order)
    setIsDetailDrawerOpen(true)
  }

  const handlePrimaryAction = (
    action: SalesOrderPrimaryAction,
    order: SalesOrderRecord,
    delivery?: OutgoingDeliveryRecord,
  ) => {
    switch (action) {
      case 'confirm':
        void handleConfirmOrder(order)
        break
      case 'prepare-delivery':
      case 'continue-delivery':
        setDispatchOrder(order)
        break
      case 'view-delivery':
        if (delivery) setDeliveryToView(delivery.id)
        break
      case 'confirm-arrival':
        if (!delivery) break
        if (onNavigateToDeliveries) onNavigateToDeliveries('completed')
        else void handleConfirmArrival(delivery.id, order.orderNumber)
        break
      case 'view-order':
        openOrderDetails(order)
        break
    }
  }

  const salesOrderColumns: ColumnDef<(typeof orderRows)[number]>[] = [
    {
      id: 'order',
      header: 'Order',
      width: 145,
      className: 'min-w-[145px]',
      cell: ({ row: { order, orderDate } }) => (
        <div className="flex flex-col gap-1">
          <span className="whitespace-nowrap font-mono text-xs font-semibold text-foreground">
            {order.orderNumber}
          </span>
          <span className="text-[11px] text-muted-foreground">{orderDate}</span>
        </div>
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      width: 210,
      className: 'min-w-[180px] max-w-[250px]',
      cell: ({ row: { order, client } }) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span
            className="truncate font-semibold text-foreground"
            title={client?.name || `Customer #${order.clientId}`}
          >
            {client?.name || `Customer #${order.clientId}`}
          </span>
          <span
            className="truncate text-[11px] text-muted-foreground"
            title={order.deliveryAddress}
          >
            {order.deliveryAddress || 'No address specified'}
          </span>
        </div>
      ),
    },
    {
      id: 'items',
      header: 'Items',
      width: 165,
      className: 'hidden max-w-[220px] lg:table-cell',
      headerClassName: 'hidden lg:table-cell',
      cell: ({ row: { order, itemLabel, itemSummary } }) => {
        const item = order.items?.length === 1 ? order.items[0] : undefined
        const itemName = item
          ? productMap.get(item.inventoryItemId)?.name || `Product #${item.inventoryItemId}`
          : itemLabel || 'No items'
        return (
          <span className="block truncate text-foreground" title={itemSummary}>
            {itemName}
            {item && <span className="font-normal text-muted-foreground"> ×{item.quantity}</span>}
          </span>
        )
      },
    },
    {
      id: 'total',
      header: 'Total',
      width: 110,
      align: 'right',
      className: 'whitespace-nowrap font-semibold tabular-nums text-foreground',
      cell: ({ row: { orderTotal } }) =>
        `₱${orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    },
    {
      id: 'delivery',
      header: 'Delivery',
      width: 155,
      className: 'whitespace-nowrap',
      cell: ({ row: { deliveryDisplay } }) => (
        <div className="flex items-start flex-col gap-1">
          <Badge
            variant="outline"
            className={cn('whitespace-nowrap px-2', deliveryDisplay.badgeClassName)}
          >
            {deliveryDisplay.label}
          </Badge>
          {deliveryDisplay.supportingText && (
            <span className="text-[11px] text-muted-foreground">
              {deliveryDisplay.supportingText}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'action',
      header: 'Action',
      width: 185,
      align: 'right',
      className: 'whitespace-nowrap',
      cell: ({ row: { order, activeDelivery } }) => {
        const primaryAction = getSalesOrderPrimaryAction(order, activeDelivery)
        const primaryLabel: Record<SalesOrderPrimaryAction, string> = {
          confirm: 'Confirm',
          'prepare-delivery': 'Prepare Delivery',
          'continue-delivery': 'Continue Delivery',
          'view-delivery': 'View Delivery',
          'confirm-arrival': 'Confirm Arrival',
          'view-order': 'View',
        }
        const primaryVariant = {
          confirm: 'default',
          'prepare-delivery': 'outline',
          'continue-delivery': 'secondary',
          'view-delivery': 'ghost',
          'confirm-arrival': 'secondary',
          'view-order': 'ghost',
        } as const
        const showViewOrder = primaryAction !== 'view-order'
        const showViewDelivery = Boolean(activeDelivery) && primaryAction !== 'view-delivery'
        const canCancelOrder = order.status === 'DRAFT' || order.status === 'CONFIRMED'

        return (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <Button
              size="sm"
              variant={primaryVariant[primaryAction]}
              disabled={primaryAction === 'confirm' && confirmOrderMutation.isPending}
              onClick={() => handlePrimaryAction(primaryAction, order, activeDelivery)}
            >
              {primaryLabel[primaryAction]}
            </Button>

            {(showViewOrder || showViewDelivery || canCancelOrder) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 text-muted-foreground"
                    aria-label={`More actions for ${order.orderNumber}`}
                    title="More actions"
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuGroup>
                    {showViewOrder && (
                      <DropdownMenuItem onSelect={() => openOrderDetails(order)}>
                        <Eye className="mr-2 size-3.5" />
                        View Order
                      </DropdownMenuItem>
                    )}
                    {showViewDelivery && activeDelivery && (
                      <DropdownMenuItem onSelect={() => setDeliveryToView(activeDelivery.id)}>
                        View Delivery
                      </DropdownMenuItem>
                    )}
                    {canCancelOrder && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={cancelOrderMutation.isPending}
                          onSelect={() => void handleCancelOrder(order)}
                          className="text-destructive focus:text-destructive"
                        >
                          Cancel Order
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-lg font-bold tracking-tight text-foreground">Sales Orders</h1>
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
            aria-label="Search orders"
            placeholder="Search order # or customer..."
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
                ? 'Try searching with a different order number, customer name, or item.'
                : activeStatus === 'Active'
                  ? 'Click "Create Sales Order" to record your first customer purchase!'
                  : 'Orders moved into this status will appear here.'}
            </p>
          </div>
        </Card>
      ) : (
        <DataTable
          data={orderRows}
          columns={salesOrderColumns}
          getRowKey={({ order }) => order.id}
          pagination={false}
          appearance="subtle"
          onRowClick={({ order }) => openOrderDetails(order)}
          rowClassName={({ deliveryDisplay }) =>
            cn(
              '[&_td:first-child]:border-l-2 [&_td:first-child]:border-l-transparent!',
              deliveryDisplay.rowClassName,
            )
          }
          tableClassName="table-fixed min-w-[760px] lg:min-w-[960px]"
        />
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
        onViewDelivery={(id) => {
          setIsDetailDrawerOpen(false)
          setDeliveryToView(id)
        }}
      />

      {deliveryToView !== null && (
        <DeliveryDetailModal
          open
          deliveryId={deliveryToView}
          onClose={() => setDeliveryToView(null)}
        />
      )}

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
