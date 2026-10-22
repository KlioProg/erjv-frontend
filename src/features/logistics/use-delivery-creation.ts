import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useDeliveryWorkspace } from './use-delivery-workspace'
import { useCreateIncomingDelivery, useScheduleIncomingDelivery } from './incoming-deliveries.hooks'
import { useCreateOutgoingDelivery, useScheduleOutgoingDelivery } from './outgoing-deliveries.hooks'
import {
  committedIncoming,
  committedOutgoing,
  type DeliveryQuantityRow,
} from './delivery-quantities'
import { parseStockCents } from './stock-display'
import { decimalString } from './purchase-pricing'
import { DeliveryUtils } from './delivery-utils'
import { getErrorMessage } from '@/lib/api-client'

export function useDeliveryCreation(kind: 'Incoming' | 'Outgoing', initialOrderId?: number) {
  const workspace = useDeliveryWorkspace()
  const { canManageOperations } = useAuth()
  const createIncoming = useCreateIncomingDelivery()
  const scheduleIncoming = useScheduleIncomingDelivery()
  const createOutgoing = useCreateOutgoingDelivery()
  const scheduleOutgoing = useScheduleOutgoingDelivery()
  const [orderId, setOrderId] = useState(initialOrderId ? String(initialOrderId) : '')
  const [warehouseId, setWarehouseId] = useState('')
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [scheduledAt, setScheduledAt] = useState('')
  const [supplierReference, setSupplierReference] = useState('')
  const [vehicleId, setVehicleId] = useState('none')
  const [driverId, setDriverId] = useState('none')
  const [notes, setNotes] = useState('')
  const [autoSchedule, setAutoSchedule] = useState(true)
  const [createdId, setCreatedId] = useState<number | null>(null)
  const [savedRows, setSavedRows] = useState<DeliveryQuantityRow[]>([])
  const [error, setError] = useState('')
  const incoming = kind === 'Incoming'
  const orders = incoming
    ? workspace.purchaseOrders.filter((order) =>
        ['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(order.status),
      )
    : workspace.salesOrders.filter((order) =>
        ['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order.status),
      )
  const effectiveOrderId = orderId || String(orders[0]?.id ?? '')
  const order = orders.find((order) => String(order.id) === effectiveOrderId)
  const orderOptions = orders.map((order) => ({
    value: String(order.id),
    label: `${order.orderNumber} — ${'supplierId' in order ? (workspace.suppliers.find((supplier) => supplier.id === order.supplierId)?.name ?? `Supplier #${order.supplierId}`) : (workspace.clients.find((client) => client.id === order.clientId)?.name ?? `Customer #${order.clientId}`)}`,
  }))
  const activeWarehouses = workspace.warehouses.filter((warehouse) => warehouse.isActive)
  const firstAllocation =
    order && 'clientId' in order
      ? order.items.flatMap((item) => item.allocations).find((allocation) => !allocation.releasedAt)
      : undefined
  const defaultWarehouseId = incoming
    ? activeWarehouses[0]?.id
    : workspace.stockItems.find((stock) => stock.id === firstAllocation?.stockItemId)?.warehouseId
  const effectiveWarehouseId = warehouseId || String(defaultWarehouseId ?? '')
  const requiredQueries = [
    workspace.warehouseQuery,
    workspace.productQuery,
    incoming ? workspace.purchaseQuery : workspace.salesQuery,
    incoming ? workspace.incomingQuery : workspace.outgoingQuery,
    ...(!incoming ? [workspace.stockQuery] : []),
  ]
  const loading = requiredQueries.some((query) => query.isLoading)
  const unavailable = requiredQueries.some((query) => query.isError)
  const rows =
    order?.items.flatMap((item) => {
      const product = workspace.products.find((product) => product.id === item.inventoryItemId)
      if ('allocations' in item)
        return item.allocations
          .filter(
            (allocation) =>
              !allocation.releasedAt &&
              workspace.stockItems.find((stock) => stock.id === allocation.stockItemId)
                ?.warehouseId === Number(effectiveWarehouseId),
          )
          .map((allocation) => {
            const allocated = parseStockCents(allocation.quantity)
            const committed = committedOutgoing(allocation.id, workspace.outgoing)
            const available =
              allocated !== null && committed !== null && committed <= allocated
                ? allocated - committed
                : null
            return {
              id: allocation.id,
              product: product?.name ?? `Product #${item.inventoryItemId}`,
              unit: product?.unit,
              available,
              quantity:
                quantities[allocation.id] ?? (available === null ? '' : decimalString(available)),
            }
          })
      const ordered = parseStockCents(item.quantity)
      const committed = committedIncoming(item.id, workspace.incoming)
      const available =
        ordered !== null && committed !== null && committed <= ordered ? ordered - committed : null
      return [
        {
          id: item.id,
          product: product?.name ?? `Product #${item.inventoryItemId}`,
          unit: product?.unit,
          available,
          quantity: quantities[item.id] ?? (available === null ? '' : decimalString(available)),
        },
      ]
    }) ?? []
  const pending = [createIncoming, scheduleIncoming, createOutgoing, scheduleOutgoing].some(
    (mutation) => mutation.isPending,
  )
  async function submit() {
    setError('')
    try {
      if (!canManageOperations) throw Error('You do not have permission to create deliveries.')
      const schedule = incoming ? scheduleIncoming : scheduleOutgoing
      if (createdId !== null) {
        await schedule.mutateAsync(createdId)
        return true
      }
      if (
        loading ||
        unavailable ||
        !order ||
        !activeWarehouses.some((warehouse) => String(warehouse.id) === effectiveWarehouseId)
      )
        throw Error('Select an eligible order and active warehouse after the inventory data loads.')
      const values = rows.map((row) => ({ row, quantity: parseStockCents(row.quantity) }))
      if (
        values.some(
          ({ row, quantity }) =>
            quantity === null || row.available === null || quantity > row.available,
        )
      )
        throw Error(
          'Enter valid quantities with up to two decimal places within the available shipment balance.',
        )
      const positive = values.filter(({ quantity }) => quantity! > 0n)
      if (!positive.length)
        throw Error('Enter a positive shipment quantity for at least one product.')
      const common = {
        warehouseId: Number(effectiveWarehouseId),
        scheduledAt: scheduledAt || null,
        notes: notes.trim() || null,
      }
      const created = incoming
        ? await createIncoming.mutateAsync({
            ...common,
            purchaseOrderId: order.id,
            supplierReference: supplierReference.trim() || null,
            items: positive.map(({ row, quantity }) => ({
              purchaseOrderItemId: row.id,
              receivedQuantity: decimalString(quantity!),
            })),
          })
        : await createOutgoing.mutateAsync({
            ...common,
            salesOrderId: order.id,
            deliveryVehicleId: vehicleId === 'none' ? null : Number(vehicleId),
            driverEmployeeId: driverId === 'none' ? null : Number(driverId),
            items: positive.map(({ row, quantity }) => ({
              salesOrderAllocationId: row.id,
              quantity: decimalString(quantity!),
            })),
          })
      setCreatedId(created.id)
      setSavedRows(rows)
      if (autoSchedule) await schedule.mutateAsync(created.id)
      return true
    } catch (error) {
      setError(getErrorMessage(error))
      return false
    }
  }
  return {
    ...workspace,
    kind,
    order,
    rows: createdId === null ? rows : savedRows,
    orderOptions,
    effectiveOrderId,
    effectiveWarehouseId,
    activeWarehouses,
    loading,
    unavailable,
    pending,
    locked: pending || createdId !== null,
    createdId,
    error,
    submit,
    scheduledAt,
    setScheduledAt,
    supplierReference,
    setSupplierReference,
    vehicleId,
    setVehicleId,
    driverId,
    setDriverId,
    notes,
    setNotes,
    autoSchedule,
    setAutoSchedule,
    changeOrder: (id: string) => {
      setOrderId(id)
      setWarehouseId('')
      setQuantities({})
      setError('')
    },
    setWarehouseId,
    changeQuantity: (id: number, quantity: string) =>
      setQuantities((current) => ({ ...current, [id]: quantity })),
    vehicleOptions: workspace.vehicles
      .filter(
        (vehicle) => DeliveryUtils.getVehicleAvailability(vehicle, workspace.outgoing).isAvailable,
      )
      .map((vehicle) => ({ value: String(vehicle.id), label: vehicle.plateNumber })),
    driverOptions: workspace.employees
      .filter(
        (employee) => DeliveryUtils.getDriverAvailability(employee, workspace.outgoing).isAvailable,
      )
      .map((employee) => ({
        value: String(employee.id),
        label: `${employee.firstName} ${employee.lastName}`,
      })),
  }
}
