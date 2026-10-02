import {
  IncomingDeliveryDetailModal,
  IncomingDeliveryStatusBadge,
} from './shared/IncomingDeliveryDetailModal'
import {
  buildDeliveryRows,
  deliveryNeedsAttention,
  localDeliveryDay,
  DELIVERY_STATUS_LABELS,
  type DeliveryRow,
} from '@/features/logistics/delivery-workflow'
import { isActiveDeliveryStatus } from '@/features/logistics/vehicle-assignment'
import { useEffect, useState } from 'react'
import { ArrowDownToLine, Plus, Search, Truck } from 'lucide-react'
import { DataTable, type ColumnDef } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
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
import { DeliveryUtils } from '@/features/logistics/delivery-utils'
import { ScheduleIncomingDeliveryModal } from './ScheduleIncomingDeliveryModal'
import { ScheduleDeliveryModal } from './ScheduleDeliveryModal'
import { DispatchDeliveryModal } from './shared/DispatchDeliveryModal'
import { DeliveryDetailModal } from './shared/DeliveryDetailModal'
import { DeliveryStatusBadge } from './shared/DeliveryStatusBadge'

// Kept as navigation compatibility hints; all records now share one page/table.
export type DeliverySubTab = 'schedule' | 'status' | 'completed' | 'incoming' | 'history'
export interface DeliveriesHubProps {
  initialTab?: DeliverySubTab
  purchaseOrderId?: number
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
export function DeliveriesHub({ initialTab, purchaseOrderId }: DeliveriesHubProps = {}) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(interval)
  }, [])
  const [type, setType] = useState(
    initialTab === 'incoming'
      ? 'Incoming'
      : ['schedule', 'status', 'completed'].includes(initialTab || '')
        ? 'Outgoing'
        : 'ALL',
  )
  const [status, setStatus] = useState(initialTab === 'completed' ? 'DISPATCHED' : 'ALL')
  const [method, setMethod] = useState('ALL')
  const [warehouseId, setWarehouseId] = useState('ALL')
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [orderScope, setOrderScope] = useState<number | null>(purchaseOrderId ?? null)
  const [createType, setCreateType] = useState<'Incoming' | 'Outgoing' | null>(null)
  const [viewIncomingId, setViewIncomingId] = useState<number | null>(null)
  const [viewOutgoingId, setViewOutgoingId] = useState<number | null>(null)
  const [dispatchId, setDispatchId] = useState<number | null>(null)
  const [confirmation, setConfirmation] = useState<{
    row: DeliveryRow
    action: 'complete' | 'cancel'
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
    if (type !== 'ALL' && row.type !== type) return false
    if (status !== 'ALL' && row.status !== status) return false
    if (method !== 'ALL' && row.method !== method) return false
    if (warehouseId !== 'ALL' && row.record.warehouseId !== Number(warehouseId)) return false
    if (orderScope !== null && (row.type !== 'Incoming' || row.orderId !== orderScope)) return false
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
  const availableStatuses = Object.entries(DELIVERY_STATUS_LABELS).filter(
    ([value]) =>
      type === 'ALL' ||
      (type === 'Incoming' ? !['DISPATCHED', 'DELIVERED'].includes(value) : value !== 'COMPLETED'),
  )
  const badge = (row: DeliveryRow) =>
    row.type === 'Outgoing' ? (
      <DeliveryStatusBadge status={row.record.status} />
    ) : (
      <IncomingDeliveryStatusBadge status={row.record.status} />
    )
  const columns: ColumnDef<DeliveryRow>[] = [
    {
      id: 'reference',
      header: 'Reference',
      accessorKey: 'reference',
      sortable: true,
      cell: ({ row }) => <span className="font-mono text-xs font-bold">{row.reference}</span>,
    },
    {
      id: 'type',
      header: 'Type',
      accessorKey: 'type',
      sortable: true,
      cell: ({ row }) => <Badge variant="outline">{row.type}</Badge>,
    },
    { id: 'party', header: 'From / To', accessorKey: 'party', sortable: true },
    { id: 'order', header: 'Related Order', accessorKey: 'relatedOrder', sortable: true },
    { id: 'method', header: 'Method', accessorKey: 'method' },
    { id: 'warehouse', header: 'Warehouse', accessorKey: 'warehouse', sortable: true },
    {
      id: 'vehicle',
      header: 'Vehicle',
      accessorKey: 'vehicle',
      cell: ({ row }) => (
        <div className="flex flex-col gap-1">
          <span>{row.vehicle}</span>
          {row.driver !== '—' && (
            <span className="text-[11px] text-muted-foreground">{row.driver}</span>
          )}
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Scheduled / Expected',
      sortKey: (row) => (row.date ? new Date(row.date).getTime() : 0),
      sortable: true,
      cell: ({ row }) => DeliveryUtils.formatDateTime(row.date),
    },
    { id: 'status', header: 'Status', accessorKey: 'status', cell: ({ row }) => badge(row) },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1 whitespace-nowrap">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`View delivery ${row.reference}`}
            onClick={() =>
              row.type === 'Incoming'
                ? setViewIncomingId(row.record.id)
                : setViewOutgoingId(row.record.id)
            }
          >
            View
          </Button>
          {row.status === 'DRAFT' && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                row.type === 'Incoming'
                  ? scheduleIncoming.mutate(row.record.id)
                  : scheduleOutgoing.mutate(row.record.id)
              }
            >
              Schedule
            </Button>
          )}
          {row.type === 'Outgoing' && row.status === 'SCHEDULED' && (
            <Button variant="outline" size="sm" onClick={() => setDispatchId(row.record.id)}>
              Dispatch
            </Button>
          )}
          {((row.type === 'Incoming' && row.status === 'SCHEDULED') ||
            row.status === 'DISPATCHED') && (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmation({ row, action: 'complete' })}
            >
              {row.type === 'Incoming' ? 'Receive Goods' : 'Complete'}
            </Button>
          )}
          {isActiveDeliveryStatus(row.status) && (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => setConfirmation({ row, action: 'cancel' })}
            >
              Cancel
            </Button>
          )}
        </div>
      ),
    },
  ]
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
    if (row.type === 'Incoming')
      await (action === 'complete' ? completeIncoming : cancelIncoming).mutateAsync(row.record.id)
    else
      await (action === 'complete' ? completeOutgoing : cancelOutgoing).mutateAsync(row.record.id)
  }
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Deliveries</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track goods coming in from suppliers and going out to customers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Incoming', incoming.length],
          ['Outgoing', outgoing.length],
          [
            'In Progress',
            rows.filter((row) => ['SCHEDULED', 'DISPATCHED'].includes(row.status)).length,
          ],
          ['Needs Attention', rows.filter((row) => deliveryNeedsAttention(row, now)).length],
        ].map(([label, count]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-muted/20 p-3"
          >
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <span className="font-mono text-lg font-bold">{count}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DeliveryFilter
          label="Type"
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
        <DeliveryFilter
          label="Method"
          value={method}
          onChange={setMethod}
          options={[
            { value: 'ALL', label: 'All Methods' },
            ...['To Be Confirmed', 'Delivery'].map((value) => ({ value, label: value })),
          ]}
        />
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
            setMethod('ALL')
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
          Incoming deliveries for{' '}
          {purchaseOrders.find((order) => order.id === orderScope)?.orderNumber ||
            `PO #${orderScope}`}
          .{' '}
          <Button variant="link" size="sm" onClick={() => setOrderScope(null)}>
            Show all orders
          </Button>
        </p>
      )}
      {(incomingQuery.isError || outgoingQuery.isError) && (
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
      <DataTable
        data={filtered}
        columns={columns}
        getRowKey={(row) => row.key}
        isLoading={incomingQuery.isLoading || outgoingQuery.isLoading}
        tableClassName="min-w-[1100px]"
        emptyContent={
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Truck className="size-8 text-muted-foreground" />
            <p className="text-sm font-semibold">No deliveries found</p>
            <p className="text-xs text-muted-foreground">
              Adjust the filters or schedule an incoming or outgoing delivery.
            </p>
          </div>
        }
      />
      {createType === 'Incoming' && (
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
      {createType === 'Outgoing' && (
        <ScheduleDeliveryModal open onClose={() => setCreateType(null)} />
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
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        onConfirm={confirm}
        title={
          confirmation?.action === 'cancel'
            ? 'Cancel Delivery'
            : confirmation?.row.type === 'Incoming'
              ? 'Receive Goods'
              : 'Complete Delivery'
        }
        description={
          confirmation?.action === 'cancel'
            ? 'Cancel this delivery using the existing order and inventory rules.'
            : confirmation?.row.type === 'Incoming'
              ? 'Confirm the goods have arrived. Receiving adds the recorded quantities to the destination warehouse.'
              : 'Confirm the customer received the goods. Completion updates stock and releases the vehicle.'
        }
        itemName={confirmation?.row.reference}
        confirmText={confirmation?.action === 'cancel' ? 'Cancel Delivery' : 'Confirm Completion'}
        variant={confirmation?.action === 'cancel' ? 'destructive' : 'warning'}
      />
    </div>
  )
}
