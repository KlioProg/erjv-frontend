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
  useCompleteIncomingDelivery,
  useCancelIncomingDelivery,
} from '@/features/logistics/incoming-deliveries.hooks'
import {
  useOutgoingDeliveries,
  useScheduleOutgoingDelivery,
  useCompleteOutgoingDelivery,
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
import type { CreateIncomingDeliveryPayload } from '@/features/logistics/incoming-deliveries.types'
import { ScheduleIncomingDeliveryModal } from './ScheduleIncomingDeliveryModal'
import { ScheduleDeliveryModal } from './ScheduleDeliveryModal'
import { DispatchDeliveryModal } from './shared/DispatchDeliveryModal'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'

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
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label className="text-xs" htmlFor={`delivery-filter-${label}`}>
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`delivery-filter-${label}`} className="h-9 text-xs">
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
  const [viewIncomingId, setViewIncomingId] = useState<number | null>(null)
  const [viewOutgoingId, setViewOutgoingId] = useState<number | null>(null)
  const [dispatchId, setDispatchId] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<{
    row: DeliveryRow
    action: Exclude<DeliveryAction, 'dispatch'>
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
  const createIncoming = useCreateIncomingDelivery()
  const scheduleIncoming = useScheduleIncomingDelivery()
  const completeIncoming = useCompleteIncomingDelivery()
  const cancelIncoming = useCancelIncomingDelivery()
  const scheduleOutgoing = useScheduleOutgoingDelivery()
  const completeOutgoing = useCompleteOutgoingDelivery()
  const cancelOutgoing = useCancelOutgoingDelivery()
  const pending = [
    scheduleIncoming,
    completeIncoming,
    cancelIncoming,
    scheduleOutgoing,
    completeOutgoing,
    cancelOutgoing,
  ].some((mutation) => mutation.isPending)
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
    if (warehouseId !== 'ALL' && row.record.warehouseId !== Number(warehouseId)) return false
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
  const availableStatuses = Object.entries(DELIVERY_STATUS_LABELS).filter(([value]) =>
    view === 'history'
      ? ['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(value)
      : view === 'incoming'
        ? ['DRAFT', 'SCHEDULED'].includes(value)
        : ['DRAFT', 'SCHEDULED', 'DISPATCHED'].includes(value),
  )
  const handleAction = (row: DeliveryRow, action: DeliveryAction) => {
    if (!canManage || pending || !getDeliveryActions(row).includes(action)) return
    if (action === 'dispatch') setDispatchId(row.record.id)
    else setConfirmation({ row, action })
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
      await (
        action === 'schedule'
          ? scheduleIncoming
          : action === 'receive'
            ? completeIncoming
            : cancelIncoming
      ).mutateAsync(row.record.id)
    else
      await (
        action === 'schedule'
          ? scheduleOutgoing
          : action === 'complete'
            ? completeOutgoing
            : cancelOutgoing
      ).mutateAsync(row.record.id)
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            {view === 'history'
              ? 'Delivery History'
              : view === 'incoming'
                ? 'Incoming Deliveries'
                : 'Outgoing Deliveries'}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {view === 'history'
              ? 'Completed and cancelled deliveries remain available for review.'
              : view === 'incoming'
                ? 'Arrange supplier shipments and receive goods into a destination warehouse.'
                : 'Arrange customer shipments from confirmed order allocations.'}
          </p>
        </div>
        {canManage && view !== 'history' && (
          <div className="flex flex-wrap gap-2">
            {view === 'incoming' && (
              <Button
                size="sm"
                variant="outline"
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search deliveries"
            placeholder="Search delivery, order, supplier, customer, or vehicle..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
        <div className="flex flex-1 gap-3 sm:max-w-sm">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="delivery-date-from" className="text-xs">
              From Date
            </Label>
            <Input
              id="delivery-date-from"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Label htmlFor="delivery-date-to" className="text-xs">
              To Date
            </Label>
            <Input
              id="delivery-date-to"
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setType('ALL')
            setStatus('ALL')
            setWarehouseId('ALL')
            setSearch('')
            setFromDate('')
            setToDate('')
            setOrderScope(null)
          }}
        >
          Clear Filters
        </Button>
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
      {(view === 'incoming'
        ? incomingQuery.isError
        : view === 'outgoing'
          ? outgoingQuery.isError
          : incomingQuery.isError || outgoingQuery.isError) && (
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
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <DeliveryTable
        rows={filtered}
        view={view}
        isLoading={
          view === 'incoming'
            ? incomingQuery.isLoading
            : view === 'outgoing'
              ? outgoingQuery.isLoading
              : incomingQuery.isLoading || outgoingQuery.isLoading
        }
        canManage={canManage}
        pending={pending}
        onView={(row) =>
          row.type === 'Incoming'
            ? setViewIncomingId(row.record.id)
            : setViewOutgoingId(row.record.id)
        }
        onAction={handleAction}
      />
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
          key={orderScope ?? 'outgoing'}
          open
          onClose={() => setCreateType(null)}
          preselectedOrderId={orderScope ?? undefined}
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
            : confirmation?.action === 'cancel'
              ? 'Cancel Delivery'
              : confirmation?.row.type === 'Incoming'
                ? 'Receive Goods'
                : 'Complete Delivery'
        }
        description={
          confirmation?.action === 'schedule'
            ? 'Mark this draft as scheduled and ready for receiving or dispatch. Physical stock is unchanged.'
            : confirmation?.action === 'cancel'
              ? confirmation.row.type === 'Outgoing'
                ? 'Cancel this shipment. A dispatched vehicle becomes available again. Physical stock and the sales order reservations remain unchanged.'
                : 'Cancel this supplier shipment. Physical stock is unchanged and its quantities become available for another incoming delivery.'
              : confirmation?.row.type === 'Incoming'
                ? 'Confirm the goods have arrived. Receiving adds the recorded quantities to the destination warehouse.'
                : 'Confirm the customer received the goods. Completion updates stock and releases the vehicle.'
        }
        itemName={confirmation?.row.reference}
        confirmText={
          confirmation?.action === 'schedule'
            ? 'Schedule Delivery'
            : confirmation?.action === 'cancel'
              ? 'Cancel Delivery'
              : confirmation?.action === 'receive'
                ? 'Receive Goods'
                : 'Complete Delivery'
        }
        variant={confirmation?.action === 'cancel' ? 'destructive' : 'warning'}
      />
    </div>
  )
}
