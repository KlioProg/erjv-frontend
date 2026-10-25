import type { IncomingDeliveryRecord } from './incoming-deliveries.types'
import type { OutgoingDeliveryRecord } from './outgoing-deliveries.types'
import type { PurchaseOrderRecord } from './purchase-orders.types'
import type { SalesOrderRecord } from '../crm/sales-orders.types'
import type { Supplier } from './suppliers.types'
import type { Client } from '../crm/clients.types'
import type { Warehouse } from './warehouses.types'
import type { DeliveryVehicle } from './delivery-vehicles.types'
import type { Employee } from '../staffing/staffing.types'
import { isActiveDeliveryStatus } from './vehicle-assignment.ts'

export type DeliveryRow = {
  key: string
  reference: string
  type: 'Incoming' | 'Outgoing'
  party: string
  relatedOrder: string
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
  SCHEDULED: 'Scheduled',
  DISPATCHED: 'In Transit',
  DELIVERED: 'Delivered',
  COMPLETED: 'Received & Stocked',
  CANCELLED: 'Cancelled',
}
export function buildDeliveryRows({
  incoming,
  outgoing,
  purchaseOrders,
  salesOrders,
  suppliers,
  clients,
  warehouses,
  vehicles,
  employees,
}: {
  incoming: IncomingDeliveryRecord[]
  outgoing: OutgoingDeliveryRecord[]
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
      const vehicle = vehicles.find((vehicle) => vehicle.id === record.deliveryVehicleId)
      const driver = employees.find((employee) => employee.id === record.driverEmployeeId)
      return {
        key: `outgoing-${record.id}`,
        reference: record.deliveryNumber,
        type: 'Outgoing' as const,
        record,
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
        vehicle: vehicle
          ? `${vehicle.plateNumber}${vehicle.isActive ? '' : ' (Archived)'}`
          : record.deliveryVehicleId
            ? `Vehicle #${record.deliveryVehicleId}`
            : 'Unassigned',
        driver: driver ? `${driver.firstName} ${driver.lastName}` : '—',
        date: record.scheduledAt || order?.expectedAt || null,
        status: record.status,
      }
    }),
  ]
}

export function deliveryNeedsAttention(row: DeliveryRow, now: number): boolean {
  return (
    row.status === 'DRAFT' ||
    (isActiveDeliveryStatus(row.status) && !!row.date && new Date(row.date).getTime() < now)
  )
}

export function localDeliveryDay(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

export type DeliveryView = 'incoming' | 'outgoing' | 'history'
export type DeliveryAction = 'schedule' | 'dispatch' | 'receive' | 'complete' | 'cancel'

export function deliveryBelongsToView(
  row: Pick<DeliveryRow, 'type' | 'status'>,
  view: DeliveryView,
): boolean {
  const terminal = ['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(row.status)
  return view === 'history' ? terminal : !terminal && row.type.toLowerCase() === view
}

// These mirror the inspected backend transitions; permissions remain separate.
export function getDeliveryActions(row: Pick<DeliveryRow, 'type' | 'status'>): DeliveryAction[] {
  if (row.type === 'Incoming') {
    if (row.status === 'DRAFT') return ['schedule', 'cancel']
    if (row.status === 'SCHEDULED') return ['receive', 'cancel']
  } else {
    if (row.status === 'DRAFT') return ['schedule', 'cancel']
    if (row.status === 'SCHEDULED') return ['dispatch', 'cancel']
    if (row.status === 'DISPATCHED') return ['complete', 'cancel']
  }
  return []
}

export function formatDeliverySchedule(value: string | null, history: boolean, scheduled = true) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return { date: 'Not scheduled', time: '', title: '' }
  return {
    date: date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(history ? { year: 'numeric' as const } : {}),
    }),
    time: scheduled
      ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
      : 'Expected',
    title: date.toLocaleString('en-GB'),
  }
}
