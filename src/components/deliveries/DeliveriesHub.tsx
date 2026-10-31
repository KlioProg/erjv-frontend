import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { Employee } from '@/features/staffing/staffing.types'
import { useRecordsById } from '@/lib/use-records-by-id'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { PageHeader, PageToolbar } from '@/components/ui/ManagementPage'
import { IncomingDeliveryDetailModal } from './shared/IncomingDeliveryDetailModal'
import {
  buildDeliveryRows,
  localDeliveryDay,
  deliveryNeedsAttention,
  DELIVERY_STATUS_LABELS,
  deliveryBelongsToView,
  getDeliveryActions,
  type DeliveryAction,
  type DeliveryView,
  type DeliveryRow,
} from '@/features/logistics/delivery-workflow'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
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
  useCreateIncomingDelivery,
  useScheduleIncomingDelivery,
  useCancelIncomingDelivery,
} from '@/features/logistics/incoming-deliveries.hooks'
import {
  useCancelOutgoingDelivery,
  useReopenOutgoingDelivery,
} from '@/features/logistics/outgoing-deliveries.hooks'
import { useSalesOrderById } from '@/features/crm/sales-orders.hooks'
import { usePurchaseOrderById } from '@/features/logistics/purchase-orders.hooks'
import { fetchIncomingDeliveriesApi } from '@/features/logistics/incoming-deliveries.api'
import { fetchOutgoingDeliveriesApi } from '@/features/logistics/outgoing-deliveries.api'
import { useAllWarehouses } from '@/features/logistics/warehouses.hooks'
import { useStockItems } from '@/features/logistics/stock-items.hooks'
import type { PurchaseOrderStatus } from '@/features/logistics/purchase-orders.types'
import type { CreateIncomingDeliveryPayload } from '@/features/logistics/incoming-deliveries.types'
import { ScheduleIncomingDeliveryModal } from './ScheduleIncomingDeliveryModal'
import { ScheduleDeliveryModal } from './ScheduleDeliveryModal'
import { ReceiveProductsModal } from './ReceiveProductsModal'
import { CompleteDeliveryModal } from './shared/CompleteDeliveryModal'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import type { OutgoingDeliveryRecord } from '@/features/logistics/outgoing-deliveries.types'
import { getErrorMessage } from '@/lib/api-client'
import { useResourcePage } from '@/lib/use-cursor-page'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
import type { IncomingDeliveryRecord } from '@/features/logistics/incoming-deliveries.types'

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
  const navigate = useNavigate()
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
  const [incomingScheduleFailure, setIncomingScheduleFailure] = useState('')
  const [viewIncomingId, setViewIncomingId] = useState<number | null>(null)
  const [viewOutgoingId, setViewOutgoingId] = useState<number | null>(null)
  const [viewOrder, setViewOrder] = useState<{ type: 'Incoming' | 'Outgoing'; id: number } | null>(
    null,
  )
  const [receiveId, setReceiveId] = useState<number | null>(null)
  const [completeId, setCompleteId] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<{
    row: DeliveryRow
    action: 'schedule' | 'cancel' | 'reopen'
  } | null>(null)
  const incomingStatuses = view === 'history' ? ['COMPLETED', 'CANCELLED'] : ['DRAFT', 'SCHEDULED']
  const outgoingStatuses =
    view === 'history' ? ['RECONCILED', 'CANCELLED'] : ['DRAFT', 'READY', 'DISPATCHED']
  const incomingEnabled =
    view !== 'outgoing' &&
    (view !== 'history' || type !== 'Outgoing') &&
    (status === 'ALL' || incomingStatuses.includes(status))
  const outgoingEnabled =
    view !== 'incoming' &&
    (view !== 'history' || type !== 'Incoming') &&
    (status === 'ALL' || outgoingStatuses.includes(status))
  const incomingQuery = useResourcePage<IncomingDeliveryRecord>(
    '/incoming-deliveries',
    {
      statuses: status !== 'ALL' && incomingStatuses.includes(status) ? [status] : incomingStatuses,
      ...(orderScope !== null ? { purchaseOrderId: orderScope } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(warehouseId !== 'ALL' ? { warehouseId: Number(warehouseId) } : {}),
      ...(fromDate ? { scheduledFrom: new Date(`${fromDate}T00:00:00`).toISOString() } : {}),
      ...(toDate ? { scheduledBefore: (() => { const boundary = new Date(`${toDate}T00:00:00`); boundary.setDate(boundary.getDate() + 1); return boundary.toISOString() })() } : {}),
    },
    incomingEnabled,
  )
  const outgoingQuery = useResourcePage<OutgoingDeliveryRecord>(
    '/outgoing-deliveries',
    {
      statuses: status !== 'ALL' && outgoingStatuses.includes(status) ? [status] : outgoingStatuses,
      ...(orderScope !== null ? { salesOrderId: orderScope } : {}),
      ...(search.trim() ? { q: search.trim() } : {}),
      ...(warehouseId !== 'ALL' ? { warehouseId: Number(warehouseId) } : {}),
    },
    outgoingEnabled,
    [fromDate, toDate],
  )
  const incoming = incomingQuery.items
  const outgoing = outgoingQuery.items
  const { data: purchaseOrders } = useRecordsById<PurchaseOrderRecord>('/purchase-orders', [...incoming.map(delivery => delivery.purchaseOrderId), viewOrder?.type === 'Incoming' ? viewOrder.id : undefined])
  const { data: salesOrders } = useRecordsById<SalesOrderRecord>('/sales-orders', [...outgoing.map(delivery => delivery.salesOrderId), viewOrder?.type === 'Outgoing' ? viewOrder.id : undefined])
  const { data: suppliers } = useRecordsById<Supplier>('/suppliers', purchaseOrders.map(order => order.supplierId))
  const { data: clients } = useRecordsById<Client>('/clients', salesOrders.map(order => order.clientId))
  const { data: warehouses = [] } = useAllWarehouses()
  const { data: runs } = useRecordsById<DeliveryRunRecord>('/delivery-runs', outgoing.map(delivery => delivery.runId))
  const { data: vehicles } = useRecordsById<DeliveryVehicle>('/delivery-vehicles', runs.map(run => run.deliveryVehicleId))
  const { data: employees } = useRecordsById<Employee>('/employees', runs.map(run => run.driverEmployeeId))
  const { data: products } = useRecordsById<InventoryItemResponse>('/inventory-items', [...purchaseOrders.flatMap(order => order.items.map(item => item.inventoryItemId)), ...salesOrders.flatMap(order => order.items.map(item => item.inventoryItemId))])
  const { data: stockItems = [] } = useStockItems()
  const createIncoming = useCreateIncomingDelivery()
  const scheduleIncoming = useScheduleIncomingDelivery()
  const cancelIncoming = useCancelIncomingDelivery()
  const cancelOutgoing = useCancelOutgoingDelivery()
  const reopenOutgoing = useReopenOutgoingDelivery()
  const pending = [scheduleIncoming, cancelIncoming, cancelOutgoing, reopenOutgoing].some(
    (mutation) => mutation.isPending,
  )
  const hasDeliveryError =
    (incomingEnabled && incomingQuery.isError) || (outgoingEnabled && outgoingQuery.isError)
  const isLoadingDeliveries =
    (incomingEnabled && incomingQuery.isFetching) || (outgoingEnabled && outgoingQuery.isFetching)
  const isFetchingDeliveries =
    (incomingEnabled && incomingQuery.isFetching) || (outgoingEnabled && outgoingQuery.isFetching)
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
    if (orderScope !== null && row.orderId !== orderScope) return false
    if (row.type === 'Outgoing') {
      const day = localDeliveryDay(row.date)
      if (fromDate && (!day || day < fromDate)) return false
      if (toDate && (!day || day > toDate)) return false
    }
    return true
  })
  const viewRow = rows.find((row) => row.type === 'Incoming' && row.record.id === viewIncomingId)
  const selectedPurchase = usePurchaseOrderById(viewOrder?.type === 'Incoming' ? viewOrder.id : undefined)
  const selectedSale = useSalesOrderById(viewOrder?.type === 'Outgoing' ? viewOrder.id : undefined)
  const purchaseOrderToView = viewOrder?.type === 'Incoming' ? selectedPurchase.data ?? null : null
  const salesOrderToView = viewOrder?.type === 'Outgoing' ? selectedSale.data ?? null : null
  // These selected-order aggregates require every receipt/member, independent of the visible page.
  const purchaseDeliveries = useQuery({
    queryKey: ['incoming-deliveries', 'order-detail', purchaseOrderToView?.id],
    enabled: !!purchaseOrderToView,
    queryFn: ({ signal }) => fetchIncomingDeliveriesApi({ purchaseOrderId: purchaseOrderToView!.id }, signal),
  })
  const saleDeliveries = useQuery({
    queryKey: ['outgoing-deliveries', 'order-detail', salesOrderToView?.id],
    enabled: !!salesOrderToView,
    queryFn: ({ signal }) => fetchOutgoingDeliveriesApi({ salesOrderId: salesOrderToView!.id }, signal),
  })
  const availableStatuses = Object.entries(DELIVERY_STATUS_LABELS).filter(([value]) =>
    view === 'history'
      ? ['COMPLETED', 'RECONCILED', 'CANCELLED'].includes(value)
      : view === 'incoming'
        ? ['DRAFT', 'SCHEDULED'].includes(value)
        : ['DRAFT', 'READY', 'DISPATCHED'].includes(value),
  )
  const handleAction = (row: DeliveryRow, action: DeliveryAction) => {
    if (!canManage || pending || !getDeliveryActions(row).includes(action)) return
    if (action === 'receive') setReceiveId(row.record.id)
    else if (action === 'reconcile') setCompleteId(row.record.id)
    else if (row.type === 'Outgoing' && action === 'run')
      navigate(`/deliveries/runs${row.record.runId ? `?run=${row.record.runId}` : ''}`)
    else if (row.type === 'Outgoing' && action === 'ready') {
      setOutgoingDraftId(row.record.id)
      setCreateType('Outgoing')
    } else if (action === 'schedule' || action === 'cancel' || action === 'reopen')
      setConfirmation({ row, action })
  }
  const handleCreateIncoming = async (payload: CreateIncomingDeliveryPayload) => {
    const created = await createIncoming.mutateAsync(payload)
    setIncomingScheduleFailure('')
    try {
      await scheduleIncoming.mutateAsync({ id: created.id, expectedRevision: created.revision })
    } catch (error) {
      setIncomingScheduleFailure(
        `${created.deliveryNumber || `Incoming delivery #${created.id}`} was created, but scheduling was not confirmed. ${getErrorMessage(error)} Refresh the delivery list and review this draft before scheduling it again. Do not create a duplicate shipment.`,
      )
    }
    setCreateType(null)
  }
  const confirm = async () => {
    if (!confirmation) return
    const { row, action } = confirmation
    if (!canManage || !getDeliveryActions(row).includes(action)) return
    if (row.type === 'Incoming')
      await (action === 'schedule' ? scheduleIncoming : cancelIncoming).mutateAsync({
        id: row.record.id,
        expectedRevision: row.record.revision,
      })
    else
      await (action === 'reopen' ? reopenOutgoing : cancelOutgoing).mutateAsync({
        id: row.record.id,
        expectedRevision: row.record.revision,
      })
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
      <Button asChild variant="outline" className="self-start">
        <Link to="/deliveries/runs">Delivery Runs</Link>
      </Button>
      {incomingScheduleFailure && (
        <Alert variant="destructive">
          <AlertDescription>{incomingScheduleFailure}</AlertDescription>
        </Alert>
      )}
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
        <span>
          {rows.filter((row) => deliveryBelongsToView(row, view)).length} loaded deliveries
        </span>
        {view !== 'history' && (
          <span>
            {
              rows.filter(
                (row) => deliveryBelongsToView(row, view) && deliveryNeedsAttention(row, now),
              ).length
            }{' '}
            loaded deliveries need attention
          </span>
        )}
      </p>
      <PageToolbar className="[&>div:first-child]:max-w-xl!">
        <div className="relative min-w-0 flex-1 sm:min-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search deliveries"
            placeholder="Search delivery, order, supplier, or customer..."
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
                  onClick={() => setCreateType('Incoming')}
                >
                  <ArrowDownToLine data-icon="inline-start" />
                  Schedule Incoming
                </Button>
              )}
              {view === 'outgoing' && (
                <Button
                  size="sm"
                  onClick={() => setCreateType('Outgoing')}
                >
                  <Plus data-icon="inline-start" />
                  Plan Outgoing
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
      {outgoingEnabled && <p className="text-xs text-muted-foreground">Outgoing date filters apply to the current page; the backend does not support outgoing date filtering.</p>}
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
                void incomingQuery.reload()
                void outgoingQuery.reload()
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
              {lastSavedOutgoing.status === 'READY' ? 'was marked ready' : 'was saved'}.{' '}
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
      {incomingEnabled && <CursorPageControls {...incomingQuery} label="Incoming delivery" />}
      {outgoingEnabled && <CursorPageControls {...outgoingQuery} label="Outgoing delivery" />}
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
      {completeId !== null && outgoing.find((delivery) => delivery.id === completeId)?.runId && (
        <CompleteDeliveryModal
          key={completeId}
          deliveryId={completeId}
          runId={outgoing.find((delivery) => delivery.id === completeId)!.runId!}
          onClose={() => setCompleteId(null)}
        />
      )}
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
          incomingDeliveries={purchaseDeliveries.data ?? []}
          receivingLoading={purchaseDeliveries.isPending}
          receivingUnavailable={purchaseDeliveries.isError}
          onRetryReceiving={() => void purchaseDeliveries.refetch()}
          statusBadge={
            <Badge variant="outline">{purchaseOrderStatusLabels[purchaseOrderToView.status]}</Badge>
          }
          onClose={() => setViewOrder(null)}
        />
      )}
      <OrderDetailDrawer
        open={salesOrderToView !== null && saleDeliveries.isSuccess}
        readOnly
        onClose={() => setViewOrder(null)}
        order={salesOrderToView}
        clients={clients}
        products={products}
        warehouses={warehouses}
        vehicles={vehicles}
        employees={employees}
        stockItems={stockItems}
        outgoingDeliveries={saleDeliveries.data ?? []}
      />
      {viewOrder && ((viewOrder.type === 'Incoming' ? selectedPurchase : selectedSale).isError || (viewOrder.type === 'Outgoing' && saleDeliveries.isError)) && <Alert variant="destructive"><AlertDescription>The selected order and its full delivery history could not be loaded. <Button variant="link" onClick={() => { void (viewOrder.type === 'Incoming' ? selectedPurchase : selectedSale).refetch(); if (viewOrder.type === 'Outgoing') void saleDeliveries.refetch() }}>Retry loading order</Button><Button variant="link" onClick={() => setViewOrder(null)}>Close order</Button></AlertDescription></Alert>}
      <ConfirmDeleteModal
        key={
          confirmation ? `${confirmation.row.key}-${confirmation.action}` : 'delivery-confirmation'
        }
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={confirm}
        title={
          confirmation?.action === 'schedule'
            ? 'Schedule Delivery'
            : confirmation?.action === 'reopen'
              ? 'Reopen Delivery'
              : 'Cancel Delivery'
        }
        description={
          confirmation?.action === 'schedule'
            ? 'Mark this draft as scheduled and ready for receiving. Physical stock is unchanged.'
            : confirmation?.action === 'reopen'
              ? 'Return this ready delivery to a draft for planning. Physical stock is unchanged.'
              : 'Cancel this shipment. Physical stock is unchanged.'
        }
        itemName={confirmation?.row.reference}
        confirmText={
          confirmation?.action === 'schedule'
            ? 'Schedule Delivery'
            : confirmation?.action === 'reopen'
              ? 'Reopen Delivery'
              : 'Cancel Delivery'
        }
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
