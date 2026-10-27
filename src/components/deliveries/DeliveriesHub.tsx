import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { IncomingDeliveryDetailModal } from './shared/IncomingDeliveryDetailModal'
import {
  buildDeliveryRows,
  deliveryNeedsAttention,
  localDeliveryDay,
  DELIVERY_STATUS_LABELS,
  deliveryBelongsToView,
  getDeliveryActions,
  type DeliveryAction,
  type DeliveryView,
  type DeliveryRow,
} from '@/features/logistics/delivery-workflow'
import { useEffect, useState } from 'react'
import { ArrowDownToLine, Plus, Search } from 'lucide-react'
import { DeliveryTable } from './DeliveryTable'
import { OrderDetailDrawer } from '@/components/orders/OrderDetailDrawer'
import { PurchaseOrderDetailModal } from '@/components/purchases/PurchaseOrderDetailModal'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/features/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  useIncomingDeliveries,
  useCreateIncomingDelivery,
  useScheduleIncomingDelivery,
  useCancelIncomingDelivery,
} from '@/features/logistics/incoming-deliveries.hooks'
import {
  useOutgoingDeliveries,
  useCancelOutgoingDelivery,
} from '@/features/logistics/outgoing-deliveries.hooks'
import { useAllDeliveryVehicles } from '@/features/logistics/delivery-vehicles.hooks'
import { useSalesOrders } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { usePurchaseOrders } from '@/features/logistics/purchase-orders.hooks'
import { useSuppliers } from '@/features/logistics/suppliers.hooks'
import { useAllWarehouses } from '@/features/logistics/warehouses.hooks'
import { useAllProducts } from '@/features/products/products.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import type { PurchaseOrderStatus } from '@/features/logistics/purchase-orders.types'
import type { CreateIncomingDeliveryPayload } from '@/features/logistics/incoming-deliveries.types'
import { ScheduleIncomingDeliveryModal } from './ScheduleIncomingDeliveryModal'
import { ScheduleDeliveryModal } from './ScheduleDeliveryModal'
import { ReceiveProductsModal } from './ReceiveProductsModal'
import { CompleteDeliveryModal } from './shared/CompleteDeliveryModal'
import { DispatchDeliveryModal } from './shared/DispatchDeliveryModal'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'

// Older callers retain their navigation hints; outgoing aliases share the active view.
export type DeliverySubTab =
  'schedule' | 'status' | 'completed' | 'incoming' | 'outgoing' | 'history'
export interface DeliveriesHubProps {
  initialTab?: DeliverySubTab
  purchaseOrderId?: number
  salesOrderId?: number
  arrangeOrder?: boolean
}
function DeliveryFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label className="text-[13px] font-medium" htmlFor={`delivery-filter-${label}`}>
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`delivery-filter-${label}`} className="h-10 min-w-0 text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
export function DeliveriesHub({
  initialTab,
  purchaseOrderId,
  salesOrderId,
  arrangeOrder,
}: DeliveriesHubProps = {}) {
  const { isAdmin, isManager } = useAuth()
  const canManage = isAdmin || isManager
  const view: DeliveryView =
    initialTab === 'history' ? 'history' : initialTab === 'incoming' ? 'incoming' : 'outgoing'
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  const [type, setType] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [warehouseId, setWarehouseId] = useState('ALL')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [orderScope, setOrderScope] = useState<number | null>(
    purchaseOrderId ?? salesOrderId ?? null,
  )
  const [createType, setCreateType] = useState<'Incoming' | 'Outgoing' | null>(
    arrangeOrder ? (view === 'incoming' ? 'Incoming' : 'Outgoing') : null,
  )
  const [outgoingDraftId, setOutgoingDraftId] = useState<number | undefined>()
  const [lastSavedOutgoing, setLastSavedOutgoing] = useState<OutgoingDeliveryRecord | null>(null)
  const [viewIncomingId, setViewIncomingId] = useState<number | null>(null)
  const [viewOutgoingId, setViewOutgoingId] = useState<number | null>(null)
  const [viewOrder, setViewOrder] = useState<{ type: 'Incoming' | 'Outgoing'; id: number } | null>(
    null,
  )
  const [receiveId, setReceiveId] = useState<number | null>(null)
  const [completeId, setCompleteId] = useState<number | null>(null)
  const [dispatchId, setDispatchId] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<{
    row: DeliveryRow
    action: 'schedule' | 'cancel'
  } | null>(null)
  const incomingQuery = useIncomingDeliveries()
  const outgoingQuery = useOutgoingDeliveries()
  const { data: incoming = [] } = incomingQuery
  const { data: outgoing = [] } = outgoingQuery
  const { data: purchaseOrders = [] } = usePurchaseOrders()
  const { data: salesOrders = [] } = useSalesOrders()
  const { data: suppliers = [] } = useSuppliers({ includeInactive: 'true' })
  const { data: clients = [] } = useClients({ includeInactive: 'true' })
  const { data: warehouses = [] } = useAllWarehouses()
  const { data: vehicles = [] } = useAllDeliveryVehicles()
  const { data: employees = [] } = useEmployees({ includeInactive: 'true' })
  const { data: products = [] } = useAllProducts()
  const { data: stockItems = [] } = useStockItems()
  const createIncoming = useCreateIncomingDelivery()
  const scheduleIncoming = useScheduleIncomingDelivery()
  const cancelIncoming = useCancelIncomingDelivery()
  const cancelOutgoing = useCancelOutgoingDelivery()
  const pending = [scheduleIncoming, cancelIncoming, cancelOutgoing].some(
    (mutation) => mutation.isPending,
  )
  const hasDeliveryError =
    view === 'incoming'
      ? incomingQuery.isError
      : view === 'outgoing'
        ? outgoingQuery.isError
        : incomingQuery.isError || outgoingQuery.isError
  const isLoadingDeliveries =
    view === 'incoming'
      ? incomingQuery.isLoading
      : view === 'outgoing'
        ? outgoingQuery.isLoading
        : incomingQuery.isLoading || outgoingQuery.isLoading
  const isFetchingDeliveries = incomingQuery.isFetching || outgoingQuery.isFetching
  const rows = buildDeliveryRows({
    incoming,
    outgoing,
    purchaseOrders,
    salesOrders,
    suppliers,
    clients,
    warehouses,
    vehicles,
    employees,
  })
  const filtered = rows.filter((row) => {
    if (!deliveryBelongsToView(row, view)) return false
    if (view === 'history' && type !== 'ALL' && row.type !== type) return false
    if (status !== 'ALL' && row.status !== status) return false
    if (warehouseId !== 'ALL') {
      const selectedWarehouseId = Number(warehouseId)
      const matchesWarehouse =
        row.type === 'Incoming' || row.record.warehouseId != null
          ? row.record.warehouseId === selectedWarehouseId
          : row.record.items.some((item) => item.stockItem?.warehouseId === selectedWarehouseId)
      if (!matchesWarehouse) return false
    }
    if (orderScope !== null && row.orderId !== orderScope) return false
    const day = localDeliveryDay(row.date)
    if (fromDate && (!day || day < fromDate)) return false
    if (toDate && (!day || day > toDate)) return false
    return [
      row.reference,
      row.party,
      row.relatedOrder,
      row.warehouse,
      row.vehicle,
      row.driver,
      row.record.notes || '',
    ].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))
  })
  const viewRow = rows.find((row) => row.type === 'Incoming' && row.record.id === viewIncomingId)
  const purchaseOrderToView =
    viewOrder?.type === 'Incoming'
      ? (purchaseOrders.find((order) => order.id === viewOrder.id) ?? null)
      : null
  const salesOrderToView =
    viewOrder?.type === 'Outgoing'
      ? (salesOrders.find((order) => order.id === viewOrder.id) ?? null)
      : null
  const availableStatuses = Object.entries(DELIVERY_STATUS_LABELS).filter(([value]) =>
    view === 'history'
      ? ['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(value)
      : view === 'incoming'
        ? ['DRAFT', 'SCHEDULED'].includes(value)
        : ['DRAFT', 'SCHEDULED', 'DISPATCHED'].includes(value),
  )
  const handleAction = (row: DeliveryRow, action: DeliveryAction) => {
    if (!canManage || pending || !getDeliveryActions(row).includes(action)) return
    if (action === 'receive') setReceiveId(row.record.id)
    else if (action === 'complete') setCompleteId(row.record.id)
    else if (action === 'dispatch') setDispatchId(row.record.id)
    else if (row.type === 'Outgoing' && action === 'schedule') {
      setOutgoingDraftId(row.record.id)
      setCreateType('Outgoing')
    } else setConfirmation({ row, action })
  }
  const handleCreateIncoming = async (payload: CreateIncomingDeliveryPayload) => {
    const created = await createIncoming.mutateAsync(payload)
    try {
      await scheduleIncoming.mutateAsync(created.id)
    } catch {
      /* Keep a created draft available for retry. */
    }
    setCreateType(null)
  }
  const confirm = async () => {
    if (!confirmation) return
    const { row, action } = confirmation
    if (!canManage || !getDeliveryActions(row).includes(action)) return
    if (row.type === 'Incoming')
      await (action === 'schedule' ? scheduleIncoming : cancelIncoming).mutateAsync(row.record.id)
    else if (action === 'cancel') await cancelOutgoing.mutateAsync(row.record.id)
  }
  const clearFilters = () => {
    setType('ALL')
    setStatus('ALL')
    setWarehouseId('ALL')
    setSearch('')
    setFromDate('')
    setToDate('')
    setOrderScope(null)
  }
  const hasFilters =
    status !== 'ALL' ||
    warehouseId !== 'ALL' ||
    !!search.trim() ||
    !!fromDate ||
    !!toDate ||
    orderScope !== null
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader
        description={
          view === 'history'
            ? 'Completed and cancelled deliveries remain available for review.'
            : view === 'incoming'
              ? 'Arrange supplier shipments and receive goods into a destination warehouse.'
              : 'Prepare customer shipments by choosing available stock sources for each order item.'
        }
      >
        {view === 'history'
          ? 'Delivery History'
          : view === 'incoming'
            ? 'Incoming Deliveries'
            : 'Outgoing Deliveries'}
      </PageHeader>
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>{rows.filter((row) => deliveryBelongsToView(row, view)).length} deliveries</span>
        {view !== 'history' && (
          <span>
            {
              rows.filter(
                (row) => deliveryBelongsToView(row, view) && deliveryNeedsAttention(row, now),
              ).length
            }{' '}
            need attention
          </span>
        )}
      </p>
      <PageToolbar className="[&>div:first-child]:max-w-xl!">
        <div className="relative min-w-0 flex-1 sm:min-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search deliveries"
            placeholder="Search delivery, order, supplier, customer, or vehicle..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 pl-9 text-[13px]"
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear Filters
          </Button>
          {canManage && view !== 'history' && (
            <div className="flex flex-wrap gap-2">
              {view === 'incoming' && (
                <Button
                  size="sm"
                  variant="default"
                  disabled={
                    !purchaseOrders.some((order) =>
                      ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status),
                    )
                  }
                  onClick={() => setCreateType('Incoming')}
                >
                  <ArrowDownToLine data-icon="inline-start" />
                  Schedule Incoming
                </Button>
              )}
              {view === 'outgoing' && (
                <Button
                  size="sm"
                  disabled={
                    !salesOrders.some((order) =>
                      ['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order.status),
                    )
                  }
                  onClick={() => setCreateType('Outgoing')}
                >
                  <Plus data-icon="inline-start" />
                  Schedule Outgoing
                </Button>
              )}
            </div>
          )}
        </div>
      </PageToolbar>
      <div
        className={`grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${view === 'history' ? 'xl:grid-cols-5' : ''}`}
      >
        <DeliveryFilter
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'ALL', label: 'All Statuses' },
            ...availableStatuses.map(([value, label]) => ({ value, label })),
          ]}
        />
        <DeliveryFilter
          label="Warehouse"
          value={warehouseId}
          onChange={setWarehouseId}
          options={[
            { value: 'ALL', label: 'All Warehouses' },
            ...warehouses.map((warehouse) => ({
              value: String(warehouse.id),
              label: warehouse.name,
            })),
          ]}
        />
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="delivery-date-from" className="text-[13px] font-medium">
            From Date
          </Label>
          <Input
            id="delivery-date-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="h-10 min-w-0 text-[13px]"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="delivery-date-to" className="text-[13px] font-medium">
            To Date
          </Label>
          <Input
            id="delivery-date-to"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(event) => setToDate(event.target.value)}
            className="h-10 min-w-0 text-[13px]"
          />
        </div>
        {view === 'history' && (
          <DeliveryFilter
            label="Direction"
            value={type}
            onChange={(value) => {
              setType(value)
              setStatus('ALL')
            }}
            options={[
              { value: 'ALL', label: 'All' },
              ...['Incoming', 'Outgoing'].map((value) => ({ value, label: value })),
            ]}
          />
        )}
      </div>
      {orderScope !== null && (
        <p className="text-xs text-muted-foreground">
          {view === 'incoming' ? 'Incoming' : 'Outgoing'} deliveries for{' '}
          {(view === 'incoming' ? purchaseOrders : salesOrders).find(
            (order) => order.id === orderScope,
          )?.orderNumber || `Order #${orderScope}`}
          .{' '}
          <Button variant="link" size="sm" onClick={() => setOrderScope(null)}>
            Show all orders
          </Button>
        </p>
      )}
      {hasDeliveryError && (
        <Alert variant="destructive">
          <AlertDescription>
            Some deliveries could not be loaded.{' '}
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                void incomingQuery.refetch()
                void outgoingQuery.refetch()
              }}
              disabled={isFetchingDeliveries}
            >
              {isFetchingDeliveries ? 'Retrying...' : 'Retry'}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {view === 'outgoing' &&
        lastSavedOutgoing &&
        (outgoingQuery.isError ||
          !filtered.some(
            (row) =>
              row.record.id === lastSavedOutgoing.id && row.status === lastSavedOutgoing.status,
          )) && (
          <Alert>
            <AlertDescription>
              {lastSavedOutgoing.deliveryNumber}{' '}
              {lastSavedOutgoing.status === 'SCHEDULED' ? 'was scheduled' : 'was saved'}.{' '}
              {outgoingQuery.isFetching
                ? 'Refreshing outgoing deliveries...'
                : outgoingQuery.isError
                  ? 'The list could not be refreshed. Do not schedule it again.'
                  : hasFilters
                    ? 'Current filters hide this delivery.'
                    : 'It is not currently visible in the list.'}
              <Button
                variant="link"
                size="sm"
                onClick={() => setViewOutgoingId(lastSavedOutgoing.id)}
              >
                View New Delivery
              </Button>
              {hasFilters && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    clearFilters()
                    setSearch(lastSavedOutgoing.deliveryNumber)
                  }}
                >
                  Show in List
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
      {hasDeliveryError && filtered.length === 0 && !isLoadingDeliveries ? (
        <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
          Delivery records are unavailable until the request succeeds.
        </div>
      ) : (
        <DeliveryTable
          rows={filtered}
          view={view}
          isLoading={
            isLoadingDeliveries ||
            (view === 'outgoing' && outgoingQuery.isFetching && !filtered.length)
          }
          hasFilters={view === 'outgoing' && hasFilters}
          canManage={canManage}
          pending={pending}
          onView={(row) =>
            row.type === 'Incoming'
              ? setViewIncomingId(row.record.id)
              : setViewOutgoingId(row.record.id)
          }
          onViewOrder={(row) => setViewOrder({ type: row.type, id: row.orderId })}
          onAction={handleAction}
        />
      )}
      {canManage && createType === 'Incoming' && (
        <ScheduleIncomingDeliveryModal
          key={orderScope ?? 'incoming'}
          open
          onClose={() => setCreateType(null)}
          onSubmit={handleCreateIncoming}
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          warehouses={warehouses}
          products={products}
          preselectedOrderId={orderScope ?? undefined}
        />
      )}
      {canManage && createType === 'Outgoing' && (
        <ScheduleDeliveryModal
          key={outgoingDraftId ?? 'outgoing'}
          open
          onClose={() => {
            setCreateType(null)
            setOutgoingDraftId(undefined)
          }}
          preselectedOrderId={orderScope ?? undefined}
          draftId={outgoingDraftId}
          onSaved={(delivery) => {
            setLastSavedOutgoing(delivery)
            if (orderScope !== null && orderScope !== delivery.salesOrderId)
              setOrderScope(delivery.salesOrderId)
          }}
          onViewDelivery={(delivery) => {
            setCreateType(null)
            setOutgoingDraftId(undefined)
            setViewOutgoingId(delivery.id)
          }}
          onViewDeliveries={(id) => {
            setCreateType(null)
            setOutgoingDraftId(undefined)
            setOrderScope(id)
          }}
        />
      )}
      {receiveId !== null && incoming.find((d) => d.id === receiveId) && (
        <ReceiveProductsModal
          key={receiveId}
          delivery={incoming.find((d) => d.id === receiveId)!}
          onClose={() => setReceiveId(null)}
        />
      )}
      {completeId !== null && (
        <CompleteDeliveryModal
          key={completeId}
          deliveryId={completeId}
          onClose={() => setCompleteId(null)}
        />
      )}
      <DispatchDeliveryModal
        key={dispatchId ?? 'dispatch'}
        delivery={outgoing.find((delivery) => delivery.id === dispatchId) || null}
        open={dispatchId !== null}
        onClose={() => setDispatchId(null)}
      />
      <DeliveryDetailModal
        deliveryId={viewOutgoingId}
        open={viewOutgoingId !== null}
        onClose={() => setViewOutgoingId(null)}
      />
      <IncomingDeliveryDetailModal
        row={viewRow?.type === 'Incoming' ? viewRow : undefined}
        purchaseOrders={purchaseOrders}
        products={products}
        onClose={() => setViewIncomingId(null)}
      />
      {purchaseOrderToView && (
        <PurchaseOrderDetailModal
          order={purchaseOrderToView}
          supplier={suppliers.find((supplier) => supplier.id === purchaseOrderToView.supplierId)}
          products={products}
          warehouses={warehouses}
          incomingDeliveries={incoming}
          statusBadge={
            <Badge variant="outline">{purchaseOrderStatusLabels[purchaseOrderToView.status]}</Badge>
          }
          onClose={() => setViewOrder(null)}
        />
      )}
      <OrderDetailDrawer
        open={salesOrderToView !== null}
        readOnly
        onClose={() => setViewOrder(null)}
        order={salesOrderToView}
        clients={clients}
        products={products}
        warehouses={warehouses}
        vehicles={vehicles}
        employees={employees}
        stockItems={stockItems}
        outgoingDeliveries={outgoing}
      />
      <ConfirmDeleteModal
        key={
          confirmation ? `${confirmation.row.key}-${confirmation.action}` : 'delivery-confirmation'
        }
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={confirm}
        title={confirmation?.action === 'schedule' ? 'Schedule Delivery' : 'Cancel Delivery'}
        description={
          confirmation?.action === 'schedule'
            ? 'Mark this draft as scheduled and ready for receiving. Physical stock is unchanged.'
            : 'Cancel this draft or scheduled shipment. Physical stock is unchanged.'
        }
        itemName={confirmation?.row.reference}
        confirmText={confirmation?.action === 'schedule' ? 'Schedule Delivery' : 'Cancel Delivery'}
        variant={confirmation?.action === 'cancel' ? 'destructive' : 'warning'}
      />
    </div>
  )
}

const purchaseOrderStatusLabels: Record<PurchaseOrderStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  PARTIALLY_RECEIVED: 'Partially Received',
  RECEIVED: 'Received',
  CANCELLED: 'Cancelled',
}
