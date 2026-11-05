import type { DeliveryRunRecord } from '@/features/logistics/delivery-runs.types'
import type { DeliveryVehicle } from '@/features/logistics/delivery-vehicles.types'
import type { Employee } from '@/features/staffing/staffing.types'
import { useRecordsById } from '@/lib/use-records-by-id'
import type { PurchaseOrderRecord } from '@/features/logistics/purchase-orders.types'
import type { SalesOrderRecord } from '@/features/crm/sales-orders.types'
import type { Supplier } from '@/features/logistics/suppliers.types'
import type { Client } from '@/features/crm/clients.types'
import type { InventoryItemResponse } from '@/features/products/products.types'
import { PageHeader } from '@/components/ui/ManagementPage'
import { StatusTabNav } from '@/components/ui/StatusTabNav'
import { IncomingDeliveryDetailModal } from './shared/IncomingDeliveryDetailModal'
import { DeliveryRunsHub } from './DeliveryRunsHub'
import {
  buildDeliveryRows,
  deliveryHistoryDate,
  DELIVERY_STATUS_LABELS,
  deliveryBelongsToView,
  getDeliveryActions,
  type DeliveryAction,
  type DeliveryView,
  type DeliveryRow,
} from '@/features/logistics/delivery-workflow'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { ArrowDownToLine, Plus } from 'lucide-react'
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
import { useCursorLookup } from '@/lib/use-cursor-lookup'
import { useDeliveryHistoryPagination } from '@/features/logistics/delivery-history-pagination'
import { CursorPageControls } from '@/components/ui/CursorPageControls'
import { useResourcePage } from '@/lib/use-cursor-page'
import { DeliveryHeaderFilter } from './DeliveryHeaderFilter'
import { DeliveryTableToolbar, DeliveryPageFooter } from './DeliveryTableToolbar'
import { Checkbox } from '@/components/ui/checkbox'
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
      <Label className="text-sm font-medium" htmlFor={`delivery-filter-${label}`}>
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
  const [type, setType] = useState('ALL')
  const tripsHistory = view === 'history' && type === 'Trips'
  const [status, setStatus] = useState('ALL')
  const [warehouseId, setWarehouseId] = useState('ALL')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [unassigned, setUnassigned] = useState(false)
  const [orderScope, setOrderScope] = useState<number | null>(
    purchaseOrderId ?? salesOrderId ?? null,
  )
  const [createType, setCreateType] = useState<'Incoming' | 'Outgoing' | null>(
    arrangeOrder ? (view === 'incoming' ? 'Incoming' : 'Outgoing') : null,
  )
  const [outgoingDraftId, setOutgoingDraftId] = useState<number | undefined>()
  const [lastSavedOutgoing, setLastSavedOutgoing] = useState<OutgoingDeliveryRecord | null>(null)
  const [incomingScheduleFailure, setIncomingScheduleFailure] = useState('')
  const [lastSavedIncoming, setLastSavedIncoming] = useState<IncomingDeliveryRecord | null>(null)
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
    !tripsHistory &&
    (view !== 'history' || type !== 'Outgoing') &&
    (status === 'ALL' || incomingStatuses.includes(status))
  const outgoingEnabled =
    view !== 'incoming' &&
    !tripsHistory &&
    (view !== 'history' || type !== 'Incoming') &&
    (status === 'ALL' || outgoingStatuses.includes(status))
  const allHistory = view === 'history' && type === 'ALL'
  const incomingFilter = {
    statuses: status !== 'ALL' && incomingStatuses.includes(status) ? [status] : incomingStatuses,
    ...(orderScope !== null ? { purchaseOrderId: orderScope } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(warehouseId !== 'ALL' ? { warehouseId: Number(warehouseId) } : {}),
    ...(view === 'incoming' && fromDate
      ? { scheduledFrom: new Date(`${fromDate}T00:00:00+08:00`).toISOString() }
      : {}),
    ...(view === 'incoming' && toDate
      ? {
          scheduledBefore: new Date(
            Date.parse(`${toDate}T00:00:00+08:00`) + 86400000,
          ).toISOString(),
        }
      : {}),
  }
  const outgoingFilter = {
    statuses: status !== 'ALL' && outgoingStatuses.includes(status) ? [status] : outgoingStatuses,
    ...(orderScope !== null ? { salesOrderId: orderScope } : {}),
    ...(search.trim() ? { q: search.trim() } : {}),
    ...(warehouseId !== 'ALL' ? { warehouseId: Number(warehouseId) } : {}),
    ...(unassigned ? { unassigned: 'true' } : {}),
  }
  const historyScope = JSON.stringify([view, type, status, warehouseId, search.trim(), orderScope])
  const [historySession, setHistorySession] = useState({ scope: historyScope, version: 0 })
  const session =
    historySession.scope === historyScope
      ? historySession
      : { scope: historyScope, version: historySession.version + 1 }
  if (session !== historySession) setHistorySession(session)
  const incomingPage = useResourcePage<IncomingDeliveryRecord>(
    '/incoming-deliveries',
    incomingFilter,
    incomingEnabled && !allHistory,
    view === 'history' ? type : undefined,
  )
  const outgoingPage = useResourcePage<OutgoingDeliveryRecord>(
    '/outgoing-deliveries',
    outgoingFilter,
    outgoingEnabled && !allHistory,
    view === 'history' ? type : undefined,
  )
  const loadedIncoming = useCursorLookup<IncomingDeliveryRecord>(
    '/incoming-deliveries',
    incomingFilter,
    allHistory && incomingEnabled,
    ['delivery-history', session.version],
  )
  const loadedOutgoing = useCursorLookup<OutgoingDeliveryRecord>(
    '/outgoing-deliveries',
    outgoingFilter,
    allHistory && outgoingEnabled,
    ['delivery-history', session.version],
  )
  const incomingQuery = allHistory
    ? { ...incomingPage, ...loadedIncoming, hasNext: !!loadedIncoming.hasNextPage }
    : incomingPage
  const outgoingQuery = allHistory
    ? { ...outgoingPage, ...loadedOutgoing, hasNext: !!loadedOutgoing.hasNextPage }
    : outgoingPage
  const incoming = incomingQuery.items
  const outgoing = outgoingQuery.items
  const { data: purchaseOrders } = useRecordsById<PurchaseOrderRecord>('/purchase-orders', [
    ...incoming.map((delivery) => delivery.purchaseOrderId),
    lastSavedIncoming?.purchaseOrderId,
    viewOrder?.type === 'Incoming' ? viewOrder.id : undefined,
  ])
  const { data: salesOrders } = useRecordsById<SalesOrderRecord>('/sales-orders', [
    ...outgoing.map((delivery) => delivery.salesOrderId),
    viewOrder?.type === 'Outgoing' ? viewOrder.id : undefined,
  ])
  const { data: suppliers } = useRecordsById<Supplier>(
    '/suppliers',
    purchaseOrders.map((order) => order.supplierId),
  )
  const { data: clients } = useRecordsById<Client>(
    '/clients',
    salesOrders.map((order) => order.clientId),
  )
  const { data: warehouses = [] } = useAllWarehouses()
  const { data: runs } = useRecordsById<DeliveryRunRecord>(
    '/delivery-runs',
    outgoing.map((delivery) => delivery.runId),
  )
  const { data: vehicles } = useRecordsById<DeliveryVehicle>(
    '/delivery-vehicles',
    runs.map((run) => run.deliveryVehicleId),
  )
  const { data: employees } = useRecordsById<Employee>(
    '/employees',
    runs.map((run) => run.driverEmployeeId),
  )
  const { data: products } = useRecordsById<InventoryItemResponse>('/inventory-items', [
    ...purchaseOrders.flatMap((order) => order.items.map((item) => item.inventoryItemId)),
    ...salesOrders.flatMap((order) => order.items.map((item) => item.inventoryItemId)),
  ])
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
  const filtered = [
    ...new Map(
      rows
        .filter((row) => {
          if (
            row.type === 'Incoming'
              ? !incomingEnabled || (!allHistory && incomingQuery.isError)
              : !outgoingEnabled || (!allHistory && outgoingQuery.isError)
          )
            return false
          if (!deliveryBelongsToView(row, view)) return false
          if (view === 'history' && type !== 'ALL' && row.type !== type) return false
          if (status !== 'ALL' && row.status !== status) return false
          if (orderScope !== null && row.orderId !== orderScope) return false
          return true
        })
        .map((row) => [row.key, row]),
    ).values(),
  ]
  if (allHistory)
    filtered.sort((left, right) => {
      const time = (row: DeliveryRow) => {
        const value = deliveryHistoryDate(row)
        return value && Number.isFinite(Date.parse(value)) ? Date.parse(value) : 0
      }
      return time(right) - time(left) || left.key.localeCompare(right.key)
    })
  const loadMoreHistory = async () => {
    if (isFetchingDeliveries) return
    const requests: Promise<unknown>[] = []
    for (const [enabled, source] of [
      [incomingEnabled, loadedIncoming],
      [outgoingEnabled, loadedOutgoing],
    ] as const) {
      if (!enabled) continue
      if (hasDeliveryError) {
        if (source.isError)
          requests.push(
            source.isFetchNextPageError
              ? source.fetchNextPage({ cancelRefetch: false })
              : source.refetch({ cancelRefetch: false }),
          )
      } else if (source.hasNextPage) requests.push(source.fetchNextPage({ cancelRefetch: false }))
    }
    await Promise.all(requests)
  }
  const historyPagination = useDeliveryHistoryPagination({
    rows: allHistory ? filtered : [],
    scope: JSON.stringify(session),
    isFetching: isFetchingDeliveries,
    isError: hasDeliveryError,
    hasMore:
      (incomingEnabled && !!loadedIncoming.hasNextPage) ||
      (outgoingEnabled && !!loadedOutgoing.hasNextPage),
    fetchMore: loadMoreHistory,
  })
  const listedViewRow = rows.find((row) => row.type === 'Incoming' && row.record.id === viewIncomingId)
  const viewRow = lastSavedIncoming?.id === viewIncomingId &&
    (!listedViewRow || lastSavedIncoming.revision >= listedViewRow.record.revision) ? buildDeliveryRows({
      incoming: [lastSavedIncoming], outgoing: [], purchaseOrders, salesOrders, suppliers, clients, warehouses, vehicles, employees,
    })[0] : listedViewRow
  const selectedPurchase = usePurchaseOrderById(
    viewOrder?.type === 'Incoming' ? viewOrder.id : undefined,
  )
  const selectedSale = useSalesOrderById(viewOrder?.type === 'Outgoing' ? viewOrder.id : undefined)
  const purchaseOrderToView =
    viewOrder?.type === 'Incoming' ? (selectedPurchase.data ?? null) : null
  const salesOrderToView = viewOrder?.type === 'Outgoing' ? (selectedSale.data ?? null) : null
  // These selected-order aggregates require every receipt/member, independent of the visible page.
  const purchaseDeliveries = useQuery({
    queryKey: ['incoming-deliveries', 'order-detail', purchaseOrderToView?.id],
    enabled: !!purchaseOrderToView,
    queryFn: ({ signal }) =>
      fetchIncomingDeliveriesApi({ purchaseOrderId: purchaseOrderToView!.id }, signal),
  })
  const saleDeliveries = useQuery({
    queryKey: ['outgoing-deliveries', 'order-detail', salesOrderToView?.id],
    enabled: !!salesOrderToView,
    queryFn: ({ signal }) =>
      fetchOutgoingDeliveriesApi({ salesOrderId: salesOrderToView!.id }, signal),
  })
  const availableStatuses = Object.entries(DELIVERY_STATUS_LABELS).filter(([value]) =>
    view === 'history'
      ? ['COMPLETED', 'RECONCILED', 'CANCELLED'].includes(value)
      : view === 'incoming'
        ? ['DRAFT', 'SCHEDULED'].includes(value)
        : ['DRAFT', 'READY', 'DISPATCHED'].includes(value),
  )
  const handleAction = (row: DeliveryRow, action: DeliveryAction) => {
    if (row.type === 'Outgoing' && action === 'run' && row.record.runId != null) {
      navigate(`/deliveries/runs?run=${row.record.runId}`)
      return
    }
    if (!canManage || pending || !getDeliveryActions(row).includes(action)) return
    if (action === 'receive') setReceiveId(row.record.id)
    else if (action === 'reconcile') setCompleteId(row.record.id)
    else if (row.type === 'Outgoing' && action === 'run')
      navigate(`/deliveries/runs?assign=${row.record.id}`)
    else if (row.type === 'Outgoing' && action === 'ready') {
      setOutgoingDraftId(row.record.id)
      setCreateType('Outgoing')
    } else if (action === 'schedule' || action === 'cancel' || action === 'reopen')
      setConfirmation({ row, action })
  }
  const handleCreateIncoming = async (payload: CreateIncomingDeliveryPayload) => {
    const created = await createIncoming.mutateAsync(payload)
    setLastSavedIncoming(created)
    setIncomingScheduleFailure('')
    try {
      const scheduled = await scheduleIncoming.mutateAsync({ id: created.id, expectedRevision: created.revision })
      setLastSavedIncoming(scheduled)
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
    setUnassigned(false)
    setOrderScope(null)
  }
  const hasFilters =
    type !== 'ALL' ||
    status !== 'ALL' ||
    warehouseId !== 'ALL' ||
    !!search.trim() ||
    !!fromDate ||
    !!toDate ||
    orderScope !== null ||
    unassigned
  const statusFilter = (
    <DeliveryFilter
      label={view === 'history' ? 'Outcome' : 'Status'}
      value={status}
      onChange={setStatus}
      options={[
        { value: 'ALL', label: view === 'history' ? 'All outcomes' : 'All Statuses' },
        ...availableStatuses.map(([value, label]) => ({
          value,
          label: value === 'READY' ? 'Ready / Assigned' : label,
        })),
      ]}
    />
  )
  const headerFilters = {
    order: (
      <DeliveryHeaderFilter
        label="Warehouse"
        header={
          view === 'incoming'
            ? 'Purchase Order / Warehouse'
            : view === 'outgoing'
              ? 'Sales Order / Warehouse'
              : 'Related Order / Warehouse'
        }
        active={warehouseId !== 'ALL'}
        onClear={() => setWarehouseId('ALL')}
      >
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
      </DeliveryHeaderFilter>
    ),
    status: (
      <DeliveryHeaderFilter
        label={view === 'history' ? 'Outcome' : 'Status'}
        header={view === 'history' ? 'Outcome' : 'Delivery Status'}
        active={status !== 'ALL'}
        onClear={() => setStatus('ALL')}
      >
        {statusFilter}
      </DeliveryHeaderFilter>
    ),
    ...(view === 'incoming'
      ? {
          date: (
            <DeliveryHeaderFilter
              label="Scheduled date"
              header="Scheduled / Expected Date"
              active={!!fromDate || !!toDate}
              onClear={() => {
                setFromDate('')
                setToDate('')
              }}
            >
              <div className="grid gap-1.5">
                <Label htmlFor="delivery-date-from">Scheduled from</Label>
                <Input
                  id="delivery-date-from"
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="delivery-date-to">Scheduled through</Label>
                <Input
                  id="delivery-date-to"
                  type="date"
                  value={toDate}
                  min={fromDate || undefined}
                  onChange={(event) => setToDate(event.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Scheduled dates use Asia/Manila; they do not filter receipt dates.
              </p>
            </DeliveryHeaderFilter>
          ),
        }
      : view === 'outgoing'
        ? {
            date: (
              <DeliveryHeaderFilter
                label="Delivery trip"
                active={unassigned}
                onClear={() => setUnassigned(false)}
              >
                <label className="flex min-h-11 items-center gap-2 text-sm">
                  <Checkbox
                    checked={unassigned}
                    onCheckedChange={(value) => setUnassigned(value === true)}
                  />
                  Unassigned deliveries only
                </label>
              </DeliveryHeaderFilter>
            ),
          }
        : {}),
  }
  const toolbar = (
    <DeliveryTableToolbar
      search={search}
      onSearch={setSearch}
      searchLabel="Search deliveries"
      placeholder={
        view === 'incoming'
          ? 'Search delivery, supplier or reference...'
          : view === 'outgoing'
            ? 'Search delivery, order or customer...'
            : 'Search delivery history...'
      }
    >
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
      {canManage && view !== 'history' && (
        <Button
          size="sm"
          onClick={() => setCreateType(view === 'incoming' ? 'Incoming' : 'Outgoing')}
        >
          {view === 'incoming' ? (
            <ArrowDownToLine aria-hidden="true" />
          ) : (
            <Plus aria-hidden="true" />
          )}
          {view === 'incoming' ? 'Schedule Incoming' : 'Plan Outgoing'}
        </Button>
      )}
    </DeliveryTableToolbar>
  )
  const renderTable = (tableRows: DeliveryRow[], loading: boolean) => (
    <DeliveryTable
      className="rounded-none border-0"
      headerFilters={headerFilters}
      rows={tableRows}
      view={view}
      isLoading={loading}
      hasFilters={hasFilters}
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
  )
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <PageHeader
        description={
          view === 'history'
            ? 'Review completed and cancelled deliveries.'
            : view === 'incoming'
              ? 'Arrange supplier shipments and receive goods into a destination warehouse.'
              : 'Plan customer shipments, mark them ready, then add them to a delivery trip.'
        }
      >
        {view === 'history'
          ? 'Delivery History'
          : view === 'incoming'
            ? 'Incoming Deliveries'
            : 'Outgoing Deliveries'}
      </PageHeader>
      <div
        className={
          view === 'history'
            ? 'flex min-w-0 flex-col items-start gap-3 [&_input]:h-11! pointer-coarse:[&_input]:h-13!'
            : undefined
        }
      >
        {view === 'history' && (
          <div role="group" aria-label="Delivery direction" className="min-w-0 max-w-full">
            <StatusTabNav
              activeTab={type}
              onTabChange={(value) => {
                if (value === type) return
                setType(value)
                setStatus('ALL')
              }}
              tabs={[
                { value: 'ALL', label: 'All Deliveries' },
                { value: 'Incoming', label: 'Incoming' },
                { value: 'Outgoing', label: 'Outgoing' },
                { value: 'Trips', label: 'Trips' },
              ]}
            />
          </div>
        )}
        {!tripsHistory && <div
          className={view === 'history' ? 'w-full min-w-0' : undefined}
        >
          {toolbar}
        </div>}
      </div>
      {tripsHistory ? <DeliveryRunsHub history /> : <>
      {view === 'incoming' && lastSavedIncoming && (
        <Alert>
          <AlertDescription>
            {lastSavedIncoming.status === 'COMPLETED'
              ? `Receipt recorded for ${lastSavedIncoming.deliveryNumber}.`
              : lastSavedIncoming.status === 'SCHEDULED'
                ? `Arrival scheduled for ${lastSavedIncoming.deliveryNumber}.`
                : `Draft created for ${lastSavedIncoming.deliveryNumber}.`}{' '}
            {canManage && lastSavedIncoming.status === 'SCHEDULED' && (
              <Button variant="link" size="sm" onClick={() => setReceiveId(lastSavedIncoming.id)}>Receive Goods</Button>
            )}
            <Button variant="link" size="sm" onClick={() => setViewIncomingId(lastSavedIncoming.id)}>
              {lastSavedIncoming.status === 'COMPLETED' ? 'View Receipt' : 'View Details'}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {incomingScheduleFailure && (
        <Alert variant="destructive">
          <AlertDescription>{incomingScheduleFailure}</AlertDescription>
        </Alert>
      )}
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
            {!allHistory && (
              <Button
                variant="link"
                size="sm"
                onClick={() => {
                  if (incomingEnabled) void incomingQuery.reload()
                  if (outgoingEnabled) void outgoingQuery.reload()
                }}
                disabled={isFetchingDeliveries}
              >
                {isFetchingDeliveries ? 'Retrying...' : 'Retry'}
              </Button>
            )}
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
      <div data-delivery-table className="min-w-0 overflow-hidden rounded-lg border bg-card">
        {hasDeliveryError && filtered.length === 0 && !isLoadingDeliveries ? (
          <p role="status" className="px-4 py-6 text-center text-sm text-muted-foreground">
            Delivery records are unavailable until the request succeeds.
          </p>
        ) : (
          renderTable(
            allHistory ? historyPagination.items : filtered,
            isLoadingDeliveries && (!allHistory || filtered.length === 0),
          )
        )}
        {allHistory ? (
          <CursorPageControls
            {...historyPagination}
            label="Delivery history"
            summary={
              <span role="status">
                Loaded history pages
                {incomingEnabled && loadedIncoming.isError && '. Incoming history unavailable.'}
                {outgoingEnabled && loadedOutgoing.isError && '. Outgoing history unavailable.'}
                {hasDeliveryError && (
                  <Button
                    variant="link"
                    size="sm"
                    disabled={historyPagination.isFetching}
                    onClick={historyPagination.retry}
                  >
                    Retry history
                  </Button>
                )}
              </span>
            }
          />
        ) : view === 'history' ? (
          <>
            {incomingEnabled && (
              <DeliveryPageFooter
                query={incomingQuery}
                count={filtered.length}
                label="Incoming delivery"
              />
            )}
            {outgoingEnabled && (
              <DeliveryPageFooter
                query={outgoingQuery}
                count={filtered.length}
                label="Outgoing delivery"
              />
            )}
          </>
        ) : null}
        {view !== 'history' && incomingEnabled && (
          <DeliveryPageFooter
            query={incomingQuery}
            count={filtered.length}
            label="Incoming delivery"
          />
        )}
        {view !== 'history' && outgoingEnabled && (
          <DeliveryPageFooter
            query={outgoingQuery}
            count={filtered.length}
            label="Outgoing delivery"
          />
        )}
      </div>
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
          onScheduled={(delivery) => {
            setCreateType(null)
            setOutgoingDraftId(undefined)
            navigate(
              `/deliveries/runs?${delivery.runId != null ? `run=${delivery.runId}` : `assign=${delivery.id}`}`,
            )
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
      {receiveId !== null && (
        <ReceiveProductsModal
          key={receiveId}
          deliveryId={receiveId}
          onSaved={setLastSavedIncoming}
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
      {viewOrder &&
        ((viewOrder.type === 'Incoming' ? selectedPurchase : selectedSale).isError ||
          (viewOrder.type === 'Outgoing' && saleDeliveries.isError)) && (
          <Alert variant="destructive">
            <AlertDescription>
              The selected order and its full delivery history could not be loaded.{' '}
              <Button
                variant="link"
                onClick={() => {
                  void (viewOrder.type === 'Incoming' ? selectedPurchase : selectedSale).refetch()
                  if (viewOrder.type === 'Outgoing') void saleDeliveries.refetch()
                }}
              >
                Retry loading order
              </Button>
              <Button variant="link" onClick={() => setViewOrder(null)}>
                Close order
              </Button>
            </AlertDescription>
          </Alert>
        )}
      <ConfirmDeleteModal
        key={
          confirmation ? `${confirmation.row.key}-${confirmation.action}` : 'delivery-confirmation'
        }
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={confirm}
        title={
          confirmation?.action === 'schedule'
            ? 'Schedule Arrival'
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
            ? 'Schedule Arrival'
            : confirmation?.action === 'reopen'
              ? 'Reopen Delivery'
              : 'Cancel Delivery'
        }
        variant={confirmation?.action === 'cancel' ? 'destructive' : 'warning'}
      />
      </>}
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
