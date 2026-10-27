import { useRef, useState } from 'react'
import { useSalesOrderById } from '@/features/crm/sales-orders.hooks'
import { useClients } from '@/features/crm/clients.hooks'
import { useEmployees } from '@/features/staffing/staffing.hooks'
import { getErrorMessage } from '@/lib/api-client'
import {
  useOutgoingDeliveryById,
  useOutgoingDeliveries,
  useDispatchOutgoingDelivery,
} from './outgoing-deliveries.hooks'
import { useDeliveryVehicles } from './delivery-vehicles.hooks'
import { useAllWarehouses } from './warehouses.hooks'
import { useWarehouseStock } from './stock-items.hooks'
import { DeliveryUtils } from './delivery-utils'
import { buildDispatchPlan, validateDispatchLoad } from './outgoing-dispatch'

export function useOutgoingDispatch(deliveryId: number, onSuccess: () => void) {
  const deliveryQuery = useOutgoingDeliveryById(deliveryId)
  const delivery = deliveryQuery.data
  const orderQuery = useSalesOrderById(delivery?.salesOrderId)
  const stockQuery = useWarehouseStock(delivery?.warehouseId ?? undefined)
  const warehousesQuery = useAllWarehouses()
  const clientsQuery = useClients({ includeInactive: 'true' })
  const vehiclesQuery = useDeliveryVehicles()
  const deliveriesQuery = useOutgoingDeliveries()
  const employeesQuery = useEmployees({ includeInactive: 'false' })
  const mutation = useDispatchOutgoingDelivery()
  const [vehicleId, setVehicleId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [quantities, setQuantities] = useState<Record<number, string>>({})
  const [reviewedRevision, setReviewedRevision] = useState<number | null>(null)
  const [needsRefresh, setNeedsRefresh] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [message, setMessage] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const lock = useRef(false)

  if (
    deliveryQuery.isFetchedAfterMount &&
    !deliveryQuery.isError &&
    delivery &&
    reviewedRevision === null
  ) {
    setReviewedRevision(delivery.revision)
    setVehicleId(delivery.deliveryVehicleId ? String(delivery.deliveryVehicleId) : '')
    setDriverId(delivery.driverEmployeeId ? String(delivery.driverEmployeeId) : '')
  }
  const order = orderQuery.data
  const warehouse = warehousesQuery.data?.find(
    (candidate) => candidate.id === delivery?.warehouseId,
  )
  const client = clientsQuery.data?.find((candidate) => candidate.id === order?.clientId)
  const plan =
    delivery && order ? buildDispatchPlan(delivery, order, stockQuery.data ?? []) : { rows: [] }
  const queries = [
    deliveryQuery,
    warehousesQuery,
    clientsQuery,
    vehiclesQuery,
    deliveriesQuery,
    employeesQuery,
    ...(delivery?.salesOrderId ? [orderQuery] : []),
    ...(delivery?.warehouseId ? [stockQuery] : []),
  ]
  const loading =
    queries.some((query) => query.isLoading) ||
    (!deliveryQuery.isFetchedAfterMount && deliveryQuery.isFetching)
  const loadError = queries.find((query) => query.isError)?.error
  const fetching = queries.some((query) => query.isFetching)
  let dataIssue: string | undefined
  if (!loading && !loadError) {
    if (
      !delivery ||
      delivery.id !== deliveryId ||
      !Number.isInteger(delivery.revision) ||
      delivery.revision < 1
    )
      dataIssue =
        'The saved delivery details are incomplete. Refresh the shipment before dispatching.'
    else if (delivery.status !== 'SCHEDULED')
      dataIssue =
        'Only a scheduled shipment can be dispatched. This shipment’s status has changed; review it in Outgoing Deliveries.'
    else if (!delivery.warehouseId || !warehouse?.isActive)
      dataIssue =
        'The saved source warehouse is missing or inactive. Refresh the shipment and review its source warehouse before dispatching.'
    else if (!order || !['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(order.status))
      dataIssue =
        'The current sales order is unavailable or cannot be delivered. Refresh the shipment and review the order.'
    else if (reviewedRevision !== null && delivery.revision !== reviewedRevision)
      dataIssue =
        'The saved shipment plan changed. Refresh the shipment and review the updated plan before dispatching.'
    else dataIssue = plan.error
  }
  const validation = validateDispatchLoad(plan.rows, quantities)
  const busy = mutation.isPending || refreshing
  const canSubmit = !loading && !loadError && !dataIssue && !needsRefresh && !fetching && !busy

  async function refresh() {
    if (lock.current || busy) return
    setRefreshing(true)
    try {
      const [latest, ...others] = await Promise.all(queries.map((query) => query.refetch()))
      if (latest.isError || others.some((query) => query.isError)) {
        setMessage(
          'The shipment could not be fully refreshed. Check your connection and try refreshing again.',
        )
        setNeedsRefresh(true)
        return
      }
      if (latest.data && 'revision' in latest.data) setReviewedRevision(latest.data.revision)
      setNeedsRefresh(false)
      setMessage('')
    } finally {
      setRefreshing(false)
    }
  }

  async function submit() {
    if (lock.current || !canSubmit || !delivery) return
    setSubmitted(true)
    setMessage('')
    if (validation.error) {
      setMessage(validation.error)
      return
    }
    const vehicle = vehiclesQuery.data?.find((candidate) => candidate.id === Number(vehicleId))
    if (
      !vehicle ||
      !DeliveryUtils.getVehicleAvailability(vehicle, deliveriesQuery.data ?? [], deliveryId)
        .isAvailable
    ) {
      setMessage(
        'Choose an available delivery vehicle. Refresh the shipment if its availability changed.',
      )
      return
    }
    const driver = employeesQuery.data?.find((candidate) => candidate.id === Number(driverId))
    if (
      !driver ||
      !DeliveryUtils.getDriverAvailability(driver, deliveriesQuery.data ?? [], deliveryId)
        .isAvailable
    ) {
      setMessage(
        'Choose an active, available driver. Refresh the shipment if their availability changed.',
      )
      return
    }
    lock.current = true
    try {
      await mutation.mutateAsync({
        id: deliveryId,
        payload: {
          deliveryVehicleId: vehicle.id,
          driverEmployeeId: driver.id,
          items: validation.items,
        },
      })
      onSuccess()
    } catch (error) {
      setMessage(
        `${getErrorMessage(error)} Refresh the shipment and review its status and availability before trying again.`,
      )
      setNeedsRefresh(true)
    } finally {
      lock.current = false
    }
  }

  return {
    delivery,
    order,
    client,
    warehouse,
    rows: plan.rows,
    vehicleId,
    driverId,
    setVehicleId,
    setDriverId,
    quantities,
    setQuantity: (id: number, value: string) =>
      setQuantities((current) => ({ ...current, [id]: value })),
    lineErrors: submitted ? validation.errors : {},
    error: loadError
      ? `Shipment data could not be loaded. ${getErrorMessage(loadError)}`
      : (dataIssue ?? message),
    loading,
    fetching,
    refreshing,
    busy,
    canSubmit,
    refresh,
    submit,
    vehicles: vehiclesQuery.data ?? [],
    employees: employeesQuery.data ?? [],
    deliveries: deliveriesQuery.data ?? [],
  }
}
