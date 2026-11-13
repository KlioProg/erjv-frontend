import { outgoingPreparationIssue } from './outgoing-issues.ts'
import { incomingOrderSchedulingIssue, incomingSchedulingIssue } from './incoming-scheduling.ts'
import type { IncomingDeliveryRecord } from './incoming-deliveries.types'
import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'
import type { PurchaseOrderRecord } from './purchase-orders.types'
import type { SalesOrderRecord } from '../crm/sales-orders.types'
import type { Supplier } from './suppliers.types'
import type { Client } from '../crm/clients.types'
import type { Warehouse } from './warehouses.types'
import type { DeliveryVehicle } from './delivery-vehicles.types'
import type { Employee } from '../staffing/staffing.types'

export type DeliveryRow = {
  key: string
  reference: string
  type: 'Incoming' | 'Outgoing'
  party: string
  relatedOrder: string
  purchaseOrderStatus?: PurchaseOrderRecord['status']
  schedulingIssue?:
    ReturnType<typeof incomingSchedulingIssue> | ReturnType<typeof outgoingPreparationIssue>
  orderId: number
  method: 'To Be Confirmed' | 'Delivery'
  warehouse: string
  vehicle: string
  driver: string
  date: string | null
  status: IncomingDeliveryRecord['status'] | OutgoingDeliveryRecord['status']
} & (
  | { type: 'Incoming'; record: IncomingDeliveryRecord }
  | { type: 'Outgoing'; record: OutgoingDeliveryRecord }
)
export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Awaiting Receipt',
  READY: 'Ready',
  RECONCILED: 'Completed',
  DISPATCHED: 'Dispatched',
  COMPLETED: 'Received',
  CANCELLED: 'Cancelled',
}

export const RUN_STATUS_LABELS = {
  DRAFT: 'Preparing',
  DISPATCHED: 'Dispatched',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
} as const

export function outgoingStatusLabel(status: OutgoingDeliveryRecord['status']) {
  return DELIVERY_STATUS_LABELS[status] ?? status
}

export function deliveryHistoryDate(row: DeliveryRow) {
  return row.status === 'CANCELLED'
    ? row.record.cancelledAt
    : row.type === 'Incoming'
      ? row.record.completedAt
      : row.record.reconciledAt
}
export function buildDeliveryRows({
  incoming,
  outgoing,
  purchaseOrders,
  unavailablePurchaseOrderIds = [],
  unavailableSalesOrderIds = [],
  warehousesUnavailable = false,
  salesOrders,
  suppliers,
  clients,
  warehouses,
}: {
  incoming: IncomingDeliveryRecord[]
  outgoing: OutgoingDeliveryRecord[]
  unavailablePurchaseOrderIds?: number[]
  unavailableSalesOrderIds?: number[]
  warehousesUnavailable?: boolean
  purchaseOrders: PurchaseOrderRecord[]
  salesOrders: SalesOrderRecord[]
  suppliers: Supplier[]
  clients: Client[]
  warehouses: Warehouse[]
  vehicles: DeliveryVehicle[]
  employees: Employee[]
}): DeliveryRow[] {
  return [
    ...incoming.map((record) => {
      const order = purchaseOrders.find((order) => order.id === record.purchaseOrderId)
      const warehouse = warehousesUnavailable ? undefined : warehouses.find((warehouse) => warehouse.id === record.warehouseId)
      const purchaseOrderStatus = unavailablePurchaseOrderIds.includes(record.purchaseOrderId)
        ? undefined : order?.status
      const orderIssue = incomingOrderSchedulingIssue(purchaseOrderStatus)
      return {
        key: `incoming-${record.id}`,
        reference: record.deliveryNumber,
        type: 'Incoming' as const,
        record,
        party:
          suppliers.find((supplier) => supplier.id === order?.supplierId)?.name ||
          `Supplier #${order?.supplierId ?? '—'}`,
        relatedOrder: order?.orderNumber || `PO #${record.purchaseOrderId}`,
        orderId: record.purchaseOrderId,
        purchaseOrderStatus,
        schedulingIssue:
          record.status !== 'DRAFT'
            ? null
            : (orderIssue ??
              (warehouse && order
                ? incomingSchedulingIssue({ delivery: record, order, warehouse })
                : {
                    target: 'refresh' as const,
                    title: 'Receiving Warehouse Unavailable',
                    message:
                      'The receiving warehouse could not be verified. Recheck the delivery before scheduling or changing its warehouse.',
                  })),
        method: 'To Be Confirmed' as const,
        warehouse:
          warehouses.find((warehouse) => warehouse.id === record.warehouseId)?.name ||
          `Warehouse #${record.warehouseId}`,
        vehicle: '—',
        driver: '—',
        date: record.scheduledAt || order?.expectedAt || null,
        status: record.status,
      }
    }),
    ...outgoing.map((record) => {
      const order = salesOrders.find((order) => order.id === record.salesOrderId)
      return {
        key: `outgoing-${record.id}`,
        reference: record.deliveryNumber,
        type: 'Outgoing' as const,
        record,
        schedulingIssue: outgoingPreparationIssue(
          record,
          unavailableSalesOrderIds.includes(record.salesOrderId) ? undefined : order?.status,
          warehousesUnavailable ? undefined : warehouses.find((warehouse) => warehouse.id === record.warehouseId)?.isActive,
        ),
        party:
          clients.find((client) => client.id === order?.clientId)?.name ||
          `Customer #${order?.clientId ?? '—'}`,
        relatedOrder: order?.orderNumber || `SO #${record.salesOrderId}`,
        orderId: record.salesOrderId,
        method: 'Delivery' as const,
        warehouse:
          record.warehouseId != null
            ? warehouses.find((warehouse) => warehouse.id === record.warehouseId)?.name ||
              `Warehouse #${record.warehouseId}`
            : [
                ...new Set(
                  record.items.map((item) => {
                    const warehouseId = item.stockItem?.warehouseId
                    if (warehouseId === undefined) return 'Warehouse unavailable'
                    return (
                      warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ||
                      `Warehouse #${warehouseId}`
                    )
                  }),
                ),
              ].join(', ') || '—',
        vehicle: record.runId ? `Trip #${record.runId}` : 'Unassigned',
        driver: '?',
        date: record.reconciledAt || order?.expectedAt || null,
        status: record.status,
      }
    }),
  ]
}

export function deliveryNeedsAttention(row: DeliveryRow, now: number): boolean {
  return (
    row.status === 'DRAFT' ||
    (['SCHEDULED', 'READY', 'DISPATCHED'].includes(row.status) &&
      !!row.date &&
      new Date(row.date).getTime() < now)
  )
}

export function localDeliveryDay(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export type DeliveryView = 'incoming' | 'outgoing' | 'history'
export type DeliveryAction =
  'schedule' | 'ready' | 'reopen' | 'run' | 'reconcile' | 'receive' | 'cancel'

export function deliveryBelongsToView(
  row: Pick<DeliveryRow, 'type' | 'status'>,
  view: DeliveryView,
): boolean {
  const terminal = ['COMPLETED', 'RECONCILED', 'CANCELLED'].includes(row.status)
  return view === 'history' ? terminal : !terminal && row.type.toLowerCase() === view
}

// These mirror the inspected backend transitions; permissions remain separate.
export function getDeliveryActions(
  row: Pick<DeliveryRow, 'type' | 'status'> & {
    purchaseOrderStatus?: PurchaseOrderRecord['status']
    schedulingIssue?:
      ReturnType<typeof incomingSchedulingIssue> | ReturnType<typeof outgoingPreparationIssue>
    runId?: number | null
    record?: IncomingDeliveryRecord | OutgoingDeliveryRecord
  },
): DeliveryAction[] {
  if (row.type === 'Incoming') {
    if (row.status === 'DRAFT') return row.schedulingIssue || incomingOrderSchedulingIssue(row.purchaseOrderStatus) ? ['cancel'] : ['schedule', 'cancel']
    if (row.status === 'SCHEDULED') return ['receive', 'cancel']
  } else {
    if (row.status === 'DRAFT') return ['ready', 'cancel']
    if (row.status === 'READY')
      return (row.runId ?? (row.record && 'runId' in row.record ? row.record.runId : null)) != null
        ? ['run']
        : row.schedulingIssue ? ['reopen', 'cancel'] : ['reopen', 'run', 'cancel']
    if (row.status === 'DISPATCHED') return ['reconcile']
  }
  return []
}

export function formatDeliverySchedule(value: string | null, _history: boolean, scheduled = true) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return { date: 'Not scheduled', time: '', title: '' }
  return {
    date: date.toLocaleDateString('en-GB', {
      timeZone: 'Asia/Manila',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: scheduled
      ? date.toLocaleTimeString('en-GB', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        })
      : 'Expected',
    title: date.toLocaleString('en-GB', { timeZone: 'Asia/Manila' }),
  }
}
