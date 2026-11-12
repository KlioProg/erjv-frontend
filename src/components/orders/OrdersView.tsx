import { CursorLookup } from '@/components/ui/CursorLookup'
import { Label } from '@/components/ui/label'
import { manilaScheduleToIso } from '@/lib/manila-schedule'
import {
  DataTableFilters,
  DataTableFilterChips,
  type DataTableFilter,
} from '@/components/ui/data-table-filters'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import type { Warehouse } from '@/features/logistics/warehouses.types'
import type { Employee } from '@/features/staffing/staffing.types'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import { useRecordsById } from '@/lib/use-records-by-id'
import { fetchOutgoingDeliveriesApi } from '@/features/logistics/outgoing-deliveries.api'
import { fetchClientByIdApi } from '@/features/crm/clients.api'
import { DataTableFooter, DataTableFrame } from '@/components/ui/DataTableFooter'
import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { useState, useMemo } from 'react'
import { CheckCircle2, Plus, Search, XCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { OrderModal, type OrderFormValues } from './OrderModal'
import { buildSalesOrderPayload } from '@/features/crm/sales-order-entry.utils'
import { OrderDetailDrawer } from './OrderDetailDrawer'
import { DeliveryDetailModal } from '@/components/deliveries/shared/DeliveryDetailModal'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import {
  useSalesOrdersPage,
  SALES_ORDERS_QUERY_KEY,
  useCreateSalesOrder,
  useConfirmSalesOrder,
  useSalesOrderById,
  useUpdateSalesOrderDraft,
} from '@/features/crm/sales-orders.hooks'
import { toast } from '@/lib/notifications'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import { fetchSalesOrderByIdApi } from '@/features/crm/sales-orders.api'
import { getSalesOrderProgressDisplay } from '@/features/crm/sales-orders.presentation'
import { getErrorMessage } from '@/lib/api-client'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { OverflowValue } from '@/components/ui/OverflowValue'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatStockCents, parseStockCents } from '@/features/logistics/stock-display'

export type OrderTabFilter = 'Active' | 'Completed' | 'Cancelled'

export type OrdersViewProps = {
  onNavigateToPurchases?: () => void
  onNavigateToDeliveries?: (
    tab?: 'schedule' | 'status' | 'completed' | 'incoming' | 'outgoing' | 'history',
    salesOrderId?: number,
    arrange?: boolean,
  ) => void
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
  const [editingOrderId, setEditingOrderId] = useState<number>()
  const [selectedOrderRecord, setSelectedOrderRecord] = useState<SalesOrderRecord | null>(null)
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false)
  const [deliveryToView, setDeliveryToView] = useState<number | null>(null)

  // Real backend queries
  const [orderStatus, setOrderStatus] = useState('ALL')
  const [partyFilter, setPartyFilter] = useState<{ id: string; name: string } | null>(null)
  const [orderedFrom, setOrderedFrom] = useState('')
  const [orderedThrough, setOrderedThrough] = useState('')
  const dateError = !!orderedFrom && !!orderedThrough && orderedFrom > orderedThrough
  const groupStatuses: SalesOrderRecord['status'][] =
    activeStatus === 'Active'
      ? ['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED']
      : activeStatus === 'Completed'
        ? ['DELIVERED']
        : ['CANCELLED']
  const specificStatus = groupStatuses.includes(orderStatus as SalesOrderRecord['status'])
    ? orderStatus
    : 'ALL'
  const orderFilters: DataTableFilter[] = [
    {
      kind: 'select',
      id: 'order-status',
      label: 'Order status',
      value: specificStatus,
      onChange: setOrderStatus,
      options: [
        { value: 'ALL', label: 'All statuses in this tab' },
        ...groupStatuses.map((value) => ({
          value,
          label: value
            .replaceAll('_', ' ')
            .toLowerCase()
            .replace(/^./, (letter) => letter.toUpperCase()),
        })),
      ],
    },
    {
      kind: 'custom',
      id: 'party',
      label: 'Customer',
      active: !!partyFilter,
      valueLabel: partyFilter?.name,
      onClear: () => setPartyFilter(null),
      content: (
        <>
          <Label htmlFor="order-party-filter">Customer</Label>
          <CursorLookup<{ id: number; name: string }>
            id="order-party-filter"
            path="/clients"
            filter={{ includeInactive: 'true' }}
            label="Customer"
            value={partyFilter?.id ?? ''}
            selectedLabel={partyFilter?.name}
            getLabel={(party) => party.name}
            onChange={(id, party) => setPartyFilter({ id, name: party.name })}
          />
        </>
      ),
    },
    ...[
      { id: 'order-from', label: 'Order date from', value: orderedFrom, set: setOrderedFrom },
      {
        id: 'order-through',
        label: 'Order date through',
        value: orderedThrough,
        set: setOrderedThrough,
      },
    ].map((field): DataTableFilter => ({
      kind: 'custom',
      id: field.id,
      label: field.label,
      active: !!field.value,
      valueLabel: field.value,
      onClear: () => field.set(''),
      content: (
        <>
          <Label htmlFor={field.id}>{field.label}</Label>
          <Input
            id={field.id}
            type="date"
            value={field.value}
            min={field.id === 'order-through' ? orderedFrom || undefined : undefined}
            max="9999-12-31"
            onChange={(event) => field.set(event.target.value)}
            aria-invalid={dateError}
          />
          <p className="text-xs text-muted-foreground">Order dates use Manila time.</p>
          {dateError && field.id === 'order-through' && (
            <p className="text-xs text-destructive">
              Choose an end date on or after the start date.
            </p>
          )}
        </>
      ),
    })),
  ]
  const ordersQuery = useSalesOrdersPage(
    {
      statuses:
        specificStatus === 'ALL' ? groupStatuses : [specificStatus as SalesOrderRecord['status']],
      q: searchTerm.trim() || undefined,
      ...(partyFilter ? { clientId: Number(partyFilter.id) } : {}),
      ...(orderedFrom ? { orderedFrom: manilaScheduleToIso(`${orderedFrom}T00:00`)! } : {}),
      ...(orderedThrough
        ? {
            orderedBefore: new Date(
              Date.parse(`${orderedThrough}T00:00:00+08:00`) + 86400000,
            ).toISOString(),
          }
        : {}),
    },
    !dateError,
  )
  const salesOrders = ordersQuery.items
  const isLoadingOrders = ordersQuery.isLoading
  const editingOrderQuery = useSalesOrderById(editingOrderId)
  const selectedDetail = useSalesOrderById(isDetailDrawerOpen ? selectedOrderRecord?.id : undefined)
  const baseClients = useMemo<Client[]>(() => [], [])
  const productsQuery = useRecordsById<InventoryItemResponse>(
    '/inventory-items',
    [
      ...salesOrders,
      ...[selectedDetail.data, editingOrderQuery.data, selectedOrderRecord].filter(
        (order): order is SalesOrderRecord => !!order,
      ),
    ].flatMap((order) => order.items.map((item) => item.inventoryItemId)),
  )
  const { data: products = [] } = productsQuery
  const stockQuery = useStockItems()
  const { data: stockItems = [] } = stockQuery
  const deliveryOrderIds = [
    ...new Set(
      [...salesOrders.map((order) => order.id), selectedOrderRecord?.id].filter(
        (id): id is number => !!id,
      ),
    ),
  ]
  const deliveryQueries = useQueries({
    queries: deliveryOrderIds.map((id) => ({
      queryKey: ['outgoing-deliveries', 'for-order', id],
      queryFn: ({ signal }) => fetchOutgoingDeliveriesApi({ salesOrderId: id }, signal),
    })),
  })
  const outgoingDeliveries = [
    ...new Map(
      deliveryQueries
        .flatMap((query) => query.data ?? [])
        .map((delivery) => [delivery.id, delivery]),
    ).values(),
  ]
  const { data: runs } = useRecordsById<DeliveryRunRecord>(
    '/delivery-runs',
    outgoingDeliveries.map((delivery) => delivery.runId),
  )
  const { data: vehicles } = useRecordsById<DeliveryVehicle>(
    '/delivery-vehicles',
    runs.map((run) => run.deliveryVehicleId),
  )
  const { data: employees } = useRecordsById<Employee>(
    '/employees',
    runs.map((run) => run.driverEmployeeId),
  )
  const { data: warehouses } = useRecordsById<Warehouse>(
    '/warehouses',
    outgoingDeliveries.flatMap((delivery) => [
      delivery.warehouseId,
      ...delivery.items.map((item) => item.stockItem?.warehouseId),
    ]),
  )

  const pageClients = useQueries({
    queries: [
      ...new Set([
        ...salesOrders.map((order) => order.clientId),
        ...(selectedOrderRecord ? [selectedOrderRecord.clientId] : []),
      ]),
    ]
      .filter((id) => !baseClients.some((client) => client.id === id))
      .map((id) => ({ queryKey: ['clients', 'id', id], queryFn: () => fetchClientByIdApi(id) })),
  })
  const clients = useMemo(
    () => [...baseClients, ...pageClients.flatMap((query) => (query.data ? [query.data] : []))],
    [baseClients, pageClients],
  )

  // Mutations
  const createOrderMutation = useCreateSalesOrder({ notifySuccess: false })
  const confirmOrderMutation = useConfirmSalesOrder()
  const updateDraftMutation = useUpdateSalesOrderDraft()

  const { user, isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const cashier = user?.fullName || user?.email || 'Current User'

  // Lookups
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients])

  // Sync selectedOrderRecord if the list updates
  const activeSelectedOrder = useMemo(() => {
    if (!selectedOrderRecord) return null
    if (selectedDetail.data?.id === selectedOrderRecord.id) return selectedDetail.data
    return salesOrders.find((o) => o.id === selectedOrderRecord.id) || selectedOrderRecord
  }, [salesOrders, selectedOrderRecord, selectedDetail.data])

  const filteredOrders = salesOrders

  // Return the saved identity so the composer can confirm or retry that exact draft.
  const handleSaveOrder = async (
    values: OrderFormValues,
    intent: 'draft' | 'confirm' = 'draft',
  ) => {
    const order = await createOrderMutation.mutateAsync(buildSalesOrderPayload(values))
    if (intent === 'draft')
      toast.success('Draft saved', { description: `Sales order ${order.orderNumber}.` })
    return order
  }

  const openOrderDetails = (order: SalesOrderRecord) => {
    setSelectedOrderRecord(order)
    setIsDetailDrawerOpen(true)
  }
  const editDraft = (order: SalesOrderRecord) => {
    if (!canManage || order.status !== 'DRAFT') return
    setIsDetailDrawerOpen(false)
    setEditingOrderId(order.id)
  }
  const selectedDeliveries =
    deliveryQueries[deliveryOrderIds.indexOf(selectedOrderRecord?.id ?? -1)]
  const orderRows = filteredOrders.map((order) => {
    const query = deliveryQueries[deliveryOrderIds.indexOf(order.id)]
    return {
      order,
      client: clientMap.get(order.clientId),
      orderTotal: (order.items || []).reduce((sum, item) => sum + Number(item.totalAmount), 0),
      progress: getSalesOrderProgressDisplay(
        order,
        query?.data ?? [],
        !!query?.data && !query.isError,
      ),
    }
  })
  const salesOrderColumns: ColumnDef<(typeof orderRows)[number]>[] = [
    {
      id: 'order',
      header: 'Order',
      width: '18%',
      cell: ({ row }) => (
        <OverflowValue
          value={row.order.orderNumber}
          onActivate={() => openOrderDetails(row.order)}
        />
      ),
    },
    {
      id: 'customer',
      header: 'Customer',
      width: '24%',
      cell: ({ row }) => (
        <OverflowValue
          value={row.client?.name || 'Customer #' + row.order.clientId}
          fullValue={
            row.order.externalReference
              ? (row.client?.name || 'Customer') + ' | Ref: ' + row.order.externalReference
              : undefined
          }
          showFullValueOnHover
        />
      ),
    },
    {
      id: 'items',
      header: 'Items',
      width: '20%',
      cell: ({ row }) => {
        const items = row.order.items || []
        const item = items[0]
        const name = item
          ? products.find((product) => product.id === item.inventoryItemId)?.name ||
            `Product #${item.inventoryItemId}`
          : ''
        return (
          <OverflowValue
            value={
              items.length === 1
                ? `${name} (${formatStockCents(parseStockCents(item.quantity))})`
                : items.length > 1
                  ? `${items.length} items`
                  : 'No items listed'
            }
          />
        )
      },
    },
    {
      id: 'total',
      header: 'Total',
      align: 'right',
      width: '16%',
      className: 'whitespace-nowrap tabular-nums',
      cell: ({ row }) =>
        '₱' +
        row.orderTotal.toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
    },
    {
      id: 'progress',
      header: 'Progress',
      align: 'right',
      width: '22%',
      cell: ({ row }) => (
        <StatusBadge
          label={row.progress.label}
          tone={row.progress.tone}
          className="whitespace-nowrap"
        />
      ),
    },
  ]
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader description="Create and track customer orders and deliveries.">
        Sales Orders
      </PageHeader>
      <StatusTabNav
        activeTab={activeStatus}
        onTabChange={(tab) => setActiveStatus(tab as OrderTabFilter)}
        tabs={[
          {
            value: 'Active',
            label: 'Active Orders',
            icon: <CheckCircle2 className="size-3.5" />,
            accent: 'green',
          },
          {
            value: 'Completed',
            label: 'Completed Orders',
            icon: <CheckCircle2 className="size-3.5" />,
            accent: 'blue',
          },
          {
            value: 'Cancelled',
            label: 'Cancelled Orders',
            icon: <XCircle className="size-3.5" />,
            accent: 'red',
          },
        ]}
      />

      {/* Top Controls */}
      <PageToolbar>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            aria-label="Search orders"
            placeholder="Search order number, customer, reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-ui"
          />
        </div>

        <DataTableFilters filters={orderFilters} />
        <Button
          size="sm"
          onClick={() => {
            setIsOrderModalOpen(true)
          }}
          disabled={!canManage}
          className="gap-1.5 text-ui"
        >
          <Plus className="size-4" />
          Create Sales Order
        </Button>
      </PageToolbar>
      <DataTableFilterChips filters={orderFilters} />

      {/* Orders Table */}
      <DataTableFrame>
        {dateError ? (
          <p role="alert" className="p-4 text-sm text-destructive">
            Choose an end date on or after the start date.
          </p>
        ) : ordersQuery.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              Sales orders could not be loaded. {getErrorMessage(ordersQuery.error)}
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => void ordersQuery.reload()}
                disabled={ordersQuery.isFetching}
              >
                {ordersQuery.isFetching ? 'Retrying...' : 'Retry'}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <DataTable
            appearance="management"
            retainHeaders
            data={orderRows}
            columns={salesOrderColumns}
            getRowKey={({ order }) => order.id}
            pagination={false}
            isLoading={isLoadingOrders}
            loadingMessage="Loading sales orders..."
            onRowClick={({ order }) => openOrderDetails(order)}
            tableClassName="table-fixed min-w-[760px]"
            emptyContent={
              searchTerm.trim()
                ? `No ${activeStatus.toLowerCase()} orders match "${searchTerm.trim()}"`
                : `No ${activeStatus.toLowerCase()} orders found`
            }
          />
        )}
        <DataTableFooter {...ordersQuery} rowCount={ordersQuery.items.length} />
      </DataTableFrame>

      {/* Order Creation Modal */}
      {isOrderModalOpen && canManage && (
        <OrderModal
          remoteSelectors
          open
          onClose={() => setIsOrderModalOpen(false)}
          onSubmit={handleSaveOrder}
          onConfirm={(id, expectedRevision) =>
            confirmOrderMutation.mutateAsync({ id, expectedRevision })
          }
          clients={clients}
          products={products}
          catalogState={{
            productsLoading: productsQuery.isLoading,
            stockLoading: stockQuery.isLoading,
            stockIncomplete: stockQuery.hasNextPage,
            productsError: productsQuery.error ? getErrorMessage(productsQuery.error) : undefined,
            stockError: stockQuery.error ? getErrorMessage(stockQuery.error) : undefined,
            onRetry: () => {
              void productsQuery.refetch()
              void stockQuery.refetch()
            },
          }}
          warehouses={warehouses}
          stockItems={stockItems}
          cashier={cashier}
          onNavigateToPurchases={onNavigateToPurchases}
          onNavigateToDeliveries={onNavigateToDeliveries}
          onNavigateToInventory={onNavigateToInventory}
        />
      )}

      {editingOrderId !== undefined &&
        canManage &&
        (editingOrderQuery.data ? (
          <OrderModal
            remoteSelectors
            key={editingOrderId}
            open
            draftOrder={editingOrderQuery.data}
            onClose={() => setEditingOrderId(undefined)}
            onSubmit={handleSaveOrder}
            onUpdateDraft={(id, payload) => updateDraftMutation.mutateAsync({ id, payload })}
            onLoadLatest={(id) =>
              queryClient.fetchQuery({
                queryKey: [...SALES_ORDERS_QUERY_KEY, 'id', id],
                queryFn: () => fetchSalesOrderByIdApi(id),
                staleTime: 0,
              })
            }
            onConfirm={(id, expectedRevision) =>
              confirmOrderMutation.mutateAsync({ id, expectedRevision })
            }
            clients={clients}
            products={products}
            stockItems={stockItems}
            cashier={cashier}
            catalogState={{
              productsLoading: productsQuery.isLoading,
              productsError: productsQuery.error ? getErrorMessage(productsQuery.error) : undefined,
              onRetry: () => void productsQuery.refetch(),
            }}
          />
        ) : (
          <Dialog open onOpenChange={(open) => !open && setEditingOrderId(undefined)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Sales Order Draft</DialogTitle>
                <DialogDescription>Load the saved order before making changes.</DialogDescription>
              </DialogHeader>
              {editingOrderQuery.isPending ? (
                <p role="status">Loading sales order…</p>
              ) : (
                <Alert variant="destructive">
                  <AlertDescription>
                    {editingOrderQuery.error
                      ? getErrorMessage(editingOrderQuery.error)
                      : 'This sales order is no longer available.'}
                    <Button
                      type="button"
                      variant="outline"
                      disabled={editingOrderQuery.isFetching}
                      onClick={() => void editingOrderQuery.refetch()}
                    >
                      Retry
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </DialogContent>
          </Dialog>
        ))}

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
        onConfirmed={() => setIsDetailDrawerOpen(false)}
        onCancelled={() => setIsDetailDrawerOpen(false)}
        deliveriesLoading={selectedDeliveries?.isPending ?? true}
        deliveriesUnavailable={selectedDeliveries?.isError ?? false}
        onRetryDeliveries={() => void selectedDeliveries?.refetch()}
        recordBusy={selectedDetail.isFetching}
        recordUnavailable={
          selectedDetail.isError || (selectedDetail.isSuccess && !selectedDetail.data)
        }
        onViewDeliveries={
          onNavigateToDeliveries ? (id) => onNavigateToDeliveries('outgoing', id) : undefined
        }
        onEdit={editDraft}
        onArrangeDelivery={
          onNavigateToDeliveries
            ? (orderId) => onNavigateToDeliveries('outgoing', orderId, true)
            : undefined
        }
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
    </div>
  )
}
